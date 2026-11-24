// Shared flat config for the Next.js web app.
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier';

import { ignores, noHardcodedText, sharedRules } from './base.js';

export default [
  ignores,
  { ignores: ['next-env.d.ts'] },
  ...nextVitals,
  ...nextTs,
  sharedRules,
  noHardcodedText,
  prettier,
];
