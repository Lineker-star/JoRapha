import { getTranslations } from 'next-intl/server';

import { AuthCard } from '@/components/auth/AuthCard';
import { FormMessage } from '@/components/auth/FormParts';
import { SignInForms } from '@/components/auth/SignInForms';
import { resolveLocaleParam, type LocaleParams } from '@/i18n/params';
import { safeNextPath } from '@/lib/access';

type Props = LocaleParams & {
  searchParams: Promise<{ next?: string; tab?: string; error?: string }>;
};

export default async function SignInPage({ params, searchParams }: Props) {
  const locale = await resolveLocaleParam(params);
  const { next, tab, error } = await searchParams;
  const t = await getTranslations('auth');
  const nextPath = safeNextPath(next) ?? `/${locale}`;
  // Coming from a staff area (or ?tab=staff) opens the staff form; patients are the default.
  const staff = tab === 'staff' || /^\/[a-z]{2}\/(clinician|facility|admin)(\/|$)/.test(nextPath);

  return (
    <AuthCard title={t('signIn.title')}>
      {error === 'link' ? <FormMessage tone="error">{t('errors.linkInvalid')}</FormMessage> : null}
      <SignInForms locale={locale} next={nextPath} initialTab={staff ? 'staff' : 'patient'} />
    </AuthCard>
  );
}
