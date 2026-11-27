import type {
  AbstractPowerSyncDatabase,
  CrudEntry,
  PowerSyncBackendConnector,
  PowerSyncCredentials,
} from '@powersync/react-native';
import {
  type IngestOperation,
  type IngestResult,
  stateFromResult,
  type SyncState,
  toIngestOperation,
  UnsupportedOperationError,
} from '@jorapha/sync';
import * as Crypto from 'expo-crypto';

import { isAuthRefreshDiscardedError, isAuthRetryableFetchError } from '@supabase/supabase-js';

import { config, syncIngestUrl } from '../config';
import { fetchWithTimeout } from '../lib/fetchWithTimeout';
import { readStoredUserId, supabase } from '../lib/supabase';
import { classifyRefreshFailure, shouldRefresh } from '../lib/tokenPolicy';

/** Anything that can run a statement: the database or an open write transaction. */
interface Executor {
  execute(sql: string, params?: unknown[]): Promise<unknown>;
}

export async function setStatus(
  db: Executor,
  id: string,
  state: SyncState,
  reasonCode: string | null = null,
  label: string | null = null,
): Promise<void> {
  // PowerSync exposes every table (local-only ones too) as a SQLite VIEW, and SQLite refuses
  // INSERT … ON CONFLICT on a view: the upsert made every household save fail and roll back (emulator,
  // 2026-11-27). Insert-if-missing then update works through the views' INSTEAD OF triggers.
  const now = new Date().toISOString();
  await db.execute(
    `INSERT INTO household_sync_status (id, state, reason_code, label, updated_at)
     SELECT ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM household_sync_status WHERE id = ?)`,
    [id, state, reasonCode, label, now, id],
  );
  await db.execute(
    `UPDATE household_sync_status
        SET state = ?, reason_code = ?, label = coalesce(?, label), updated_at = ?
      WHERE id = ?`,
    [state, reasonCode, label, now, id],
  );
}

/** The refresh token was rejected by the server: the user must sign in again (the local queue is kept). */
export class SessionInvalidError extends Error {
  constructor() {
    super('SESSION_INVALID');
  }
}

const MIN_REFRESH_INTERVAL_MS = 60_000;
const uploadFetch = fetchWithTimeout(45_000);
let lastIssuedToken: string | null = null;
let lastRefreshAt: number | null = null;

/**
 * Access token for PowerSync and sync-ingest. Refreshes with the server only when shouldRefresh says so
 * (src/lib/tokenPolicy.ts): not on every call, never more than once a minute. Offline, the stored session is kept
 * and the request is retried later. Returns null when signed out; throws SessionInvalidError when the server
 * rejected the refresh token, so PowerSync reports a sync error instead of looping on an expired token.
 */
export async function accessToken(force = false): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  const stored = data.session?.access_token ?? null;
  if (!stored) {
    // Still signed in on this phone, but the expired token could not be refreshed (offline): retry later.
    if (await readStoredUserId()) throw new Error('session not refreshed yet: offline');
    return null;
  }
  const now = Date.now();
  if (
    !shouldRefresh({
      storedToken: stored,
      lastIssuedToken,
      force,
      now,
      lastRefreshAt,
      minIntervalMs: MIN_REFRESH_INTERVAL_MS,
    })
  ) {
    lastIssuedToken = stored;
    return stored;
  }
  lastRefreshAt = now;
  const refreshed = await supabase.auth.refreshSession();
  if (refreshed.data.session) {
    console.warn('[auth] token refreshed');
    lastIssuedToken = refreshed.data.session.access_token;
    return lastIssuedToken;
  }
  const failure = refreshed.error
    ? classifyRefreshFailure({
        retryable: isAuthRetryableFetchError(refreshed.error),
        discarded: isAuthRefreshDiscardedError(refreshed.error),
      })
    : 'keep-session';
  console.warn(`[auth] token refresh failed: ${failure}`);
  if (failure === 'session-invalid') throw new SessionInvalidError();
  const { data: after } = await supabase.auth.getSession();
  lastIssuedToken = after.session?.access_token ?? null;
  return lastIssuedToken;
}

export interface ConnectorHooks {
  /** Server confirmed the device is revoked: purge local data and sign out. */
  onDeviceRevoked: () => void;
  /** Server does not know this device (registration failed earlier): register again. */
  registerDevice: () => Promise<void>;
}

