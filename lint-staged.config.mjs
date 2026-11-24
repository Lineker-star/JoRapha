// lint-staged: format and lint only the staged files. Full checks run in CI.
// ESLint finds each file's own eslint.config.* (apps/*, packages/*) via the v10 lookup flag.
// Patterns must not overlap: lint-staged runs them in parallel.
export default {
  '{apps,packages}/**/*.{ts,tsx,js,mjs}': [
    'prettier --write',
    'eslint --flag v10_config_lookup_from_file --max-warnings 0 --no-warn-ignored',
  ],
  '{scripts/**/*.mjs,*.config.{js,mjs,ts}}': 'prettier --write',
  '*.{json,md,yml,yaml,css,toml}': 'prettier --write --ignore-unknown',
};
