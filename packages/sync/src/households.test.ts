import { describe, expect, it } from 'vitest';

import {
  type CrudEntryLike,
  reasonKey,
  stateFromResult,
  toIngestOperation,
  UnsupportedOperationError,
} from './households';

const ctx = { deviceId: 'dev-1', newOperationId: () => 'generated-op-id' };

describe('toIngestOperation', () => {
  it('maps a PUT to an insert with only household fields', () => {
    const entry: CrudEntryLike = {
      op: 'PUT',
      table: 'households',
      id: 'h-1',
      clientId: 7,
      opData: {
        catchment_id: 'c-1',
        name_or_head: 'Household One',
        member_count: 5,
        lat: 4.58,
        lng: 13.68,
        client_created_at: '2026-11-26T10:00:00Z',
        row_version: 3,
        unrelated: 'dropped',
      },
    };
    const op = toIngestOperation(entry, ctx);
    expect(op).toMatchObject({
      op: 'insert',
      entity_id: 'h-1',
      local_sequence: 7,
      schema_version: 1,
      base_row_version: null,
      client_created_at: '2026-11-26T10:00:00Z',
      data: {
        catchment_id: 'c-1',
        name_or_head: 'Household One',
        member_count: 5,
        lat: 4.58,
        lng: 13.68,
      },
    });
    expect(op.data).not.toHaveProperty('unrelated');
    expect(op.data).not.toHaveProperty('row_version');
  });

  it('derives a stable idempotency key from device and clientId (safe to resend after a crash)', () => {
    const entry: CrudEntryLike = {
      op: 'PUT',
      table: 'households',
      id: 'h-1',
      clientId: 42,
      opData: {},
    };
    expect(toIngestOperation(entry, ctx).idempotency_key).toBe('dev-1:42');
    expect(toIngestOperation(entry, ctx).idempotency_key).toBe(
      toIngestOperation(entry, ctx).idempotency_key,
    );
  });

  it('maps a PATCH to a field update carrying the base row version', () => {
    const entry: CrudEntryLike = {
      op: 'PATCH',
      table: 'households',
      id: 'h-1',
      clientId: 8,
      opData: { member_count: 6, base_row_version: 2 },
    };
    expect(toIngestOperation(entry, ctx)).toMatchObject({
      op: 'field_update',
      base_row_version: 2,
      data: { member_count: 6 },
    });
  });

  it('refuses deletes and other tables', () => {
    expect(() =>
      toIngestOperation({ op: 'DELETE', table: 'households', id: 'h', clientId: 1 }, ctx),
    ).toThrow(UnsupportedOperationError);
    expect(() =>
      toIngestOperation({ op: 'PUT', table: 'patients', id: 'p', clientId: 1 }, ctx),
    ).toThrow(UnsupportedOperationError);
  });
});

describe('stateFromResult', () => {
  it('shows synced only after the server applied the operation', () => {
    const base = { op_id: 'o', entity_id: 'h', reason_code: null, row_version: 1 };
    expect(stateFromResult({ ...base, state: 'applied' })).toBe('synced');
    expect(stateFromResult({ ...base, state: 'rejected', reason_code: 'NOT_IN_CATCHMENT' })).toBe(
      'rejected',
    );
    expect(stateFromResult({ ...base, state: 'conflict', reason_code: 'STALE_VERSION' })).toBe(
      'conflict',
    );
  });
});

describe('reasonKey', () => {
  it('maps known reason codes to i18n keys and unknown ones to a fallback', () => {
    expect(reasonKey('NOT_IN_CATCHMENT')).toBe('sync.reason.NOT_IN_CATCHMENT');
    expect(reasonKey('SOMETHING_NEW')).toBe('sync.reason.UNKNOWN');
    expect(reasonKey(null)).toBeNull();
  });
});
