import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests (Step 2.1 acceptance tests). They run against the LOCAL Supabase stack with seed.sql
 * (synthetic accounts) and a production build of the web app: see the "End-to-end (web)" CI job.
 * Locally: `pnpm db:start`, set NEXT_PUBLIC_SUPABASE_* from `pnpm supabase status`, `pnpm --filter web build`,
 * then `pnpm --filter web e2e`.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    locale: 'fr-FR',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm start',
    url: 'http://localhost:3000/fr',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
