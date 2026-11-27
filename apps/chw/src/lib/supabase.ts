import { createClient } from '@supabase/supabase-js';

import { config } from '../config';
import { fetchWithTimeout } from './fetchWithTimeout';
import { secureStorage } from './secureStorage';

// supabase-js has no request timeout: on a stalled 2G connection a request can wait for minutes (seen on the
// emulator, 2026-11-27). A request that takes longer than this fails and is retried by its caller instead.
// Sized for small JSON API calls (auth, RPC). Large transfers (e.g. future photo uploads to Storage) need their
// own client or a longer limit.
const REQUEST_TIMEOUT_MS = 20_000;

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
