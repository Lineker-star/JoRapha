import { PowerSyncContext, type PowerSyncDatabase } from '@powersync/react-native';
import type { Session } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getDeviceId } from '../src/lib/deviceIdentity';
import { markStartup } from '../src/metrics';
import { readStoredUserId, supabase } from '../src/lib/supabase';
import { SupabaseConnector } from '../src/powersync/connector';
import { ensureOwner, openDatabase, purgeDatabase } from '../src/powersync/database';
import { HouseholdsScreen } from '../src/screens/HouseholdsScreen';
import { SignInScreen } from '../src/screens/SignInScreen';

async function registerDevice(deviceId: string): Promise<void> {
  const { error } = await supabase.schema('api').rpc('register_device', {
    p_device_id: deviceId,
    p_app: 'chw',
    p_platform: Platform.OS === 'ios' ? 'ios' : 'android',
    p_app_version: Constants.expoConfig?.version ?? null,
  });
  if (error) throw error;
}

export default function ChwHome() {
  const { t } = useTranslation();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  // The stored session decides "signed in", not getSession(): see readStoredUserId (offline lock-out, 2026-11-27).
  const [storedUserId, setStoredUserId] = useState<string | null | undefined>(undefined);
  const [db, setDb] = useState<PowerSyncDatabase | null>(null);
  const [revoked, setRevoked] = useState(false);
  const [fatal, setFatal] = useState(false);
  const [otherUserPending, setOtherUserPending] = useState(false);
  // Once any auth event arrived, the slower stored-session read must not overwrite it.
  const authEventSeen = useRef(false);

  useEffect(() => {
    void readStoredUserId().then((id) => {
      markStartup('stored session read');
      if (!authEventSeen.current) setStoredUserId(id);
    });
    // May take ~27 s offline with an expired token (refresh retries); nothing waits for it.
    void supabase.auth.getSession().then(({ data }) => {
      markStartup('session loaded');
      setSession(data.session);
    });
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (event !== 'INITIAL_SESSION') authEventSeen.current = true;
      setSession(s);
      // A real sign-out or a refresh token rejected by the server removes the stored session.
      if (event === 'SIGNED_OUT') setStoredUserId(null);
      else if (s) setStoredUserId(s.user.id);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // Only a confirmed revocation from the server purges local data (never an unknown or unreachable device).
  // Sign out BEFORE purging: once the session is gone fetchCredentials returns null, so a connection still being
  // set up cannot download data again into the cleared database.
  const onDeviceRevoked = useCallback(() => {
    setRevoked(true);
    void supabase.auth
      .signOut({ scope: 'local' })
      .finally(() => purgeDatabase())
      .catch(() => undefined);
  }, []);

  // Keyed on the user, not the session object: a routine token refresh must not reopen and reconnect.
  const userId = session?.user.id ?? storedUserId ?? null;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void (async () => {
      const deviceId = await getDeviceId();
      markStartup('device id read');
      let database: PowerSyncDatabase;
      try {
        database = await openDatabase();
      } catch {
        // Encryption inactive or key lost: refuse to run rather than store data unencrypted or lose the queue.
        if (!cancelled) setFatal(true);
        return;
      }
      markStartup('database opened');
      if (!(await ensureOwner(database, userId))) {
        // Another CHW's unsent records are on this phone: show nothing, sync nothing.
        if (!cancelled) setOtherUserPending(true);
        return;
      }
      if (cancelled) return;
      setOtherUserPending(false);
      // Offline-first: the local list is shown now, whatever the network does (a stalled 2G request kept the
      // spinner up for minutes on 2026-11-27). Registration and sync run in the background.
      setDb(database);
      // Best effort: if registration fails, the first upload answers DEVICE_UNKNOWN and the connector registers
      // again before retrying; nothing is purged.
      void registerDevice(deviceId).catch(() => undefined);
      void database
        .connect(
          new SupabaseConnector(deviceId, {
            onDeviceRevoked,
            registerDevice: () => registerDevice(deviceId),
          }),
        )
        .catch(() => undefined); // connection errors surface in the sync status on screen
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, onDeviceRevoked]);

  // The households screen allows this only when the upload queue is empty. Sign out first (see onDeviceRevoked).
  async function signOut() {
    setDb(null);
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    await purgeDatabase();
  }

  if (fatal) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-center text-lg text-red-800">{t('chw.encryptionMissing')}</Text>
      </SafeAreaView>
    );
  }
  if (otherUserPending) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-center text-lg text-red-800">{t('chw.otherUserPending')}</Text>
      </SafeAreaView>
    );
  }
  if (revoked && !userId) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-center text-lg text-ink-900">{t('chw.deviceRevoked')}</Text>
      </SafeAreaView>
    );
  }
  if (storedUserId === undefined || (userId && !db)) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator />
      </View>
    );
  }
  if (!userId || !db) return <SignInScreen />;

  return (
    <PowerSyncContext.Provider value={db}>
      <HouseholdsScreen onSignOut={() => void signOut()} />
    </PowerSyncContext.Provider>
  );
}
