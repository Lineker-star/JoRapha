import { getTranslations } from 'next-intl/server';

import { RecoverForm } from '@/components/auth/AccountForms';
import { AuthCard } from '@/components/auth/AuthCard';
import { resolveLocaleParam, type LocaleParams } from '@/i18n/params';

/** Password reset request. The answer is the same whether or not the address has an account. */
export default async function RecoverPage({ params }: LocaleParams) {
  const locale = await resolveLocaleParam(params);
  const t = await getTranslations('auth');
  return (
    <AuthCard title={t('recover.title')}>
      <RecoverForm locale={locale} />
    </AuthCard>
  );
}
