import * as Crypto from 'expo-crypto';

import { secureStorage } from './secureStorage';

const KEY_DB = 'jorapha.db.key';
const KEY_DB_CREATED = 'jorapha.db.created';
const KEY_DEVICE = 'jorapha.device.id';

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export class DatabaseKeyLostError extends Error {}

/**
 * SQLCipher key: 256 random bits generated on first launch, kept only in the Android Keystore-backed secure
 * store, never sent anywhere. If the key is missing although a database was already created, we FAIL instead of
 * generating a new one: a new key would silently make the existing database (and its pending queue) unreadable.
 */
export async function getDatabaseKey(): Promise<string> {
  const existing = await secureStorage.getItem(KEY_DB);
  if (existing) return existing;
  if ((await secureStorage.getItem(KEY_DB_CREATED)) !== null) {
    throw new DatabaseKeyLostError('database key missing for an existing database');
  }
  const key = toHex(await Crypto.getRandomBytesAsync(32));
  await secureStorage.setItem(KEY_DB, key);
  return key;
}

export async function markDatabaseCreated(): Promise<void> {
  await secureStorage.setItem(KEY_DB_CREATED, '1');
}

/** Stable device id (unit of revocation, identity.device_registration). */
export async function getDeviceId(): Promise<string> {
  const existing = await secureStorage.getItem(KEY_DEVICE);
  if (existing) return existing;
  const id = Crypto.randomUUID();
  await secureStorage.setItem(KEY_DEVICE, id);
  return id;
}

const KEY_DB_FORMAT = 'jorapha.db.keyformat';

/** Whether a database was already created with the current key (see getDatabaseKey). */
export async function isDatabaseCreated(): Promise<boolean> {
  return (await secureStorage.getItem(KEY_DB_CREATED)) !== null;
}

/** How the key is handed to SQLCipher (src/lib/dbKey.ts). Absent = legacy passphrase form. */
export async function getKeyFormat(): Promise<'passphrase' | 'raw'> {
  return (await secureStorage.getItem(KEY_DB_FORMAT)) === 'raw' ? 'raw' : 'passphrase';
}

export async function setKeyFormatRaw(): Promise<void> {
  await secureStorage.setItem(KEY_DB_FORMAT, 'raw');
}
