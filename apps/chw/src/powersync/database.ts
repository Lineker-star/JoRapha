import { PowerSyncDatabase } from '@powersync/react-native';

import { getDatabaseKey } from '../lib/deviceIdentity';
import { AppSchema } from './schema';

let instance: PowerSyncDatabase | null = null;

/** Opens the SQLCipher-encrypted PowerSync database (key from the secure store). */
export async function openDatabase(): Promise<PowerSyncDatabase> {
  if (instance) return instance;
  const encryptionKey = await getDatabaseKey();
  instance = new PowerSyncDatabase({
    schema: AppSchema,
    database: {
      dbFilename: 'jorapha-chw.sqlite',
      sqliteOptions: { encryptionKey },
    },
  });
  await instance.init();
  return instance;
}

/** Device revoked or sign-out: disconnect and erase every local row (OFF-007, remote purge). */
export async function purgeDatabase(): Promise<void> {
  if (!instance) return;
  await instance.disconnectAndClear();
}
