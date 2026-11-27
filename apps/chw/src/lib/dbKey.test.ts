import { describe, expect, it } from 'vitest';

import { rekeyToRawStatement, sqlcipherKey } from './dbKey';

const key = 'ab'.repeat(32);

describe('sqlcipherKey', () => {
  it('passes the hex key unchanged as a passphrase (legacy databases)', () => {
    expect(sqlcipherKey(key, 'passphrase')).toBe(key);
  });

  it("wraps the key as a SQLCipher raw key x'…' (no PBKDF2)", () => {
    expect(sqlcipherKey(key, 'raw')).toBe(`x'${key}'`);
  });

  it('refuses anything that is not a 256-bit hex key (no quoting tricks in PRAGMA rekey)', () => {
    expect(() => sqlcipherKey('short', 'raw')).toThrow();
    expect(() => sqlcipherKey(`${'a'.repeat(63)}'`, 'raw')).toThrow();
  });
});

describe('rekeyToRawStatement', () => {
  it('builds the PRAGMA rekey statement for the raw key', () => {
    expect(rekeyToRawStatement(key)).toBe(`PRAGMA rekey = "x'${key}'"`);
  });
});
