import { open } from '@op-engineering/op-sqlite';
import { PowerSyncDatabase } from '@powersync/react-native';
import { NativeModules } from 'react-native';

import { type KeyFormat, rekeyToRawStatement, sqlcipherKey } from '../lib/dbKey';
import { getDatabaseKey, markDatabaseCreated } from '../lib/deviceIdentity';
import { AppSchema } from './schema';

const DB_FILENAME = 'jorapha-chw.sqlite';

let instance: PowerSyncDatabase | null = null;
let cipherVersion: string | null = null;

export class EncryptionInactiveError extends Error {}

/** Same file location PowerSync's op-sqlite adapter uses (it may point at a legacy path on Android). */
function databaseLocation(): string | undefined {
  const helper = NativeModules.NativePowerSyncHelper as
    { resolveDefaultDatabaseLocation?: (name: string) => string | null } | undefined;
  return helper?.resolveDefaultDatabaseLocation?.(DB_FILENAME) ?? undefined;
}

/** True when this key opens the database file (an absent file is created, which is fine for a new install). */
function opensWith(key: string, location: string | undefined): boolean {
  try {
    const db = open({ name: DB_FILENAME, ...(location ? { location } : {}), encryptionKey: key });
    try {
      db.executeSync('SELECT count(*) FROM sqlite_master');
      return true;
    } finally {
      db.close();
    }
  } catch {
    return false;
  }
}

/**
 * Decides how the key is handed to SQLCipher by probing the file itself, never by trusting a stored marker, so a
 * crash at any point of the one-time switch heals at the next launch (security review, 2026-11-27):
 *  1. the raw key opens it (new install, or already switched): raw;
 *  2. the legacy passphrase opens it: switch once to the raw key on a single connection (WAL checkpointed,
 *     journal DELETE; PowerSync turns WAL back on), then confirm the raw key opens it;
 *     if the switch fails, keep the passphrase form (slower start, nothing lost);
 *  3. neither opens it: the key does not match the file; refuse to run (encryption error screen).
 * Runs before PowerSync opens any connection. Logs carry the error type only, never key material.
 */
function resolveKeyFormat(hexKey: string): KeyFormat {
  const location = databaseLocation();
  if (opensWith(sqlcipherKey(hexKey, 'raw'), location)) return 'raw';
  if (!opensWith(sqlcipherKey(hexKey, 'passphrase'), location)) {
    throw new EncryptionInactiveError('database key does not open the local database');
  }
  try {
    const legacy = open({
      name: DB_FILENAME,
      ...(location ? { location } : {}),
      encryptionKey: sqlcipherKey(hexKey, 'passphrase'),
    });
    try {
      legacy.executeSync('PRAGMA wal_checkpoint(TRUNCATE)');
      const mode = legacy.executeSync('PRAGMA journal_mode = DELETE').rows[0] as
        { journal_mode?: string } | undefined;
      // Re-key only outside WAL (offline-sync review): if the switch did not take, keep the passphrase form.
      if (String(mode?.journal_mode).toLowerCase() !== 'delete') {
        console.warn('[startup] re-key skipped: journal mode is not DELETE');
        return 'passphrase';
      }
      legacy.executeSync(rekeyToRawStatement(hexKey));
    } finally {
      legacy.close();
    }
  } catch (error) {
    console.warn(
      '[startup] re-key failed, keeping passphrase key:',
      error instanceof Error ? error.name : 'unknown',
    );
    return opensWith(sqlcipherKey(hexKey, 'raw'), location) ? 'raw' : 'passphrase';
  }
  if (opensWith(sqlcipherKey(hexKey, 'raw'), location)) {
    console.warn('[startup] database re-keyed to raw key');
    return 'raw';
  }
  return 'passphrase';
}

/** Opens the SQLCipher-encrypted PowerSync database (key from the secure store) and proves it is encrypted. */
export async function openDatabase(): Promise<PowerSyncDatabase> {
  if (instance) return instance;
  const hexKey = await getDatabaseKey();
  const format = resolveKeyFormat(hexKey);
  const db = new PowerSyncDatabase({
    schema: AppSchema,
    database: {
      dbFilename: DB_FILENAME,
      sqliteOptions: { encryptionKey: sqlcipherKey(hexKey, format) },
    },
  });
  await db.init();
  // SQLCipher answers PRAGMA cipher_version; plain SQLite returns nothing. Never run unencrypted (OFF-007).
  const row = await db.getOptional<{ cipher_version: string }>('PRAGMA cipher_version');
  if (!row?.cipher_version) {
    await db.close();
    throw new EncryptionInactiveError('SQLCipher is not active');
  }
  cipherVersion = row.cipher_version;
  await markDatabaseCreated();
  instance = db;
  return db;
}

export function getCipherVersion(): string | null {
  return cipherVersion;
}

/** Count of local writes not yet accepted by the server (PowerSync upload queue). */
export async function pendingUploads(db: PowerSyncDatabase): Promise<number> {
  const row = await db.get<{ n: number }>('SELECT count(*) AS n FROM ps_crud');
  return row.n;
}

/** Device revoked or sign-out with an empty queue: disconnect and erase every local row (OFF-007). */
export async function purgeDatabase(): Promise<void> {
  if (!instance) return;
  await instance.disconnectAndClear();
}
