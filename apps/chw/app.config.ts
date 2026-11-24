import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'JoRapha ASC',
  slug: 'jorapha-chw',
  scheme: 'jorapha-chw',
  version: '0.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  ios: {
    bundleIdentifier: 'cm.jorapha.chw',
    supportsTablet: false,
  },
  android: {
    package: 'cm.jorapha.chw',
  },
  plugins: ['expo-router', 'expo-localization'],
  experiments: {
    typedRoutes: true,
  },
};

export default config;
