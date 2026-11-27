import { shouldLock } from '@jorapha/domain';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, AppState, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { disableLock, isLockEnabled } from '../src/lib/appLock';
import { registerDevice } from '../src/lib/device';
import { readStoredUserId, supabase } from '../src/lib/supabase';
import { LockScreen } from '../src/screens/LockScreen';
import { SecuritySettings } from '../src/screens/SecuritySettings';
import { SignInScreen } from '../src/screens/SignInScreen';

const helloImage = require('../assets/images/hello.webp');

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const { linkError } = useLocalSearchParams<{ linkError?: string }>();
  // "Signed in" comes from the session stored on the phone (works offline); SIGNED_OUT clears it.
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const [locked, setLocked] = useState<boolean | null>(null);
  const authEventSeen = useRef(false);
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    void readStoredUserId().then((id) => {
      if (!authEventSeen.current) setUserId(id);
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== 'INITIAL_SESSION') authEventSeen.current = true;
      if (event === 'SIGNED_OUT') setUserId(null);
      else if (session) setUserId(session.user.id);
      // First sign-in on this install registers it (unit of revocation); best effort, retried next sign-in.
      if (event === 'SIGNED_IN') void registerDevice().catch(() => undefined);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // Cold start: lock if the app lock is on.
  useEffect(() => {
    if (!userId) return;
    void isLockEnabled().then((enabled) => setLocked(shouldLock(enabled, null, Date.now())));
  }, [userId]);

  // Coming back after a while in the background: lock again.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        backgroundedAt.current ??= Date.now();
        return;
      }
      const at = backgroundedAt.current;
      backgroundedAt.current = null;
      if (at === null) return;
      void isLockEnabled().then((enabled) => {
        if (shouldLock(enabled, at, Date.now())) setLocked(true);
      });
    });
    return () => subscription.remove();
  }, []);

  const signOut = useCallback(() => {
    void disableLock()
      .then(() => supabase.auth.signOut({ scope: 'local' }))
      .catch(() => undefined);
  }, []);
  const unlock = useCallback(() => setLocked(false), []);

  if (userId === undefined || (userId && locked === null)) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator />
      </View>
    );
  }
  if (!userId) return <SignInScreen linkError={linkError === '1'} />;
  if (locked) return <LockScreen onUnlocked={unlock} onTooManyAttempts={signOut} />;

  const nextLanguage = i18n.language === 'fr' ? 'en' : 'fr';
  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView contentContainerClassName="pb-10">
        <Image
          source={helloImage}
          accessibilityLabel={t('mobile.patient.imageAlt')}
          contentFit="cover"
          style={{ width: '100%', aspectRatio: 3 / 2 }}
        />
        <View className="gap-4 px-6 pt-6">
          <Text className="text-sm font-semibold uppercase tracking-widest text-brand-700">
            {t('common.appName')}
          </Text>
          <Text accessibilityRole="header" className="text-3xl font-bold text-ink-900">
            {t('mobile.patient.title')}
          </Text>
          <Text className="text-lg leading-7 text-ink-600">{t('mobile.patient.body')}</Text>
          <SecuritySettings onSignOut={signOut} />
          <Pressable
            accessibilityRole="button"
            onPress={() => void i18n.changeLanguage(nextLanguage)}
            className="mt-2 min-h-12 items-center justify-center rounded-xl bg-brand-600 px-5 active:bg-brand-700"
          >
            <Text className="text-base font-semibold text-white">{t('mobile.switchLanguage')}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
