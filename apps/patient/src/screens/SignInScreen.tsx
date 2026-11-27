import { normalizeCameroonPhone } from '@jorapha/domain';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Field, Message, PrimaryButton, SecondaryButton } from '../components/ui';
import { AUTH_CALLBACK_URL } from '../config';
import { supabase } from '../lib/supabase';

type ErrorKey = 'invalidPhone' | 'invalidEmail' | 'invalidCode' | 'tryAgain' | 'linkInvalid';

/**
 * Patient sign-in (Step 2.1): SMS code to a Cameroon number, or an e-mail link that opens the app
 * (jorapha-patient://auth/callback). Answers never reveal whether an account exists.
 */
export function SignInScreen({ linkError }: { linkError: boolean }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'phone' | 'email'>('phone');
  const [phoneInput, setPhoneInput] = useState('');
  const [phone, setPhone] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [linkSent, setLinkSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrorKey | null>(linkError ? 'linkInvalid' : null);

  async function sendCode() {
    const normalized = normalizeCameroonPhone(phoneInput);
    if (!normalized) return setError('invalidPhone');
    setBusy(true);
    setError(null);
    const { error: otpError } = await supabase.auth.signInWithOtp({ phone: normalized });
    setBusy(false);
    if (otpError) return setError('tryAgain');
    setPhone(normalized);
  }

  async function verifyCode() {
    if (!phone || !/^\d{6}$/.test(code.trim())) return setError('invalidCode');
    setBusy(true);
    setError(null);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      phone,
      token: code.trim(),
      type: 'sms',
    });
    setBusy(false);
    if (verifyError) setError('invalidCode');
    // Success: onAuthStateChange in app/index.tsx shows the app.
  }

  async function sendLink() {
    const value = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return setError('invalidEmail');
    setBusy(true);
    setError(null);
    await supabase.auth.signInWithOtp({
      email: value,
      options: { emailRedirectTo: AUTH_CALLBACK_URL },
    });
    setBusy(false);
    setLinkSent(true); // same answer whether or not the address has an account
  }

  const tab = (value: 'phone' | 'email', label: string) => (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: mode === value }}
      onPress={() => {
        setMode(value);
        setError(null);
      }}
      className={`min-h-12 flex-1 items-center justify-center rounded-xl ${mode === value ? 'bg-brand-600' : 'bg-ink-100'}`}
    >
      <Text className={mode === value ? 'font-semibold text-white' : 'text-ink-900'}>{label}</Text>
    </Pressable>
  );

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView contentContainerClassName="gap-4 px-6 pb-10 pt-10">
        <Text accessibilityRole="header" className="text-2xl font-bold text-ink-900">
          {t('mobile.auth.signIn.title')}
        </Text>
        <Text className="text-ink-600">{t('mobile.auth.signIn.intro')}</Text>
        <Text className="text-sm text-ink-600">{t('mobile.auth.signIn.needsNetwork')}</Text>
        <View className="flex-row gap-2">
          {tab('phone', t('mobile.auth.signIn.byPhone'))}
          {tab('email', t('mobile.auth.signIn.byEmail'))}
        </View>

        {mode === 'phone' && !phone ? (
          <>
            <Field
              label={t('mobile.auth.signIn.phone')}
              keyboardType="phone-pad"
              autoComplete="tel"
              value={phoneInput}
              onChangeText={setPhoneInput}
            />
            <Text className="text-sm text-ink-600">{t('mobile.auth.signIn.phoneHint')}</Text>
            <PrimaryButton
              label={t('mobile.auth.signIn.sendCode')}
              onPress={() => void sendCode()}
              disabled={busy}
            />
          </>
        ) : null}

        {mode === 'phone' && phone ? (
          <>
            <Message tone="info">{t('mobile.auth.signIn.codeSent')}</Message>
            <Field
              label={t('mobile.auth.signIn.code')}
              keyboardType="number-pad"
              autoComplete="sms-otp"
              textContentType="oneTimeCode"
              maxLength={6}
              value={code}
              onChangeText={setCode}
            />
            <PrimaryButton
              label={t('mobile.auth.signIn.verify')}
              onPress={() => void verifyCode()}
              disabled={busy}
            />
            <SecondaryButton
              label={t('mobile.auth.signIn.changeNumber')}
              onPress={() => {
                setPhone(null);
                setCode('');
              }}
            />
          </>
        ) : null}

        {mode === 'email' && !linkSent ? (
          <>
            <Field
              label={t('mobile.auth.signIn.email')}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
            />
            <PrimaryButton
              label={t('mobile.auth.signIn.sendLink')}
              onPress={() => void sendLink()}
              disabled={busy}
            />
          </>
        ) : null}
        {mode === 'email' && linkSent ? (
          <Message tone="info">{t('mobile.auth.signIn.linkSent')}</Message>
        ) : null}

        {error ? <Message tone="error">{t(`mobile.auth.errors.${error}`)}</Message> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
