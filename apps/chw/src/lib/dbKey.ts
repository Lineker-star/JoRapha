/**
 * SQLCipher key material (pure; tested in dbKey.test.ts).
 *
 * The database key is 256 random bits (64 hex characters) from the secure store. Given as a passphrase, SQLCipher 4
 * runs 256 000 PBKDF2 rounds on EVERY connection, and PowerSync opens several: opening took 5.4-6.3 s on the
 * emulator (2026-11-27), over the 5 s cold-start budget. Key stretching only protects human-chosen passwords; a
 * random 256-bit key is used directly as a SQLCipher raw key (x'<64 hex>'), which skips PBKDF2 with the same
 * strength. Owner approval: 2026-11-27.
 */
export type KeyFormat = 'passphrase' | 'raw';

const HEX_KEY = /^[0-9a-f]{64}$/i;

/** The string handed to SQLCipher (sqlite3_key) for this key and format. */
export function sqlcipherKey(hexKey: string, format: KeyFormat): string {
  if (!HEX_KEY.test(hexKey)) throw new Error('database key must be 64 hex characters');
  return format === 'raw' ? `x'${hexKey}'` : hexKey;
}

/** `PRAGMA rekey` statement switching an open passphrase-keyed database to the raw form of the same key. */
export function rekeyToRawStatement(hexKey: string): string {
  return `PRAGMA rekey = "${sqlcipherKey(hexKey, 'raw')}"`;
}
