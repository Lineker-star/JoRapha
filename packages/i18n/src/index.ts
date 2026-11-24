/**
 * @jorapha/i18n — FR/EN UI strings and locale utilities, shared by web (next-intl) and mobile (i18next).
 * French is the default locale. Fulfulde and Gbaya are content packs (Phase 5), not UI locales yet.
 */
import en from '../locales/en.json';
import fr from '../locales/fr.json';

export const PACKAGE_NAME = '@jorapha/i18n' as const;

export const locales = ['fr', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'fr';

/** The French file is the reference shape; the parity test keeps en.json identical in keys. */
export type Messages = typeof fr;

export const messages: Record<Locale, Messages> = { fr, en };

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (locales as readonly string[]).includes(value);
}

/** Picks a supported locale from a device/browser tag such as "fr-CM" or "en-US"; falls back to French. */
export function resolveLocale(tag: string | null | undefined): Locale {
  const base = tag?.toLowerCase().split(/[-_]/)[0];
  return isLocale(base) ? base : defaultLocale;
}
