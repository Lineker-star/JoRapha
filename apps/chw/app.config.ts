import type { ExpoConfig } from 'expo/config';

// Public values only (no secrets). Set them in apps/chw/.env.local for local builds, and as EAS environment
// variables for cloud builds. See apps/chw/.env.example.
const config: ExpoConfig = {
  name: 'JoRapha ASC',
  slug: 'jorapha-chw',
  scheme: 'jorapha-chw',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  ios: {
    bundleIdentifier: 'cm.jorapha.chw',
    supportsTablet: false,
  },
  android: {
    package: 'cm.jorapha.chw',
    permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION'],
  },
  plugins: [
    'expo-router',
    'expo-localization',
    'expo-secure-store',
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'JoRapha ASC enregistre la position du ménage que vous visitez. / JoRapha ASC records the position of the household you visit.',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
    supabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
    powersyncUrl: process.env.EXPO_PUBLIC_POWERSYNC_URL ?? '',
    eas: process.env.EAS_PROJECT_ID ? { projectId: process.env.EAS_PROJECT_ID } : undefined,
  },
};

export default config;
