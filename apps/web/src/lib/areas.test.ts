import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { messages } from '@jorapha/i18n';
import { describe, expect, it } from 'vitest';

import { routing } from '../i18n/routing';
import { areaHref, areas } from './areas';

describe('web areas', () => {
  it('has the four areas from the playbook', () => {
    expect(areas.map((a) => a.id)).toEqual(['patient', 'clinician', 'facility', 'admin']);
  });

  it('has a title and description for every area in every locale', () => {
    for (const locale of routing.locales) {
      for (const { id } of areas) {
        expect(messages[locale].areas[id].title.length).toBeGreaterThan(0);
        expect(messages[locale].areas[id].description.length).toBeGreaterThan(0);
      }
    }
  });

  it('points every area at an image that exists', () => {
    for (const { image } of areas) {
      const file = fileURLToPath(new URL(`../../public${image}`, import.meta.url));
      expect(existsSync(file), image).toBe(true);
    }
  });

  it('builds unprefixed hrefs (next-intl adds the locale)', () => {
    expect(areaHref('admin')).toBe('/admin');
  });

  it('routes fr by default with an always-visible locale prefix', () => {
    expect(routing.defaultLocale).toBe('fr');
    expect(routing.locales).toEqual(['fr', 'en']);
    expect(routing.localePrefix).toBe('always');
  });
});
