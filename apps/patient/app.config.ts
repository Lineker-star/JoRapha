import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'JoRapha',
  slug: 'jorapha-patient',
  scheme: 'jorapha-patient',
  version: '0.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  ios: {
    bundleIdentifier: 'cm.jorapha.patient',
    supportsTablet: false,
  },
  android: {
    package: 'cm.jorapha.patient',
  },
  plugins: [
    'expo-router',
    'expo-localization',
    'expo-secure-store',
    [
      'expo-local-authentication',
      {
        faceIDPermission:
          "JoRapha utilise Face ID pour verrouiller l'application. / JoRapha uses Face ID to lock the app.",
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    // Public values only (publishable key), bundled into the app.
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
    supabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
  },
};

export default config;
