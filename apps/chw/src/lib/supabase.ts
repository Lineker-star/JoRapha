import { createClient } from '@supabase/supabase-js';

import { config } from '../config';
import { secureStorage } from './secureStorage';

// supabase-js has no request timeout: on a stalled 2G connection a request can wait for minutes (seen on the
// emulator, 2026-11-27). A request that takes longer than this fails and is retried by its caller instead.
const REQUEST_TIMEOUT_MS = 20_000;

/** fetch that aborts after timeoutMs (and when the caller's own signal aborts). */
export function fetchWithTimeout(timeoutMs: number): typeof fetch {
  return (input, init) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const callerSignal = init?.signal;
    if (callerSignal) {
      if (callerSignal.aborted) controller.abort();
      else callerSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }
    return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
  };
}

/** Supabase client with the publishable key only (never service_role). The session lives in secure storage. */
export const supabase = createClient(config.supabaseUrl, config.supabasePublishableKey, {
  auth: {
    storage: secureStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
  global: { fetch: fetchWithTimeout(REQUEST_TIMEOUT_MS) },
});
