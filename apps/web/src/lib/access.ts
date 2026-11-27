import { locales } from '@jorapha/i18n';

import type { AreaId } from './areas';

/** Roles carried in the access token by identity.custom_access_token_hook (claim `app_roles`). */
export const ROLES = [
  'patient',
  'caregiver',
  'clinician',
  'facility_admin',
  'chw',
  'chw_supervisor',
  'lab_staff',
  'pharmacy_staff',
  'platform_support',
  'platform_admin',
] as const;
export type Role = (typeof ROLES)[number];

/**
 * Staff areas and the roles allowed in each. The patient area needs a sign-in only (patient roles arrive
 * with registration, Step 2.2).
 */
export const STAFF_AREA_ROLES: Record<Exclude<AreaId, 'patient'>, readonly Role[]> = {
  clinician: ['clinician'],
  facility: ['facility_admin', 'lab_staff', 'pharmacy_staff'],
  admin: ['platform_admin', 'platform_support'],
};

/** Roles that must use email + password + TOTP (PRD-ID-001, Step 2.1). */
export const MFA_ROLES: readonly Role[] = [
  'clinician',
  'facility_admin',
  'chw_supervisor',
  'lab_staff',
  'pharmacy_staff',
  'platform_support',
  'platform_admin',
];

export type AccessDecision = 'allow' | 'sign-in' | 'mfa' | 'forbidden';

export interface AccessInput {
  signedIn: boolean;
  roles: readonly string[];
  /** Authenticator assurance level of the current session: aal1 (password/OTP) or aal2 (MFA done). */
  aal: 'aal1' | 'aal2' | null;
  area: AreaId;
}

/**
 * Who may open which area (pure; tested in access.test.ts):
 * - not signed in: sign in first;
 * - patient area: any signed-in person;
 * - staff areas: the role must match, and the session must be MFA-verified (aal2) or the person is sent to
 *   MFA enrolment / challenge. The database enforces the same rules (RLS, identity.aal2()); this only decides
 *   which screen to show.
 */
export function decideAccess({ signedIn, roles, aal, area }: AccessInput): AccessDecision {
  if (!signedIn) return 'sign-in';
  if (area === 'patient') return 'allow';
  const allowed = STAFF_AREA_ROLES[area];
  if (!roles.some((r) => (allowed as readonly string[]).includes(r))) return 'forbidden';
  return aal === 'aal2' ? 'allow' : 'mfa';
}

/** Roles from the `app_roles` claim, ignoring anything that is not a known role. */
export function rolesFromClaims(claims: Record<string, unknown> | null | undefined): Role[] {
  const raw = claims?.app_roles;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (r): r is Role => typeof r === 'string' && (ROLES as readonly string[]).includes(r),
  );
}

const PROBE_ORIGIN = 'https://jorapha.invalid';
const LOCALE_PATH = new RegExp(`^/(${locales.join('|')})(/|$)`);

/**
 * Accepts only same-site paths under a locale for post-sign-in redirects (no open redirect). Control characters
 * are refused first: the URL parser strips tab/CR/LF, so "/\t/evil.com" would otherwise become "//evil.com"
 * (security review, 2026-11-27). The path is then resolved as a URL and must stay on this site.
 */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith('/') || /[\u0000-\u001F\u007F\\]/.test(next)) return null;
  let url: URL;
  try {
    url = new URL(next, PROBE_ORIGIN);
  } catch {
    return null;
  }
  if (url.origin !== PROBE_ORIGIN || !LOCALE_PATH.test(url.pathname)) return null;
  return url.pathname + url.search;
}
