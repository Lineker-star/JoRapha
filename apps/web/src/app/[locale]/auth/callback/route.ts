import type { EmailOtpType } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';

import { safeNextPath } from '@/lib/access';

const EMAIL_LINK_TYPES: readonly EmailOtpType[] = ['email', 'magiclink', 'recovery', 'signup'];
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Landing point for e-mail links (magic link sign-in, password reset): exchanges the PKCE code, or verifies the
 * token hash, for a session in the cookies, then continues to a validated same-site `next` path. An invalid or
 * reused link goes back to sign-in with a generic message.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params;
  const url = request.nextUrl;
  const next = safeNextPath(url.searchParams.get('next')) ?? `/${locale}`;
  const supabase = await createSupabaseServerClient();

  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  // Only the e-mail link types this app sends (security review): anything else is refused.
  const rawType = url.searchParams.get('type');
  const type = EMAIL_LINK_TYPES.find((t) => t === rawType) ?? null;

  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  }
  const target = ok ? next : `/${locale}/sign-in?error=link`;
  return NextResponse.redirect(new URL(target, url.origin));
}
