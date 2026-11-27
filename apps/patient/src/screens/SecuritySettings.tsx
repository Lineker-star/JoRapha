import { isAcceptablePin } from '@jorapha/domain';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Switch, Text, View } from 'react-native';

import { Field, Message, PrimaryButton, SecondaryButton } from '../components/ui';
import { biometricsAvailable, disableLock, enableLock, isLockEnabled } from '../lib/appLock';

/** App lock on/off (PIN, optional biometrics) and sign out. */
export function SecuritySettings({ onSignOut }: { onSignOut: () => void }) {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [canBiometrics, setCanBiometrics] = useState(false);
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [biometrics, setBiometrics] = useState(false);
  const [error, setError] = useState<'weakPin' | 'pinMismatch' | null>(null);

  useEffect(() => {
    void isLockEnabled().then(setEnabled);
    void biometricsAvailable().then(setCanBiometrics);
  }, []);

  async function turnOn() {
    if (!isAcceptablePin(pin)) return setError('weakPin');
    if (pin !== confirm) return setError('pinMismatch');
    setError(null);
    await enableLock(pin, biometrics && canBiometrics);
    setPin('');
    setConfirm('');
    setEnabled(true);
  }

  return (
    <View className="gap-3 rounded-xl border border-ink-200 p-4">
      <Text accessibilityRole="header" className="text-lg font-semibold text-ink-900">
        {t('mobile.auth.settings.title')}
      </Text>
      {enabled ? (
        <>
          <Text className="text-ink-600">{t('mobile.auth.settings.lockOn')}</Text>
          <SecondaryButton
            label={t('mobile.auth.settings.disable')}
            onPress={() => void disableLock().then(() => setEnabled(false))}
          />
        </>
      ) : enabled === false ? (
        <>
          <Text className="text-ink-600">{t('mobile.auth.settings.lockOff')}</Text>
          <Field
            label={t('mobile.auth.settings.choosePin')}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            value={pin}
            onChangeText={setPin}
          />
          <Field
            label={t('mobile.auth.settings.confirmPin')}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            value={confirm}
            onChangeText={setConfirm}
          />
          {canBiometrics ? (
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: biometrics }}
              onPress={() => setBiometrics(!biometrics)}
              className="min-h-12 flex-row items-center justify-between"
            >
              <Text className="flex-1 text-ink-900">{t('mobile.auth.settings.biometrics')}</Text>
              <Switch value={biometrics} onValueChange={setBiometrics} />
            </Pressable>
          ) : null}
          {error ? <Message tone="error">{t(`mobile.auth.settings.${error}`)}</Message> : null}
          <PrimaryButton label={t('mobile.auth.settings.enable')} onPress={() => void turnOn()} />
        </>
      ) : null}
      <SecondaryButton label={t('mobile.auth.settings.signOut')} onPress={onSignOut} />
    </View>
  );
}
