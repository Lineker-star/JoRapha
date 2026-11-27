'use client';

import type { Locale } from '@jorapha/i18n';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

import { type FormState, requestPasswordReset, updatePassword } from '@/lib/auth/actions';

import { Field, FormMessage, SubmitButton } from './FormParts';

const empty: FormState = {};

export function RecoverForm({ locale }: { locale: Locale }) {
  const t = useTranslations('auth');
  const [state, action] = useActionState(requestPasswordReset, empty);
  if (state.sent) return <FormMessage tone="info">{t('recover.sent')}</FormMessage>;
  return (
    <form action={action} className="space-y-4">
      <p className="text-ink-600">{t('recover.intro')}</p>
      <input type="hidden" name="locale" value={locale} />
      <Field label={t('signIn.email')} name="email" type="email" autoComplete="email" required />
      {state.error ? <FormMessage tone="error">{t(`errors.${state.error}`)}</FormMessage> : null}
      <SubmitButton>{t('recover.submit')}</SubmitButton>
    </form>
  );
}

export function NewPasswordForm({ locale }: { locale: Locale }) {
  const t = useTranslations('auth');
  const [state, action] = useActionState(updatePassword, empty);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <Field
        label={t('password.password')}
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={12}
        required
      />
      <Field
        label={t('password.confirm')}
        name="confirm"
        type="password"
        autoComplete="new-password"
        minLength={12}
        required
      />
      {state.error ? <FormMessage tone="error">{t(`errors.${state.error}`)}</FormMessage> : null}
      <SubmitButton>{t('password.submit')}</SubmitButton>
    </form>
  );
}
