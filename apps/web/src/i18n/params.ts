import type { Locale } from '@jorapha/i18n';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';

import { routing } from './routing';

export type LocaleParams = { params: Promise<{ locale: string }> };

/** Validates the [locale] segment (404 for anything else) and enables static rendering for it. */
export async function resolveLocaleParam(params: LocaleParams['params']): Promise<Locale> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return locale;
}
