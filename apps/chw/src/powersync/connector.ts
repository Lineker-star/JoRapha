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

export class DeviceRevokedError extends Error {}

export async function setStatus(
  db: AbstractPowerSyncDatabase,
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

/**
 * Uploads the local queue to supabase/functions/sync-ingest. Contract:
 * - network failure → throw (PowerSync retries with backoff; records go back to "pending");
 * - 403 DEVICE_REVOKED → throw DeviceRevokedError (the app purges local data);
 * - 200 → per-operation results; the batch is completed so rejected/conflict items do not block the queue,
 *   and their state stays visible (never shown as received).
 */
export class SupabaseConnector implements PowerSyncBackendConnector {
  constructor(
    private readonly deviceId: string,
    private readonly onDeviceRevoked: () => void,
  ) {}

  async fetchCredentials(): Promise<PowerSyncCredentials | null> {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return null;
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

    for (const op of ops) await setStatus(db, op.entity_id, 'syncing');

    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      for (const op of ops) await setStatus(db, op.entity_id, 'pending');
      throw new Error('not signed in');
    }

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
      for (const op of ops) await setStatus(db, op.entity_id, 'pending');
      throw networkError;
    }

    if (response.status === 403) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (body.error === 'DEVICE_REVOKED') {
        this.onDeviceRevoked();
        throw new DeviceRevokedError('DEVICE_REVOKED');
      }
    }
    if (response.status === 400) {
      // The whole batch is malformed (client bug or app too old): reject it visibly instead of retrying forever.
      for (const op of ops) await setStatus(db, op.entity_id, 'rejected', 'INVALID_PAYLOAD');
      await batch.complete();
      return;
    }
    if (!response.ok) {
      for (const op of ops) await setStatus(db, op.entity_id, 'pending');
      throw new Error(`sync-ingest HTTP ${response.status}`);
    }

    const { results } = (await response.json()) as { results: IngestResult[] };
    for (const result of results) {
      await setStatus(db, result.entity_id, stateFromResult(result), result.reason_code);
    }
    await batch.complete();
  }
}
