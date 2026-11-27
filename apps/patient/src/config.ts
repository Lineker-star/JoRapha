import Constants from 'expo-constants';

/** Public runtime configuration (no secrets): set via EXPO_PUBLIC_* env vars at build time (see .env.example). */
interface PublicConfig {
  supabaseUrl: string;
  supabasePublishableKey: string;
}

const extra = (Constants.expoConfig?.extra ?? {}) as Partial<PublicConfig>;

export const config: PublicConfig = {
  supabaseUrl: extra.supabaseUrl ?? '',
  supabasePublishableKey: extra.supabasePublishableKey ?? '',
};

/** Deep link that e-mail sign-in links open (must be in Supabase Auth's redirect allow-list). */
export const AUTH_CALLBACK_URL = 'jorapha-patient://auth/callback';
