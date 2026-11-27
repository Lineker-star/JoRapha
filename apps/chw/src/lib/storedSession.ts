/**
 * User id from the session JSON supabase-js keeps in SecureStore (pure; tested in storedSession.test.ts).
 * Only `user.id` is read; anything malformed counts as "no stored session".
 */
export function parseStoredUserId(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const stored = JSON.parse(raw) as { user?: { id?: unknown } } | null;
    return typeof stored?.user?.id === 'string' && stored.user.id.length > 0
      ? stored.user.id
      : null;
  } catch {
    return null;
  }
}

/** What to do when the local database belongs to `owner` and `userId` is signing in. */
export type OwnershipDecision = 'use' | 'claim' | 'wipe-then-claim' | 'blocked';

export function ownershipDecision(
  owner: string | null,
  userId: string,
  pendingUploads: number,
): OwnershipDecision {
  // First owner, or a database created before ownership was recorded.
  if (owner === null) return 'claim';
  if (owner === userId) return 'use';
  // Another CHW: their synced data is on the server, so the local copy can go; unsent writes must never be
  // uploaded under the new CHW's account.
  return pendingUploads === 0 ? 'wipe-then-claim' : 'blocked';
}
