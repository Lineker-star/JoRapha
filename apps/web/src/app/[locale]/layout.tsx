import type { Metadata } from 'next';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';

import { AccountLink } from '@/components/auth/AccountLink';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { Link } from '@/i18n/navigation';
import { resolveLocaleParam, type LocaleParams } from '@/i18n/params';
import { routing } from '@/i18n/routing';

import '../globals.css';

export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale });
  return { title: t('common.appName'), description: t('common.tagline') };
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleParams & { children: ReactNode }) {
  const locale = await resolveLocaleParam(params);
  const t = await getTranslations();

  return (
    <html lang={locale}>
      <body className="min-h-screen font-sans antialiased">
        <NextIntlClientProvider>
          <header className="border-b border-slate-200">
            <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
              <Link href="/" className="text-lg font-semibold text-brand-700">
                {t('common.appName')}
              </Link>
              <div className="flex items-center gap-2">
                <AccountLink />
                <LocaleSwitcher />
              </div>
            </div>
          </header>
          <main>{children}</main>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
