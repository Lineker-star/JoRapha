import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { supabase } from '../../src/lib/supabase';

/**
 * jorapha-patient://auth/callback?code=… — the e-mail sign-in link opens the app here. The PKCE code is exchanged
 * for a session on this phone (the link must be opened on the phone that asked for it).
 */
export default function AuthCallback() {
  const { code } = useLocalSearchParams<{ code?: string }>();

  useEffect(() => {
    void (async () => {
      const ok =
        typeof code === 'string' && !(await supabase.auth.exchangeCodeForSession(code)).error;
      router.replace(ok ? '/' : { pathname: '/', params: { linkError: '1' } });
    })();
  }, [code]);

  return (
    <View className="flex-1 items-center justify-center bg-white">
      <ActivityIndicator />
    </View>
  );
}
