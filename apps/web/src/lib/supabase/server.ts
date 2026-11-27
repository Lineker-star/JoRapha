import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { supabaseEnv } from './env';

/**
 * Supabase client for server components, server actions and route handlers. The session lives in
 * cookies managed by @supabase/ssr (SameSite=Lax, Secure on HTTPS; readable by the browser client, so not httpOnly); the proxy (src/proxy.ts) refreshes it on each request.
 */
export async function createSupabaseServerClient() {
  const { url, publishableKey } = supabaseEnv();
  const cookieStore = await cookies();
  return createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        } catch {
          // Server components cannot set cookies; the proxy refreshes the session instead.
        }
      },
    },
  });
}
