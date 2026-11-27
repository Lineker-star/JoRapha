'use server';

import { defaultLocale, isLocale, type Locale, type Messages } from '@jorapha/i18n';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { safeNextPath } from '@/lib/access';
import { normalizeCameroonPhone } from '@/lib/phone';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/** Message keys under auth.errors (type-checked against the locale files). */
export type AuthError = keyof Messages['auth']['errors'];

/** Result of a form action: an i18n key for the message to show, never a raw server error. */
export interface FormState {
  error?: AuthError;
  sent?: boolean;
  phone?: string;
}

function localeOf(form: FormData): Locale {
  const value = form.get('locale');
  return typeof value === 'string' && isLocale(value) ? value : defaultLocale;
}

/** Where to go after sign-in: a validated same-site path, else the locale home. */
function nextOf(form: FormData, locale: Locale): string {
  const value = form.get('next');
  return safeNextPath(typeof value === 'string' ? value : null) ?? `/${locale}`;
}

/** Absolute URL of this site for e-mail links (Supabase also checks it against its redirect allow-list). */
async function siteOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, '');
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

const email = z.string().trim().toLowerCase().email().max(254);

/** Staff: e-mail + password, then MFA in the area gate. One generic error for any failure. */
export async function signInWithPassword(_prev: FormState, form: FormData): Promise<FormState> {
  const locale = localeOf(form);
  const parsed = z
    .object({ email, password: z.string().min(1).max(200) })
    .safeParse({ email: form.get('email'), password: form.get('password') });
  if (!parsed.success) return { error: 'invalidCredentials' };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: 'invalidCredentials' };
  redirect(nextOf(form, locale));
  return {};
}

/** Patients: e-mail magic link. Always answers "sent", whether or not the address has an account. */
export async function requestEmailLink(_prev: FormState, form: FormData): Promise<FormState> {
  const locale = localeOf(form);
  const parsed = email.safeParse(form.get('email'));
  if (!parsed.success) return { error: 'invalidEmail' };
  const supabase = await createSupabaseServerClient();
  const next = encodeURIComponent(nextOf(form, locale));
  await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: { emailRedirectTo: `${await siteOrigin()}/${locale}/auth/callback?next=${next}` },
  });
  return { sent: true };
}

/** Patients: SMS one-time code to a Cameroon number (+237). The number stays in form state, never in a URL. */
export async function requestPhoneOtp(_prev: FormState, form: FormData): Promise<FormState> {
  const phone = normalizeCameroonPhone(String(form.get('phone') ?? ''));
  if (!phone) return { error: 'invalidPhone' };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({ phone });
  if (error) return { error: 'tryAgain' };
  return { sent: true, phone };
}

export async function verifyPhoneOtp(_prev: FormState, form: FormData): Promise<FormState> {
  const locale = localeOf(form);
  const phone = normalizeCameroonPhone(String(form.get('phone') ?? ''));
  const token = String(form.get('code') ?? '').trim();
  if (!phone || !/^\d{6}$/.test(token))
    return { error: 'invalidCode', sent: true, ...(phone ? { phone } : {}) };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
  if (error) return { error: 'invalidCode', sent: true, phone };
  redirect(nextOf(form, locale));
  return {};
}

/** Password reset by e-mail. Always answers "sent" so it never reveals whether an account exists. */
export async function requestPasswordReset(_prev: FormState, form: FormData): Promise<FormState> {
  const locale = localeOf(form);
  const parsed = email.safeParse(form.get('email'));
  if (!parsed.success) return { error: 'invalidEmail' };
  const supabase = await createSupabaseServerClient();
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${await siteOrigin()}/${locale}/auth/callback?next=${encodeURIComponent(`/${locale}/account/password`)}`,
  });
  return { sent: true };
}

/** New password after a recovery link (the recovery session is already in the cookies). */
export async function updatePassword(_prev: FormState, form: FormData): Promise<FormState> {
  const locale = localeOf(form);
  const password = String(form.get('password') ?? '');
  if (password.length < 12 || password.length > 200) return { error: 'passwordLength' };
  if (password !== String(form.get('confirm') ?? '')) return { error: 'passwordMismatch' };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: 'tryAgain' };
  redirect(`/${locale}/account`);
  return {};
}

export interface EnrollState extends FormState {
  factorId?: string;
  qrCode?: string;
  secret?: string;
}

/** Starts TOTP enrolment; removes an earlier enrolment that was never confirmed. */
export async function startTotpEnrollment(_prev: EnrollState): Promise<EnrollState> {
  const supabase = await createSupabaseServerClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const f of factors?.all ?? []) {
    if (f.factor_type === 'totp' && f.status === 'unverified')
      await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: 'JoRapha',
  });
  if (error || !data) return { error: 'tryAgain' };
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

/** Confirms a TOTP code (first enrolment or a later sign-in): the session becomes aal2. */
export async function verifyTotp(prev: EnrollState, form: FormData): Promise<EnrollState> {
  const locale = localeOf(form);
  const factorId = String(form.get('factorId') ?? '');
  const code = String(form.get('code') ?? '').trim();
  if (!factorId || !/^\d{6}$/.test(code)) return { ...prev, error: 'invalidCode' };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) return { ...prev, error: 'invalidCode' };
  redirect(nextOf(form, locale));
  return {};
}

export async function signOut(form: FormData): Promise<void> {
  const locale = localeOf(form);
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: 'local' });
  redirect(`/${locale}`);
}

/** Ends every session of this account on every device (refresh tokens revoked server-side). */
export async function signOutEverywhere(form: FormData): Promise<void> {
  const locale = localeOf(form);
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: 'global' });
  redirect(`/${locale}`);
}

/** Revokes one of my registered devices: sync-ingest refuses it and it purges its data at next connect. */
export async function revokeMyDevice(form: FormData): Promise<void> {
  const locale = localeOf(form);
  const deviceId = z.string().uuid().safeParse(form.get('deviceId'));
  if (deviceId.success) {
    const supabase = await createSupabaseServerClient();
    await supabase.schema('api').rpc('revoke_device', {
      p_device_id: deviceId.data,
      p_reason: 'revoked by the account owner from the web',
    });
  }
  revalidatePath(`/${locale}/account`);
}
