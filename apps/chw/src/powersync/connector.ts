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

import { config, syncIngestUrl } from '../config';
import { supabase } from '../lib/supabase';

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
  await db.execute(
    `INSERT INTO household_sync_status (id, state, reason_code, label, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET state = excluded.state, reason_code = excluded.reason_code,
       label = coalesce(excluded.label, household_sync_status.label), updated_at = excluded.updated_at`,
    [id, state, reasonCode, label, new Date().toISOString()],
  );
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
export class SupabaseConnector implements PowerSyncBackendConnector {
  constructor(
    private readonly deviceId: string,
    private readonly hooks: ConnectorHooks,
  ) {}

  async fetchCredentials(): Promise<PowerSyncCredentials | null> {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return null;
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
    return { endpoint: config.powersyncUrl, token: data.session.access_token };
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
      throw new Error('not signed in');
    }

    for (const op of ops) await setStatus(db, op.entity_id, 'syncing');

    let response: Response;
    try {
      response = await fetch(syncIngestUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${data.session.access_token}`,
        },
        body: JSON.stringify({ device_id: this.deviceId, ops }),
      });
    } catch (networkError) {
      await backToPending();
      throw networkError;
    }

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
