import Constants from 'expo-constants';

/** Public runtime configuration (no secrets): set via EXPO_PUBLIC_* env vars at build time (see .env.example). */
interface PublicConfig {
  supabaseUrl: string;
  supabasePublishableKey: string;
  powersyncUrl: string;
}

const extra = (Constants.expoConfig?.extra ?? {}) as Partial<PublicConfig>;

export const config: PublicConfig = {
  supabaseUrl: extra.supabaseUrl ?? '',
  supabasePublishableKey: extra.supabasePublishableKey ?? '',
  powersyncUrl: extra.powersyncUrl ?? '',
};

export const syncIngestUrl = `${config.supabaseUrl}/functions/v1/sync-ingest`;
