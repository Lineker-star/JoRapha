'use client';

import type { Locale } from '@jorapha/i18n';
import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';

import { Link } from '@/i18n/navigation';
import {
  type FormState,
  requestEmailLink,
  requestPhoneOtp,
  signInWithPassword,
  verifyPhoneOtp,
} from '@/lib/auth/actions';

import { Field, FormMessage, SubmitButton } from './FormParts';
import { Turnstile } from './Turnstile';

const empty: FormState = {};

function StaffForm({ locale, next }: { locale: Locale; next: string }) {
  const t = useTranslations('auth');
  const [state, action] = useActionState(signInWithPassword, empty);
  return (
    <form action={action} className="space-y-4">
      <p className="text-ink-600">{t('signIn.staffIntro')}</p>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="next" value={next} />
      <Field label={t('signIn.email')} name="email" type="email" autoComplete="username" required />
      <Field
        label={t('signIn.password')}
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      {state.error ? <FormMessage tone="error">{t(`errors.${state.error}`)}</FormMessage> : null}
      <Turnstile />
      <SubmitButton>{t('signIn.submit')}</SubmitButton>
      <Link
        href="/recover"
        className="inline-block text-sm font-medium text-brand-700 hover:underline"
      >
        {t('signIn.forgot')}
      </Link>
    </form>
  );
}

function PhoneForm({ locale, next }: { locale: Locale; next: string }) {
  const t = useTranslations('auth');
  const [requested, request] = useActionState(requestPhoneOtp, empty);
  const [verified, verify] = useActionState(verifyPhoneOtp, empty);
  const phone = verified.phone ?? requested.phone;
  if (!requested.sent || !phone) {
    return (
      <form action={request} className="space-y-4">
        <Field
          label={t('signIn.phone')}
          hint={t('signIn.phoneHint')}
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          required
        />
        {requested.error ? (
          <FormMessage tone="error">{t(`errors.${requested.error}`)}</FormMessage>
        ) : null}
        <Turnstile />
        <SubmitButton>{t('signIn.sendCode')}</SubmitButton>
      </form>
    );
  }
  return (
    <form action={verify} className="space-y-4">
      <FormMessage tone="info">{t('signIn.codeSent')}</FormMessage>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="phone" value={phone} />
      <Field
        label={t('signIn.code')}
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d{6}"
        maxLength={6}
        required
      />
      {verified.error ? (
        <FormMessage tone="error">{t(`errors.${verified.error}`)}</FormMessage>
      ) : null}
      <SubmitButton>{t('signIn.verifyCode')}</SubmitButton>
    </form>
  );
}

function EmailLinkForm({ locale, next }: { locale: Locale; next: string }) {
  const t = useTranslations('auth');
  const [state, action] = useActionState(requestEmailLink, empty);
  if (state.sent) return <FormMessage tone="info">{t('signIn.linkSent')}</FormMessage>;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="next" value={next} />
      <Field label={t('signIn.email')} name="email" type="email" autoComplete="email" required />
      {state.error ? <FormMessage tone="error">{t(`errors.${state.error}`)}</FormMessage> : null}
      <Turnstile />
      <SubmitButton>{t('signIn.sendLink')}</SubmitButton>
    </form>
  );
}

type Tab = 'staff' | 'patient';

function TabButton({
  selected,
  onSelect,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      className={`min-h-12 flex-1 rounded-lg px-3 font-medium ${selected ? 'bg-brand-600 text-white' : 'text-ink-600 hover:bg-surface-muted'}`}
    >
      {children}
    </button>
  );
}

export function SignInForms({
  locale,
  next,
  initialTab,
}: {
  locale: Locale;
  next: string;
  initialTab: Tab;
}) {
  const t = useTranslations('auth');
  const [tab, setTab] = useState<Tab>(initialTab);
  const [patientMode, setPatientMode] = useState<'phone' | 'email'>('phone');
  return (
    <div className="space-y-6">
      <div role="tablist" className="flex gap-2 rounded-xl bg-surface-muted p-1">
        <TabButton selected={tab === 'patient'} onSelect={() => setTab('patient')}>
          {t('signIn.patientTab')}
        </TabButton>
        <TabButton selected={tab === 'staff'} onSelect={() => setTab('staff')}>
          {t('signIn.staffTab')}
        </TabButton>
      </div>
      {tab === 'staff' ? (
        <StaffForm locale={locale} next={next} />
      ) : (
        <div className="space-y-4">
          <p className="text-ink-600">{t('signIn.patientIntro')}</p>
          <div role="tablist" className="flex gap-2">
            <TabButton selected={patientMode === 'phone'} onSelect={() => setPatientMode('phone')}>
              {t('signIn.byPhone')}
            </TabButton>
            <TabButton selected={patientMode === 'email'} onSelect={() => setPatientMode('email')}>
              {t('signIn.byEmail')}
            </TabButton>
          </div>
          {patientMode === 'phone' ? (
            <PhoneForm locale={locale} next={next} />
          ) : (
            <EmailLinkForm locale={locale} next={next} />
          )}
        </div>
      )}
    </div>
  );
}
