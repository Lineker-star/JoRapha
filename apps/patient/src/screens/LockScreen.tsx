import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Field, Message, PrimaryButton, SecondaryButton } from '../components/ui';
import { unlockWithBiometrics, usesBiometrics, verifyPin } from '../lib/appLock';

/** Shown at start-up and after a while in the background when the app lock is on. */
export function LockScreen({
  onUnlocked,
  onTooManyAttempts,
}: {
  onUnlocked: () => void;
  onTooManyAttempts: () => void;
}) {
  const { t } = useTranslation();
  const [pin, setPin] = useState('');
  const [wrong, setWrong] = useState(false);
  const [biometrics, setBiometrics] = useState(false);

  useEffect(() => {
    void usesBiometrics().then(async (enabled) => {
      setBiometrics(enabled);
      if (enabled && (await unlockWithBiometrics(t('mobile.auth.lock.biometricPrompt'))))
        onUnlocked();
    });
  }, [onUnlocked, t]);

  async function submit() {
    const result = await verifyPin(pin);
    setPin('');
    if (result === 'ok') return onUnlocked();
    if (result === 'too-many') return onTooManyAttempts();
    setWrong(true);
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="gap-4 px-6 pt-16">
        <Text accessibilityRole="header" className="text-2xl font-bold text-ink-900">
          {t('mobile.auth.lock.title')}
        </Text>
        <Field
          label={t('mobile.auth.lock.enterPin')}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={6}
          value={pin}
          onChangeText={setPin}
        />
        {wrong ? <Message tone="error">{t('mobile.auth.lock.wrongPin')}</Message> : null}
        <PrimaryButton label={t('mobile.auth.lock.unlock')} onPress={() => void submit()} />
        {biometrics ? (
          <SecondaryButton
            label={t('mobile.auth.lock.useBiometrics')}
            onPress={() =>
              void unlockWithBiometrics(t('mobile.auth.lock.biometricPrompt')).then(
                (ok) => ok && onUnlocked(),
              )
            }
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}
