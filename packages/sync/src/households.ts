// Household offline sync (Step 1.4 spike, ADR-002). Platform-agnostic: no React Native imports, so the
// mapping and state rules are unit-tested here and reused by apps/chw.

/** The five states the UI may show for an offline record (PRD OFF-006, BRS RULE-03). Never "received". */
export type SyncState = 'pending' | 'syncing' | 'synced' | 'rejected' | 'conflict';

/** Minimal shape of a PowerSync CRUD entry (see @powersync/common CrudEntry). */
export interface CrudEntryLike {
  op: 'PUT' | 'PATCH' | 'DELETE';
  table: string;
  id: string;
  clientId: number;
  opData?: Record<string, unknown>;
}

export interface HouseholdData {
  catchment_id?: string;
  name_or_head?: string;
  village?: string;
  lat?: number;
  lng?: number;
  member_count?: number;
}

/** One operation as accepted by supabase/functions/sync-ingest (schema_version 1). */
export interface IngestOperation {
  op_id: string;
  idempotency_key: string;
  local_sequence: number;
  schema_version: 1;
  op: 'insert' | 'field_update';
  entity_id: string;
  base_row_version?: number | null;
  client_created_at?: string | undefined;
  data: HouseholdData;
}

export interface IngestResult {
  op_id: string;
  entity_id: string;
  state: 'applied' | 'rejected' | 'conflict';
  reason_code: string | null;
  row_version: number | null;
  replayed?: boolean;
}

export const HOUSEHOLD_TABLE = 'households';

const DATA_FIELDS: (keyof HouseholdData)[] = [
  'catchment_id',
  'name_or_head',
  'village',
  'lat',
  'lng',
  'member_count',
];

function pickData(opData: Record<string, unknown> | undefined): HouseholdData {
  const data: Record<string, unknown> = {};
  for (const key of DATA_FIELDS) {
    const value = opData?.[key];
    if (value !== undefined && value !== null) data[key] = value;
  }
  return data as HouseholdData;
}

export class UnsupportedOperationError extends Error {
  constructor(readonly entry: CrudEntryLike) {
    super(`unsupported offline operation ${entry.op} on ${entry.table}`);
  }
}

/** Every local write must set op_id (a fresh UUID) in the same statement; a write without it is a bug. */
export class MissingOperationIdError extends UnsupportedOperationError {}

/**
 * Maps a PowerSync CRUD entry to an ingest operation.
 * The idempotency key is derived from the device id and PowerSync's per-device clientId, so re-sending the
 * same queued entry (app killed mid-upload, retry) always produces the same key.
 */
export function toIngestOperation(
  entry: CrudEntryLike,
  ctx: { deviceId: string; newOperationId: () => string },
): IngestOperation {
  if (entry.table !== HOUSEHOLD_TABLE || entry.op === 'DELETE') {
    throw new UnsupportedOperationError(entry); // records are never deleted (RULE-04)
  }
  const opData = entry.opData ?? {};
  const base = opData.base_row_version;
  // The operation id is a UUID persisted with the row at write time, so it survives app kills, retries and a
  // reset of PowerSync's local counter. The idempotency key is derived from it (never from clientId alone).
  const opId = typeof opData.op_id === 'string' ? opData.op_id : null;
  if (opId === null) throw new MissingOperationIdError(entry);
  return {
    op_id: opId,
    idempotency_key: `${ctx.deviceId}:${opId}`,
    local_sequence: entry.clientId,
    schema_version: 1,
    op: entry.op === 'PUT' ? 'insert' : 'field_update',
    entity_id: entry.id,
    base_row_version: entry.op === 'PATCH' && typeof base === 'number' ? base : null,
    client_created_at:
      typeof opData.client_created_at === 'string' ? opData.client_created_at : undefined,
    data: pickData(opData),
  };
}

/** State to show after the server answered. "applied" means centrally received → synced. */
export function stateFromResult(result: IngestResult): SyncState {
  if (result.state === 'applied') return 'synced';
  return result.state;
}

/** Reason codes the UI translates (keys under sync.reason.* in packages/i18n). Unknown codes fall back. */
export const KNOWN_REASON_CODES = [
  'NOT_IN_CATCHMENT',
  'INVALID_PAYLOAD',
  'UNSUPPORTED_SCHEMA_VERSION',
  'ID_EXISTS',
  'NOT_FOUND',
  'STALE_VERSION',
  'CATCHMENT_CHANGE',
  'UNSUPPORTED_OP',
  'DEVICE_REVOKED',
  'IDEMPOTENCY_MISMATCH',
  'FORBIDDEN',
] as const;
export type ReasonCode = (typeof KNOWN_REASON_CODES)[number];

export function reasonKey(code: string | null): string | null {
  if (code === null) return null;
  return (KNOWN_REASON_CODES as readonly string[]).includes(code)
    ? `sync.reason.${code}`
    : 'sync.reason.UNKNOWN';
}
