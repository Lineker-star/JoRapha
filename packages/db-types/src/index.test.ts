import { describe, expect, expectTypeOf, it } from 'vitest';

import { PACKAGE_NAME, type Database } from './index';

describe('@jorapha/db-types', () => {
  it('exposes its package name', () => {
    expect(PACKAGE_NAME).toBe('@jorapha/db-types');
  });

  it('exports a Database type with a public schema', () => {
    expectTypeOf<Database>().toHaveProperty('public');
  });
});
