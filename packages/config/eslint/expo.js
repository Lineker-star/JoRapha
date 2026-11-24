// Shared flat config for the Expo apps (patient, chw).
import expoConfig from 'eslint-config-expo/flat.js';
import prettier from 'eslint-config-prettier';

import { ignores, noHardcodedText, sharedRules } from './base.js';

export default [
  ignores,
  {
    ignores: [
      'eslint.config.mjs',
      'metro.config.js',
      'babel.config.js',
      'tailwind.config.js',
      'nativewind-env.d.ts',
    ],
  },
  ...expoConfig,
  // eslint-config-expo registers @typescript-eslint only for TS files, so scope the shared rules the same way.
  { files: ['**/*.ts', '**/*.tsx'], ...sharedRules },
  noHardcodedText,
  prettier,
];
