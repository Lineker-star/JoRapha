import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

// French UI strings from the shared locale file, so the tests follow the real copy.
const fr = JSON.parse(
  readFileSync(new URL('../../../packages/i18n/locales/fr.json', import.meta.url), 'utf8'),
) as { auth: Record<string, Record<string, string>> };
const t = fr.auth;

// Synthetic accounts from supabase/seed.sql (LOCAL stack only; this shared password is public by design and
// never valid on a hosted project). Test OTP number from supabase/config.toml [auth.sms.test_otp].
const LOCAL_PASSWORD = 'JoRapha-Local-Only-2026!';
const CLINICIAN = 'test.clinician.001@jorapha.test';
const TEST_PHONE = '650000001';
const TEST_OTP = '123456';

test('a signed-out visitor opening /clinician is sent to sign-in', async ({ page }) => {
  await page.goto('/fr/clinician');
  await expect(page).toHaveURL(/\/fr\/sign-in\?next=%2Ffr%2Fclinician/);
});

test('a clinician without MFA cannot open /clinician (sent to MFA set-up)', async ({ page }) => {
  await page.goto('/fr/clinician');
  await page.getByLabel(t.signIn!.email!).fill(CLINICIAN);
  await page.getByLabel(t.signIn!.password!).fill(LOCAL_PASSWORD);
  await page.getByRole('button', { name: t.signIn!.submit! }).click();
  await expect(page).toHaveURL(/\/fr\/mfa\?next=%2Ffr%2Fclinician/);
  await expect(page.getByRole('heading', { name: t.mfa!.title! })).toBeVisible();

  // Trying the area directly again still does not open it.
  await page.goto('/fr/clinician');
  await expect(page).toHaveURL(/\/fr\/mfa/);
});

test('a patient signs in with the phone test OTP', async ({ page }) => {
  await page.goto('/fr/sign-in?next=%2Ffr%2Fpatient');
  await page.getByRole('tab', { name: t.signIn!.byPhone! }).click();
  await page.getByLabel(t.signIn!.phone!).fill(TEST_PHONE);
  await page.getByRole('button', { name: t.signIn!.sendCode! }).click();
  await page.getByLabel(t.signIn!.code!).fill(TEST_OTP);
  await page.getByRole('button', { name: t.signIn!.verifyCode! }).click();
  await expect(page).toHaveURL(/\/fr\/patient$/);
  await expect(page.getByRole('link', { name: t.header!.account! })).toBeVisible();
});

test('password recovery gives the same answer for known and unknown addresses', async ({
  page,
}) => {
  for (const email of [CLINICIAN, 'nobody.at.all@jorapha.test']) {
    await page.goto('/fr/recover');
    await page.getByLabel(t.signIn!.email!).fill(email);
    await page.getByRole('button', { name: t.recover!.submit! }).click();
    await expect(page.getByRole('status')).toHaveText(t.recover!.sent!);
  }
});
