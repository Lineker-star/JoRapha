import { describe, expect, it } from 'vitest';

import { PACKAGE_NAME } from './index';

describe('@jorapha/fhir', () => {
  it('exposes its package name', () => {
    expect(PACKAGE_NAME).toBe('@jorapha/fhir');
  });
});
