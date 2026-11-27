/**
 * Optional app lock for the patient app (Step 2.1): a PIN and/or the phone's biometrics, asked when the app opens
 * and when it comes back after a while in the background. Pure rules; the app stores only a salted hash of the PIN.
 */

/** 4 to 6 digits, not all the same digit and not a simple ascending/descending run (1234, 9876…). */
export function isAcceptablePin(pin: string): boolean {
  if (!/^\d{4,6}$/.test(pin)) return false;
  if (/^(\d)\1+$/.test(pin)) return false;
  const digits = [...pin].map(Number);
  const step = (digits[1] ?? 0) - (digits[0] ?? 0);
  const isRun =
    Math.abs(step) === 1 && digits.every((d, i) => i === 0 || d - (digits[i - 1] ?? 0) === step);
  return !isRun;
}

/** Background time after which the app asks for the PIN / biometrics again. */
export const RELOCK_AFTER_MS = 2 * 60 * 1000;

/**
 * Whether the lock screen must be shown. `backgroundedAt` is when the app last left the foreground (null at a cold
 * start, which always locks). A clock that moved backwards locks too (never trust a negative gap).
 */
export function shouldLock(
  enabled: boolean,
  backgroundedAt: number | null,
  now: number,
  relockAfterMs: number = RELOCK_AFTER_MS,
): boolean {
  if (!enabled) return false;
  if (backgroundedAt === null) return true;
  const away = now - backgroundedAt;
  return away < 0 || away >= relockAfterMs;
}

/** Wrong-PIN attempts allowed before the app requires signing in again (local data stays encrypted). */
export const MAX_PIN_ATTEMPTS = 5;
