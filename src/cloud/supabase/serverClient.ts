import { createClient } from '@supabase/supabase-js';
import { loadCloudConfig } from '../loadCloudConfig';

export function createSupabaseServerClient(env: Record<string, string | undefined> = process.env) {
  const config = loadCloudConfig(env);
  return createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { persistSession: false },
  });
}
