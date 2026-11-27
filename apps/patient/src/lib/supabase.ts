import { createClient } from '@supabase/supabase-js';

import { config } from '../config';
import { secureStorage } from './secureStorage';

// supabase-js has no request timeout: a stalled 2G request would wait for minutes (CHW spike, 2026-11-27).
const REQUEST_TIMEOUT_MS = 20_000;

const fetchWithTimeout: typeof fetch = async (input, init) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const callerSignal = init?.signal ?? null;
  const onAbort = () => controller.abort();
  callerSignal?.addEventListener('abort', onAbort, { once: true });
  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    const body = [101, 204, 205, 304].includes(response.status) ? null : await response.text();
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener('abort', onAbort);
  }
};

/** supabase-js's own default storage key, set explicitly so the app can read the stored session offline. */
const AUTH_STORAGE_KEY = (() => {
  try {
    return `sb-${new URL(config.supabaseUrl).hostname.split('.')[0]}-auth-token`;
  } catch {
    return 'sb-unconfigured-auth-token';
  }
})();

/**
 * The signed-in user's id from the session stored on this phone, read without the network. supabase-js
 * getSession() answers "no session" offline once the access token has expired (CHW spike, 2026-11-27), so the
 * stored session decides "signed in"; a real sign-out or a rejected refresh token removes it (SIGNED_OUT).
 */
export async function readStoredUserId(): Promise<string | null> {
  try {
    const raw = await secureStorage.getItem(AUTH_STORAGE_KEY);
    const stored = raw ? (JSON.parse(raw) as { user?: { id?: unknown } } | null) : null;
    return typeof stored?.user?.id === 'string' ? stored.user.id : null;
  } catch {
    return null;
  }
}

/** Publishable key only (never service_role). The session lives in the Keystore-backed secure store. */
export const supabase = createClient(config.supabaseUrl, config.supabasePublishableKey, {
  auth: {
    storage: secureStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
    storageKey: AUTH_STORAGE_KEY,
  },
  global: { fetch: fetchWithTimeout },
});
