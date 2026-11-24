import { describe, expect, it } from 'vitest';

import { MIN_TOUCH_TARGET, PACKAGE_NAME, colors } from './index';

function flatten(obj: object): string[] {
  return Object.values(obj).flatMap((v) => (typeof v === 'string' ? [v] : flatten(v as object)));
}

describe('@jorapha/ui', () => {
  it('exposes its package name', () => {
    expect(PACKAGE_NAME).toBe('@jorapha/ui');
  });

  it('defines every colour token as a 6-digit hex value', () => {
    for (const value of flatten(colors)) {
      expect(value).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('defines a colour for each of the five sync states (OFF-006)', () => {
    expect(Object.keys(colors.sync).sort()).toEqual(
      ['conflict', 'pending', 'rejected', 'synced', 'syncing'].sort(),
    );
  });

  it('keeps touch targets at least 48', () => {
    expect(MIN_TOUCH_TARGET).toBeGreaterThanOrEqual(48);
  });
});
