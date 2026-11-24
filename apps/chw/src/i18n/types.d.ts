import type { Messages } from '@jorapha/i18n';

// Type-safe keys: t('mobile.chw.title') is checked against packages/i18n/locales/fr.json.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: Messages };
    returnNull: false;
  }
}
