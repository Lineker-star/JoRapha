import { redirect as nextRedirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { AuthCard } from '@/components/auth/AuthCard';
import { TotpChallenge, TotpEnroll } from '@/components/auth/TotpForms';
import { redirect } from '@/i18n/navigation';
import { resolveLocaleParam, type LocaleParams } from '@/i18n/params';
import { safeNextPath } from '@/lib/access';
import { getAuthState } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type Props = LocaleParams & { searchParams: Promise<{ next?: string }> };

/** MFA enrolment (first time) or challenge (later sign-ins). Staff areas send people here until aal2. */
export default async function MfaPage({ params, searchParams }: Props) {
  const locale = await resolveLocaleParam(params);
  const { next } = await searchParams;
  const nextPath = safeNextPath(next) ?? `/${locale}`;
  const state = await getAuthState();
  if (!state.signedIn) {
    redirect({ href: `/sign-in?tab=staff&next=${encodeURIComponent(nextPath)}`, locale });
  }

  const supabase = await createSupabaseServerClient();
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === 'aal2') nextRedirect(nextPath);

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const verified = factors?.totp.find((f) => f.status === 'verified');
  const t = await getTranslations('auth');

  return (
    <AuthCard title={t('mfa.title')}>
      {verified ? (
        <TotpChallenge locale={locale} next={nextPath} factorId={verified.id} />
      ) : (
        <TotpEnroll locale={locale} next={nextPath} />
      )}
    </AuthCard>
  );
}
