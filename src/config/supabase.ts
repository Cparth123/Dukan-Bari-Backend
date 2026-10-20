import { createClient } from '@supabase/supabase-js';
import { config } from './env';

// Public/Anon client for token validation & standard user operations
export const supabase = createClient(config.supabase.url, config.supabase.anonKey);

// Admin Service Role client for system operations, bypassing RLS where required (e.g. background push jobs)
export const supabaseAdmin = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});
