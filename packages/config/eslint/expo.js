// Shared flat config for the Expo apps (patient, chw).
import expoConfig from 'eslint-config-expo/flat.js';
import prettier from 'eslint-config-prettier';

import { ignores, noHardcodedText, sharedRules } from './base.js';

export default [
  ignores,
  { ignores: ['metro.config.js', 'babel.config.js', 'tailwind.config.js', 'nativewind-env.d.ts'] },
  ...expoConfig,
  sharedRules,
  noHardcodedText,
  prettier,
];
