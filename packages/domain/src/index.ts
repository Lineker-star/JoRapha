/**
 * @jorapha/domain — Zod schemas, business rules, state machines and shared types. Empty until Phase 1 (ERD).
 */
export const PACKAGE_NAME = '@jorapha/domain' as const;

// CI ACCEPTANCE TEST (do not merge): deliberate type error, must fail `pnpm typecheck`.
export const brokenOnPurpose: number = 'not a number';
