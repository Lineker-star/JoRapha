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
  plugins: ['expo-router', 'expo-localization'],
  experiments: {
    typedRoutes: true,
  },
};

export default config;
