import { createClient } from '@supabase/supabase-js';

import { config } from '../config';
import { fetchWithTimeout } from './fetchWithTimeout';
import { parseStoredUserId } from './storedSession';
import { secureStorage } from './secureStorage';

// supabase-js has no request timeout: on a stalled 2G connection a request can wait for minutes (seen on the
// emulator, 2026-11-27). A request that takes longer than this fails and is retried by its caller instead.
// Sized for small JSON API calls (auth, RPC). Large transfers (e.g. future photo uploads to Storage) need their
// own client or a longer limit.
const REQUEST_TIMEOUT_MS = 20_000;

/** supabase-js's own default key (sb-<project ref>-auth-token), set explicitly so the app can read it offline. */
export const AUTH_STORAGE_KEY = (() => {
  try {
    return `sb-${new URL(config.supabaseUrl).hostname.split('.')[0]}-auth-token`;
  } catch {
    return 'sb-unconfigured-auth-token';
  }
})();

/**
 * The signed-in user's id from the session stored on this phone, read without the network.
 * supabase-js getSession() answers "no session" when the stored access token has expired and the refresh cannot
 * reach the server (offline), after ~27 s of retries: the app then showed the sign-in screen offline and the CHW
 * was locked out of the records on the phone (emulator, 2026-11-27). The stored session is the source of truth for
 * "this phone belongs to a signed-in CHW"; the token is refreshed in the background once the network returns, and
 * a real sign-out or a rejected refresh token removes it (SIGNED_OUT).
 */
export async function readStoredUserId(): Promise<string | null> {
  try {
    return parseStoredUserId(await secureStorage.getItem(AUTH_STORAGE_KEY));
  } catch {
    return null;
  }
}

/** Supabase client with the publishable key only (never service_role). The session lives in secure storage. */
export const supabase = createClient(config.supabaseUrl, config.supabasePublishableKey, {
  auth: {
    storage: secureStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: AUTH_STORAGE_KEY,
  },
  global: { fetch: fetchWithTimeout(REQUEST_TIMEOUT_MS) },
});
