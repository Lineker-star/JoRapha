import { getTranslations } from 'next-intl/server';

import { AuthCard } from '@/components/auth/AuthCard';
import { Link } from '@/i18n/navigation';
import { resolveLocaleParam, type LocaleParams } from '@/i18n/params';

export default async function NoAccessPage({ params }: LocaleParams) {
  await resolveLocaleParam(params);
  const t = await getTranslations();
  return (
    <AuthCard title={t('auth.noAccess.title')}>
      <p className="text-ink-600">{t('auth.noAccess.body')}</p>
      <Link href="/" className="mt-4 inline-block font-medium text-brand-700 hover:underline">
        {t('common.backHome')}
      </Link>
    </AuthCard>
  );
}
