import { isAcceptablePin, MAX_PIN_ATTEMPTS } from '@jorapha/domain';
import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';

import { secureStorage } from './secureStorage';

/**
 * Optional app lock (Step 2.1): a PIN and/or the phone's biometrics. Only a salted SHA-256 hash of the PIN is
 * kept, in the Keystore-backed secure store; the PIN itself is never stored or logged. Rules (PIN strength,
 * when to re-lock, attempt limit) live in @jorapha/domain and are unit-tested there.
 */
const KEY_LOCK = 'jorapha.applock';

interface LockSettings {
  salt: string;
  hash: string;
  biometrics: boolean;
  failedAttempts: number;
}

async function readSettings(): Promise<LockSettings | null> {
  const raw = await secureStorage.getItem(KEY_LOCK);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LockSettings;
  } catch {
    return null;
  }
}

async function writeSettings(settings: LockSettings): Promise<void> {
  await secureStorage.setItem(KEY_LOCK, JSON.stringify(settings));
}

async function hashPin(salt: string, pin: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
}

function randomSalt(): string {
  return Array.from(Crypto.getRandomBytes(16), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function isLockEnabled(): Promise<boolean> {
  return (await readSettings()) !== null;
}

export async function usesBiometrics(): Promise<boolean> {
  return (await readSettings())?.biometrics ?? false;
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
  await writeSettings({ salt, hash: await hashPin(salt, pin), biometrics, failedAttempts: 0 });
  return true;
}

export async function disableLock(): Promise<void> {
  await secureStorage.removeItem(KEY_LOCK);
}

export type PinResult = 'ok' | 'wrong' | 'too-many';

/** Checks a PIN. After MAX_PIN_ATTEMPTS wrong tries the caller must sign the person out. */
export async function verifyPin(pin: string): Promise<PinResult> {
  const settings = await readSettings();
  if (!settings) return 'ok';
  if ((await hashPin(settings.salt, pin)) === settings.hash) {
    if (settings.failedAttempts !== 0) await writeSettings({ ...settings, failedAttempts: 0 });
    return 'ok';
  }
  const failedAttempts = settings.failedAttempts + 1;
  await writeSettings({ ...settings, failedAttempts });
  return failedAttempts >= MAX_PIN_ATTEMPTS ? 'too-many' : 'wrong';
}

/** Biometric unlock through the system prompt; false if cancelled or unavailable (the PIN still works). */
export async function unlockWithBiometrics(promptMessage: string): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    disableDeviceFallback: true,
  });
  return result.success;
}
