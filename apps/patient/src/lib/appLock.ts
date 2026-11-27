import { isAcceptablePin, MAX_PIN_ATTEMPTS } from '@jorapha/domain';
import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

/**
 * Optional app lock (Step 2.1): a PIN and/or the phone's biometrics. FAILS CLOSED (security review, 2026-11-27):
 * - each value is its own small SecureStore item (one atomic write each; no chunking, no delete-then-write);
 * - the "enabled" flag is separate from the PIN data: enabled but unreadable PIN data means the person must sign
 *   in again, never "unlocked";
 * - the wrong-attempt counter is raised BEFORE the PIN is compared, so killing the app mid-check still counts.
 * The PIN is stretched with PBKDF2-SHA256 (100 000 iterations, random salt): a 4-6 digit PIN is weak, and people
 * may reuse their Mobile Money or SIM PIN. Only the derived hash is stored; the PIN is never stored or logged.
 */
const KEY_ENABLED = 'jorapha.applock.enabled';
const KEY_SECRET = 'jorapha.applock.secret';
const KEY_FAILED = 'jorapha.applock.failed';
const PBKDF2_ITERATIONS = 100_000;

const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

interface LockSecret {
  salt: string;
  hash: string;
  iterations: number;
  biometrics: boolean;
}

async function readSecret(): Promise<LockSecret | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY_SECRET, options);
    const parsed = raw ? (JSON.parse(raw) as LockSecret) : null;
    return parsed && typeof parsed.hash === 'string' && typeof parsed.salt === 'string'
      ? parsed
      : null;
  } catch {
    return null;
  }
}

async function derive(pin: string, salt: string, iterations: number): Promise<string> {
  const key = await pbkdf2Async(sha256, pin, salt, { c: iterations, dkLen: 32 });
  return bytesToHex(key);
}

function randomSalt(): string {
  return bytesToHex(Crypto.getRandomBytes(16));
}

export async function isLockEnabled(): Promise<boolean> {
  return (await SecureStore.getItemAsync(KEY_ENABLED, options)) === '1';
}

export async function usesBiometrics(): Promise<boolean> {
  return (await readSecret())?.biometrics ?? false;
}

/** Whether this phone can offer biometrics (hardware present and something enrolled). */
export async function biometricsAvailable(): Promise<boolean> {
  return (
    (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync())
  );
}

/** Turns the lock on with a new PIN. Returns false if the PIN is too weak (see isAcceptablePin). */
export async function enableLock(pin: string, biometrics: boolean): Promise<boolean> {
  if (!isAcceptablePin(pin)) return false;
  const salt = randomSalt();
  const secret: LockSecret = {
    salt,
    hash: await derive(pin, salt, PBKDF2_ITERATIONS),
    iterations: PBKDF2_ITERATIONS,
    biometrics,
  };
  // PIN data and counter first, the "enabled" flag last: a half-done enable never locks without a PIN.
  await SecureStore.setItemAsync(KEY_SECRET, JSON.stringify(secret), options);
  await SecureStore.setItemAsync(KEY_FAILED, '0', options);
  await SecureStore.setItemAsync(KEY_ENABLED, '1', options);
  return true;
}

export async function disableLock(): Promise<void> {
  // The flag first: once it is gone the lock is off, whatever happens to the rest.
  await SecureStore.deleteItemAsync(KEY_ENABLED, options);
  await SecureStore.deleteItemAsync(KEY_SECRET, options);
  await SecureStore.deleteItemAsync(KEY_FAILED, options);
}

export type PinResult = 'ok' | 'wrong' | 'too-many';

/**
 * Checks a PIN. 'too-many' (MAX_PIN_ATTEMPTS reached, or the lock is on but its data is unreadable) means the
 * caller must sign the person out.
 */
export async function verifyPin(pin: string): Promise<PinResult> {
  if (!(await isLockEnabled())) return 'ok';
  const secret = await readSecret();
  if (!secret) return 'too-many'; // fail closed
  const failedBefore = Number((await SecureStore.getItemAsync(KEY_FAILED, options)) ?? '0');
  const failed = Number.isFinite(failedBefore) ? failedBefore + 1 : MAX_PIN_ATTEMPTS;
  // Count the attempt before checking it: killing the app now still counts it.
  await SecureStore.setItemAsync(KEY_FAILED, String(failed), options);
  if ((await derive(pin, secret.salt, secret.iterations)) === secret.hash) {
    await SecureStore.setItemAsync(KEY_FAILED, '0', options);
    return 'ok';
  }
  return failed >= MAX_PIN_ATTEMPTS ? 'too-many' : 'wrong';
}

/** Biometric unlock (strong biometrics only) through the system prompt; false if cancelled or unavailable. */
export async function unlockWithBiometrics(promptMessage: string): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    disableDeviceFallback: true,
    biometricsSecurityLevel: 'strong',
  });
  return result.success;
}
