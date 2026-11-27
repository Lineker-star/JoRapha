import { getTranslations } from 'next-intl/server';

import { Link } from '@/i18n/navigation';
import { getAuthState } from '@/lib/auth/session';

/** Header link: "Sign in" when signed out, "My account" when signed in. */
export async function AccountLink() {
  const t = await getTranslations('auth.header');
  let signedIn = false;
  try {
    signedIn = (await getAuthState()).signedIn;
  } catch {
    // Supabase not configured (e.g. a build without NEXT_PUBLIC_SUPABASE_*): show the signed-out header.
  }
  return (
    <Link
      href={signedIn ? '/account' : '/sign-in'}
      className="rounded-md px-3 py-2 text-sm font-medium text-brand-700 hover:bg-surface-muted"
    >
      {signedIn ? t('account') : t('signIn')}
    </Link>
  );
}
