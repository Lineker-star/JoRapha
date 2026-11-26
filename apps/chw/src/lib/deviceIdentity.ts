import * as Crypto from 'expo-crypto';

import { secureStorage } from './secureStorage';

const KEY_DB = 'jorapha.db.key';
const KEY_DEVICE = 'jorapha.device.id';

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * SQLCipher key: 256 random bits generated on first launch, kept only in the Android Keystore-backed
 * secure store, never sent anywhere. Losing it (app reinstall) means the local database is unreadable,
 * which is the intended behaviour for a lost or wiped device.
 */
export async function getDatabaseKey(): Promise<string> {
  const existing = await secureStorage.getItem(KEY_DB);
  if (existing) return existing;
  const key = toHex(await Crypto.getRandomBytesAsync(32));
  await secureStorage.setItem(KEY_DB, key);
  return key;
}

/** Stable device id (unit of revocation, identity.device_registration). */
export async function getDeviceId(): Promise<string> {
  const existing = await secureStorage.getItem(KEY_DEVICE);
  if (existing) return existing;
  const id = Crypto.randomUUID();
  await secureStorage.setItem(KEY_DEVICE, id);
  return id;
}

export async function forgetLocalSecrets(): Promise<void> {
  await secureStorage.removeItem(KEY_DB);
}
