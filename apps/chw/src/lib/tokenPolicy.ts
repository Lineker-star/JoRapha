/**
 * When to exchange the refresh token with the server (pure, unit-tested in tokenPolicy.test.ts).
 *
 * supabase-js decides "expired" with the phone's clock, so a phone whose clock is behind keeps an expired access
 * token (PowerSync PSYNC_S2103, seen when the emulator resumed after a night). A server-side refresh does not
 * depend on the phone's clock, but each one rotates the refresh token: on 2G a lost response can burn it, and the
 * Auth refresh endpoint is rate limited per IP (CHWs behind carrier NAT share one). So refresh only when needed:
 *   - the stored token is one we already handed out (PowerSync asks again only after a connection ended or was
 *     rejected), or the server just answered 401 (`force`);
 *   - and no refresh happened in the last `minIntervalMs`.
 * A token we have not handed out yet is used as is (no extra round trip on a cold start).
 */
export interface RefreshDecisionInput {
  storedToken: string;
  lastIssuedToken: string | null;
  force: boolean;
  now: number;
  lastRefreshAt: number | null;
  minIntervalMs: number;
}

export function shouldRefresh(input: RefreshDecisionInput): boolean {
  const reissue = input.storedToken === input.lastIssuedToken;
  if (!input.force && !reissue) return false;
  if (input.lastRefreshAt === null) return true;
  const elapsed = input.now - input.lastRefreshAt;
  // A negative gap means the phone's clock moved backwards (fault test 4, clock 2 days back): without this the
  // gap stayed negative for days and the token could never be refreshed again.
  return elapsed < 0 || elapsed >= input.minIntervalMs;
}

/** What to do when the refresh call failed. */
export type RefreshFailure = 'keep-session' | 'session-invalid';

/**
 * Network trouble (retryable) or a refresh discarded by a concurrent one: keep the stored session, the request
 * fails and is retried later. Anything else (refresh token revoked, reused or unknown): the session cannot be
 * renewed, so stop pretending and tell the user to sign in again. The local queue is kept either way.
 */
export function classifyRefreshFailure(error: {
  retryable: boolean;
  discarded: boolean;
}): RefreshFailure {
  return error.retryable || error.discarded ? 'keep-session' : 'session-invalid';
}
