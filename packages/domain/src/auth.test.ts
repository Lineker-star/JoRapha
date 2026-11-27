import { describe, expect, it } from 'vitest';

import { isAcceptablePin, MAX_PIN_ATTEMPTS, RELOCK_AFTER_MS, shouldLock } from './appLock';
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
  });
});

describe('isAcceptablePin', () => {
  it('accepts 4 to 6 digits that are not trivial', () => {
    expect(isAcceptablePin('2580')).toBe(true);
    expect(isAcceptablePin('739104')).toBe(true);
  });

  it('refuses wrong lengths, repeats and simple runs', () => {
    for (const pin of [
      '123',
      '1234567',
      'abcd',
      '0000',
      '1111',
      '1234',
      '4321',
      '98765',
      '012345',
    ]) {
      expect(isAcceptablePin(pin), pin).toBe(false);
    }
  });
});

describe('shouldLock', () => {
  const now = 1_000_000_000;

  it('never locks when the lock is off', () => {
    expect(shouldLock(false, null, now)).toBe(false);
  });

  it('locks at every cold start and after a long absence', () => {
    expect(shouldLock(true, null, now)).toBe(true);
    expect(shouldLock(true, now - RELOCK_AFTER_MS, now)).toBe(true);
  });

  it('does not lock after a short switch to another app', () => {
    expect(shouldLock(true, now - 10_000, now)).toBe(false);
  });

  it('locks when the clock moved backwards', () => {
    expect(shouldLock(true, now + 60_000, now)).toBe(true);
  });

  it('limits wrong PIN attempts', () => {
    expect(MAX_PIN_ATTEMPTS).toBeGreaterThanOrEqual(3);
  });
});
