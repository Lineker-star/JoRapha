import { defaultLocale, locales, messages, type Locale } from '@jorapha/i18n';
import { createInstance, type i18n } from 'i18next';

/**
 * Creates an i18next instance backed by the shared @jorapha/i18n messages.
 * Pure (no React Native imports) so it can be unit-tested with Vitest.
 */
export function createI18n(locale: Locale): i18n {
  const instance = createInstance();
  void instance.init({
    lng: locale,
    fallbackLng: defaultLocale,
    supportedLngs: [...locales],
    resources: Object.fromEntries(locales.map((l) => [l, { translation: messages[l] }])),
    interpolation: { escapeValue: false }, // React already escapes.
    initAsync: false, // Resources are bundled: initialise synchronously so the first render is translated.
    returnNull: false,
  });
  return instance;
}
