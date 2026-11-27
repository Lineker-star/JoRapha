import { describe, expect, it } from 'vitest';

import { normalizeCameroonPhone } from './phone';

describe('normalizeCameroonPhone', () => {
  it('accepts national and international forms', () => {
    expect(normalizeCameroonPhone('650000001')).toBe('+237650000001');
    expect(normalizeCameroonPhone('+237 6 50 00 00 01')).toBe('+237650000001');
    expect(normalizeCameroonPhone('00237-650-000-001')).toBe('+237650000001');
    expect(normalizeCameroonPhone('222 00 00 00')).toBe('+237222000000');
  });

  it('refuses other countries and malformed numbers', () => {
    expect(normalizeCameroonPhone('+33612345678')).toBeNull();
    expect(normalizeCameroonPhone('65000001')).toBeNull();
    expect(normalizeCameroonPhone('750000001')).toBeNull();
    expect(normalizeCameroonPhone('')).toBeNull();
  });
});
