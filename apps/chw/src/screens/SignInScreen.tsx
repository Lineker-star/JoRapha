import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../lib/supabase';

export function SignInScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function signIn() {
    setBusy(true);
    setFailed(false);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setFailed(true);
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="gap-4 px-6 pt-10">
        <Text accessibilityRole="header" className="text-2xl font-bold text-ink-900">
          {t('chw.signIn.title')}
        </Text>
        <Text className="text-ink-600">{t('chw.signIn.firstSignInNeedsNetwork')}</Text>
        <TextInput
          accessibilityLabel={t('chw.signIn.email')}
          placeholder={t('chw.signIn.email')}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          value={email}
          onChangeText={setEmail}
          className="min-h-12 rounded-xl border border-ink-200 px-4 text-base"
        />
        <TextInput
          accessibilityLabel={t('chw.signIn.password')}
          placeholder={t('chw.signIn.password')}
          secureTextEntry
          autoComplete="password"
          value={password}
          onChangeText={setPassword}
          className="min-h-12 rounded-xl border border-ink-200 px-4 text-base"
        />
        {failed ? <Text className="text-red-700">{t('chw.signIn.error')}</Text> : null}
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void signIn()}
          className="min-h-12 items-center justify-center rounded-xl bg-brand-600 px-5 active:bg-brand-700"
        >
          <Text className="text-base font-semibold text-white">{t('chw.signIn.submit')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
