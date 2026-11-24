import { describe, expect, it } from 'vitest';

import { PACKAGE_NAME } from './index';

describe('@jorapha/sync', () => {
  it('exposes its package name', () => {
    expect(PACKAGE_NAME).toBe('@jorapha/sync');
  });
});
