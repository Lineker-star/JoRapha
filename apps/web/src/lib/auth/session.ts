import 'server-only';

import type { Locale } from '@jorapha/i18n';

import { redirect } from '@/i18n/navigation';
import { decideAccess, rolesFromClaims, type Role } from '@/lib/access';
import type { AreaId } from '@/lib/areas';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export interface AuthState {
  signedIn: boolean;
  userId: string | null;
  roles: Role[];
  aal: 'aal1' | 'aal2' | null;
}

/**
 * Who is signed in, from the VERIFIED access token (getClaims checks the JWT signature; the session cookie on its
 * own is never trusted). Roles come from the custom access-token hook (server-controlled tables).
 */
export async function getAuthState(): Promise<AuthState> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const claims = (data?.claims ?? null) as Record<string, unknown> | null;
  const sub = typeof claims?.sub === 'string' ? claims.sub : null;
  const aal = claims?.aal === 'aal2' ? 'aal2' : claims?.aal === 'aal1' ? 'aal1' : null;
  return { signedIn: sub !== null, userId: sub, roles: rolesFromClaims(claims), aal };
}

/**
 * Gate for an area layout: signed out -> sign-in (then back here), staff without MFA -> MFA enrolment or
 * challenge, wrong role -> no-access page. Returns the auth state when access is allowed.
 */
export async function requireArea(area: AreaId, locale: Locale): Promise<AuthState> {
  const state = await getAuthState();
  const decision = decideAccess({ ...state, area });
  const next = encodeURIComponent(`/${locale}/${area}`);
  if (decision === 'sign-in') redirect({ href: `/sign-in?next=${next}`, locale });
  if (decision === 'mfa') redirect({ href: `/mfa?next=${next}`, locale });
  if (decision === 'forbidden') redirect({ href: '/no-access', locale });
  return state;
}