/**
 * Uploads the local queue to supabase/functions/sync-ingest. A batch is completed (removed from the queue)
 * ONLY when the server answered every operation in it; every other outcome keeps the queue and retries, so
 * an acknowledged local record is never dropped by a server or network fault.
 */
/**
 * Diagnostics for the spike's fault tests: batch size and outcome only (HTTP status or error type), never
 * household data (CLAUDE.md: no personal health data in logs).
 */
function logUpload(opCount: number, outcome: string): void {
  console.warn(`[sync] upload of ${opCount} op(s): ${outcome}`);
}

export class SupabaseConnector implements PowerSyncBackendConnector {
  constructor(
    private readonly deviceId: string,
    private readonly hooks: ConnectorHooks,
  ) {}

  async fetchCredentials(): Promise<PowerSyncCredentials | null> {
    // PowerSync calls this on every (re)connect, including after a rejected token: always a fresh one.
    const token = await accessToken();
    if (!token) return null;
    // Download path: an idle revoked device must stop syncing too, not only on upload. Best effort when
    // offline; the server-side gate for real data is session revocation (report §5).
    const { data: device } = await supabase
      .schema('identity')
      .from('device_registration')
      .select('trust_status')
      .eq('id', this.deviceId)
      .maybeSingle();
    if (device?.trust_status === 'revoked') {
      this.hooks.onDeviceRevoked();
      return null;
    }
    return { endpoint: config.powersyncUrl, token };
  }

  async uploadData(db: AbstractPowerSyncDatabase): Promise<void> {
    const batch = await db.getCrudBatch(50);
    if (!batch) return;

    const ops: IngestOperation[] = [];
    const unsupported: CrudEntry[] = [];
    for (const entry of batch.crud) {
      try {
        ops.push(
          toIngestOperation(entry, {
            deviceId: this.deviceId,
            newOperationId: () => Crypto.randomUUID(),
          }),
        );
      } catch (e) {
        if (e instanceof UnsupportedOperationError) unsupported.push(entry);
        else throw e;
      }
    }
    for (const entry of unsupported) await setStatus(db, entry.id, 'rejected', 'UNSUPPORTED_OP');
    if (ops.length === 0) {
      await batch.complete();
      return;
    }

    const backToPending = async (reason: string | null = null) => {
      for (const op of ops) await setStatus(db, op.entity_id, 'pending', reason);
    };

    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      await backToPending();
      throw new Error(
        (await readStoredUserId()) ? 'session not refreshed yet: offline' : 'not signed in',
      );
    }

    for (const op of ops) await setStatus(db, op.entity_id, 'syncing');

    let response: Response;
    try {
      // A stalled upload is abandoned and retried; the server de-duplicates by idempotency key.
      response = await uploadFetch(syncIngestUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${data.session.access_token}`,
        },
        body: JSON.stringify({ device_id: this.deviceId, ops }),
      });
    } catch (networkError) {
      await backToPending();
      logUpload(ops.length, networkError instanceof Error ? networkError.name : 'network error');
      throw networkError;
    }
    logUpload(ops.length, `HTTP ${response.status}`);

    if (response.status === 403) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (body.error === 'DEVICE_REVOKED') {
        this.hooks.onDeviceRevoked();
        throw new Error('DEVICE_REVOKED');
      }
      if (body.error === 'DEVICE_UNKNOWN') {
        await backToPending();
        await this.hooks.registerDevice();
        throw new Error('DEVICE_UNKNOWN: registered again, retrying');
      }
      await backToPending('FORBIDDEN');
      throw new Error('FORBIDDEN');
    }
    if (!response.ok) {
      // 400 (client bug), 401, 503 or anything else: keep the queue, retry later.
      await backToPending();
      // 401: the token was expired by the server's clock; refresh so the retry does not loop on it.
      if (response.status === 401) await accessToken(true).catch(() => null);
      throw new Error(`sync-ingest HTTP ${response.status}`);
    }

    const { results } = (await response.json()) as { results: IngestResult[] };
    const answered = new Map(results.map((r) => [r.entity_id, r]));
    if (results.length !== ops.length || ops.some((op) => !answered.has(op.entity_id))) {
      await backToPending();
      throw new Error('incomplete answer from sync-ingest; retrying');
    }
    for (const result of results) {
      await setStatus(db, result.entity_id, stateFromResult(result), result.reason_code);
    }
    await batch.complete();
  }
}
