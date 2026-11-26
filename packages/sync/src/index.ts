/**
 * @jorapha/sync — offline sync mapping and state rules (Step 1.4 spike, ADR-002).
 * Platform-agnostic: the PowerSync database and connector live in apps/chw and use these helpers.
 */
export const PACKAGE_NAME = '@jorapha/sync' as const;

export * from './households';
