import { describe, expect, it } from 'vitest';

import { ownershipDecision, parseStoredUserId } from './storedSession';

describe('parseStoredUserId', () => {
  it('reads the user id from a stored supabase session', () => {
    expect(parseStoredUserId(JSON.stringify({ access_token: 't', user: { id: 'u-1' } }))).toBe(
      'u-1',
    );
  });

  it('treats missing, malformed or id-less sessions as no session', () => {
    expect(parseStoredUserId(null)).toBeNull();
    expect(parseStoredUserId('not json')).toBeNull();
    expect(parseStoredUserId('null')).toBeNull();
    expect(parseStoredUserId(JSON.stringify({ user: {} }))).toBeNull();
    expect(parseStoredUserId(JSON.stringify({ user: { id: 42 } }))).toBeNull();
  });
});

describe('ownershipDecision', () => {
  it('lets the owner use the database and records a first owner', () => {
    expect(ownershipDecision('u-1', 'u-1', 3)).toBe('use');
    expect(ownershipDecision(null, 'u-1', 3)).toBe('claim');
  });

  it('wipes the synced data of another health worker before the new one sees it', () => {
    expect(ownershipDecision('u-1', 'u-2', 0)).toBe('wipe-then-claim');
  });

  it('never lets a new health worker upload unsent records of another one', () => {
    expect(ownershipDecision('u-1', 'u-2', 1)).toBe('blocked');
  });
});
