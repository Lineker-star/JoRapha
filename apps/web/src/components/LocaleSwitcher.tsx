'use client';

import { useLocale, useTranslations } from 'next-intl';

import { Link, usePathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

export function LocaleSwitcher() {
  const t = useTranslations();
  const current = useLocale();
  const pathname = usePathname();

  return (
    <nav aria-label={t('common.language')} className="flex gap-1 text-sm">
      {routing.locales.map((locale) => (
        <Link
          key={locale}
          href={pathname}
          locale={locale}
          aria-current={locale === current ? 'true' : undefined}
          className={
            locale === current
              ? 'rounded-md bg-brand-600 px-3 py-2 font-medium text-white'
              : 'rounded-md px-3 py-2 text-ink-600 hover:bg-surface-muted'
          }
        >
          {t(`locales.${locale}`)}
        </Link>
      ))}
    </nav>
  );
}
