import { describe, expect, it } from 'vitest';

import { classifyRefreshFailure, shouldRefresh } from './tokenPolicy';

const base = {
  storedToken: 'token-a',
  lastIssuedToken: null as string | null,
  force: false,
  now: 1_000_000,
  lastRefreshAt: null as number | null,
  minIntervalMs: 60_000,
};

describe('shouldRefresh', () => {
  it('uses a token not yet handed out as is (no round trip on cold start)', () => {
    expect(shouldRefresh(base)).toBe(false);
  });

  it('refreshes when PowerSync asks again for the token it already got (rejected or reconnecting)', () => {
    expect(shouldRefresh({ ...base, lastIssuedToken: 'token-a' })).toBe(true);
  });

  it('refreshes after a 401 even for a new token (wrong device clock)', () => {
    expect(shouldRefresh({ ...base, force: true })).toBe(true);
  });

  it('never refreshes twice within the minimum interval, even when forced (no 401 loop, no rate limit)', () => {
    const recent = {
      ...base,
      lastIssuedToken: 'token-a',
      force: true,
      lastRefreshAt: base.now - 5_000,
    };
    expect(shouldRefresh(recent)).toBe(false);
    expect(shouldRefresh({ ...recent, lastRefreshAt: base.now - 60_000 })).toBe(true);
  });
});

describe('shouldRefresh when the phone clock moves backwards', () => {
  it('still allows a refresh after the clock was set 2 days back (fault test 4)', () => {
    const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
    expect(
      shouldRefresh({
        ...base,
        force: true,
        lastRefreshAt: base.now + twoDaysMs, // last refresh happened "in the future" of the new clock
      }),
    ).toBe(true);
  });
});

describe('classifyRefreshFailure', () => {
  it('keeps the session when offline or when a concurrent refresh won', () => {
    expect(classifyRefreshFailure({ retryable: true, discarded: false })).toBe('keep-session');
    expect(classifyRefreshFailure({ retryable: false, discarded: true })).toBe('keep-session');
  });

  it('reports an invalid session when the refresh token is rejected by the server', () => {
    expect(classifyRefreshFailure({ retryable: false, discarded: false })).toBe('session-invalid');
  });
});
