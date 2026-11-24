// Shared flat config for TypeScript packages (no React).
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export const ignores = {
  ignores: [
    '**/node_modules/**',
    '**/dist/**',
    '**/.next/**',
    '**/.expo/**',
    '**/.turbo/**',
    '**/coverage/**',
    '**/*.d.ts',
    '**/scripts/*.mjs',
  ],
};

export const sharedRules = {
  rules: {
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/consistent-type-imports': 'error',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    eqeqeq: ['error', 'always'],
  },
};

/** All user-facing text must come from packages/i18n (CLAUDE.md rule). Apps only (needs eslint-plugin-react). */
export const noHardcodedText = {
  files: ['**/*.tsx'],
  rules: {
    'react/jsx-no-literals': ['error', { noStrings: false, ignoreProps: true }],
  },
};

export default tseslint.config(
  ignores,
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: { ...globals.node } } },
  sharedRules,
  prettier,
);
