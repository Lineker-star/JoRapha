import { open } from '@op-engineering/op-sqlite';
import { PowerSyncDatabase } from '@powersync/react-native';
import { NativeModules } from 'react-native';

import { type KeyFormat, rekeyToRawStatement, sqlcipherKey } from '../lib/dbKey';
import {
  getDatabaseKey,
  getKeyFormat,
  isDatabaseCreated,
  markDatabaseCreated,
  setKeyFormatRaw,
} from '../lib/deviceIdentity';
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

/**
 * One-time switch of an existing passphrase-keyed database to the raw form of the same key (src/lib/dbKey.ts),
 * before PowerSync opens any connection. Runs on a single connection: the WAL is checkpointed and the journal set
 * to DELETE so the re-key covers the whole file; PowerSync switches back to WAL when it opens. Any failure keeps
 * the legacy passphrase form (slower start, nothing lost) and is retried at the next launch.
 */
async function resolveKeyFormat(hexKey: string): Promise<KeyFormat> {
  if ((await getKeyFormat()) === 'raw') return 'raw';
  if (!(await isDatabaseCreated())) {
    await setKeyFormatRaw(); // new database: raw key from the start
    return 'raw';
  }
  const location = databaseLocation();
  try {
    const legacy = open({
      name: DB_FILENAME,
      ...(location ? { location } : {}),
      encryptionKey: sqlcipherKey(hexKey, 'passphrase'),
    });
    try {
      legacy.executeSync('SELECT count(*) FROM sqlite_master'); // proves the old key opens it
      legacy.executeSync('PRAGMA wal_checkpoint(TRUNCATE)');
      legacy.executeSync('PRAGMA journal_mode = DELETE');
      legacy.executeSync(rekeyToRawStatement(hexKey));
    } finally {
      legacy.close();
    }
    await setKeyFormatRaw();
    console.warn('[startup] database re-keyed to raw key');
    return 'raw';
  } catch (error) {
    console.warn(
      '[startup] re-key skipped, keeping passphrase key:',
      error instanceof Error ? error.message : 'unknown',
    );
    return 'passphrase';
  }
}

/** Opens the SQLCipher-encrypted PowerSync database (key from the secure store) and proves it is encrypted. */
export async function openDatabase(): Promise<PowerSyncDatabase> {
  if (instance) return instance;
  const hexKey = await getDatabaseKey();
  const format = await resolveKeyFormat(hexKey);
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
