import { PowerSyncDatabase } from '@powersync/react-native';

import { getDatabaseKey, markDatabaseCreated } from '../lib/deviceIdentity';
import { AppSchema } from './schema';

let instance: PowerSyncDatabase | null = null;
let cipherVersion: string | null = null;

export class EncryptionInactiveError extends Error {}

/** Opens the SQLCipher-encrypted PowerSync database (key from the secure store) and proves it is encrypted. */
export async function openDatabase(): Promise<PowerSyncDatabase> {
  if (instance) return instance;
  const encryptionKey = await getDatabaseKey();
  const db = new PowerSyncDatabase({
    schema: AppSchema,
    database: {
      dbFilename: 'jorapha-chw.sqlite',
      sqliteOptions: { encryptionKey },
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
