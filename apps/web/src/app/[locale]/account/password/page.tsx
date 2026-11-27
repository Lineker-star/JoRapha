import { getTranslations } from 'next-intl/server';

import { NewPasswordForm } from '@/components/auth/AccountForms';
import { AuthCard } from '@/components/auth/AuthCard';
import { redirect } from '@/i18n/navigation';
import { resolveLocaleParam, type LocaleParams } from '@/i18n/params';
import { getAuthState } from '@/lib/auth/session';

/** Reached from a password-reset link (the recovery session is already set by /auth/callback). */
export default async function NewPasswordPage({ params }: LocaleParams) {
  const locale = await resolveLocaleParam(params);
  const state = await getAuthState();
  if (!state.signedIn) redirect({ href: '/recover', locale });
  const t = await getTranslations('auth');
  return (
    <AuthCard title={t('password.title')}>
      <NewPasswordForm locale={locale} />
    </AuthCard>
  );
}
