import { describe, expect, it } from 'vitest';

import { defaultLocale, isLocale, locales, messages, resolveLocale } from './index';

function keyPaths(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v !== null && typeof v === 'object'
      ? keyPaths(v as object, `${prefix}${k}.`)
      : [`${prefix}${k}`],
  );
}

function leafValues(obj: object): unknown[] {
  return Object.values(obj).flatMap((v) =>
    v !== null && typeof v === 'object' ? leafValues(v as object) : [v],
  );
}

describe('@jorapha/i18n', () => {
  it('supports French (default) and English', () => {
    expect(locales).toEqual(['fr', 'en']);
    expect(defaultLocale).toBe('fr');
  });

  it('has exactly the same keys in every locale', () => {
    const reference = keyPaths(messages.fr).sort();
    for (const locale of locales) {
      expect(keyPaths(messages[locale]).sort(), `keys of ${locale}.json`).toEqual(reference);
    }
  });

  it('has no empty strings', () => {
    for (const locale of locales) {
      for (const value of leafValues(messages[locale])) {
        expect(typeof value === 'string' && value.trim().length > 0).toBe(true);
      }
    }
  });

  it('recognises supported locales only', () => {
    expect(isLocale('fr')).toBe(true);
    expect(isLocale('en')).toBe(true);
    expect(isLocale('de')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });

  it('resolves device tags and falls back to French', () => {
    expect(resolveLocale('en-US')).toBe('en');
    expect(resolveLocale('fr_CM')).toBe('fr');
    expect(resolveLocale('ff-CM')).toBe('fr');
    expect(resolveLocale(null)).toBe('fr');
  });
});
