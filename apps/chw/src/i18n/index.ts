import { resolveLocale } from '@jorapha/i18n';
import { getLocales } from 'expo-localization';

import { createI18n } from './createI18n';

/** App-wide i18next instance, starting in the device language (French unless the device is English). */
export const i18n = createI18n(resolveLocale(getLocales()[0]?.languageTag));
