import { createClient } from '@supabase/supabase-js';

import { config } from '../config';
import { secureStorage } from './secureStorage';

/** Supabase client with the publishable key only (never service_role). The session lives in secure storage. */
export const supabase = createClient(config.supabaseUrl, config.supabasePublishableKey, {
  auth: {
    storage: secureStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
