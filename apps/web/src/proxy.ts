// Next.js 16 renamed middleware to "proxy". Redirects "/" to the user's locale and keeps the prefix, then refreshes
// the Supabase session cookies (short access tokens, refresh rotation: supabase/config.toml).
import { createServerClient } from '@supabase/ssr';
import type { NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';

import { routing } from './i18n/routing';

const intl = createMiddleware(routing);

export default async function proxy(request: NextRequest) {
  const response = intl(request);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return response;

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        for (const { name, value, options } of toSet) {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        }
      },
    },
  });
  // Verifies the token and refreshes it when needed; the refreshed cookies go out on `response`.
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  // Skip API routes, Next internals, Vercel internals and files with an extension (images, favicon…).
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)',
};
