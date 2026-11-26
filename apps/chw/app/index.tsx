import { PowerSyncContext, type PowerSyncDatabase } from '@powersync/react-native';
import type { Session } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getDeviceId } from '../src/lib/deviceIdentity';
import { supabase } from '../src/lib/supabase';
import { SupabaseConnector } from '../src/powersync/connector';
import { openDatabase, purgeDatabase } from '../src/powersync/database';
import { HouseholdsScreen } from '../src/screens/HouseholdsScreen';
import { SignInScreen } from '../src/screens/SignInScreen';

export default function ChwHome() {
  const { t } = useTranslation();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [db, setDb] = useState<PowerSyncDatabase | null>(null);
  const [revoked, setRevoked] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const onDeviceRevoked = useCallback(() => {
    setRevoked(true);
    void purgeDatabase().then(() => supabase.auth.signOut());
  }, []);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    void (async () => {
      const deviceId = await getDeviceId();
      // Best effort: registration needs the network; offline sign-in from a cached session still works.
      await supabase
        .schema('api')
        .rpc('register_device', {
          p_device_id: deviceId,
          p_app: 'chw',
          p_platform: Platform.OS === 'ios' ? 'ios' : 'android',
          p_app_version: Constants.expoConfig?.version ?? null,
        })
        .then(
          () => undefined,
          () => undefined,
        );
      const database = await openDatabase();
      await database.connect(new SupabaseConnector(deviceId, onDeviceRevoked));
      if (!cancelled) setDb(database);
    })();
    return () => {
      cancelled = true;
    };
  }, [session, onDeviceRevoked]);

  async function signOut() {
    await purgeDatabase();
    setDb(null);
    await supabase.auth.signOut();
  }

  if (revoked && !session) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-center text-lg text-ink-900">{t('chw.deviceRevoked')}</Text>
      </SafeAreaView>
    );
  }
  if (session === undefined || (session && !db)) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator />
      </View>
    );
  }
  if (!session || !db) return <SignInScreen />;

  return (
    <PowerSyncContext.Provider value={db}>
      <HouseholdsScreen onSignOut={() => void signOut()} />
    </PowerSyncContext.Provider>
  );
}
