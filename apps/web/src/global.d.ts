import type { Locale, Messages } from '@jorapha/i18n';

// Type-safe translation keys: t('home.title') is checked against packages/i18n/locales/fr.json.
declare module 'next-intl' {
  interface AppConfig {
    Locale: Locale;
    Messages: Messages;
  }
}
