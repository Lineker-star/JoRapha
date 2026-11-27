/**
 * @jorapha/domain — Zod schemas, business rules, state machines and shared types. Empty until Phase 1 (ERD).
 */
export const PACKAGE_NAME = '@jorapha/domain' as const;

export { isAcceptablePin, MAX_PIN_ATTEMPTS, RELOCK_AFTER_MS, shouldLock } from './appLock';
export { normalizeCameroonPhone } from './phone';
