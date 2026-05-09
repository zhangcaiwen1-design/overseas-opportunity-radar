import { z } from 'zod';

const cloudConfigSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_STORAGE_BUCKET: z.string().min(1),
  CRON_SECRET: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url(),
});

export function loadCloudConfig(env: Record<string, string | undefined>) {
  const parsed = cloudConfigSchema.parse(env);

  return {
    supabaseUrl: parsed.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: parsed.SUPABASE_SERVICE_ROLE_KEY,
    storageBucket: parsed.SUPABASE_STORAGE_BUCKET,
    cronSecret: parsed.CRON_SECRET,
    appUrl: parsed.NEXT_PUBLIC_APP_URL,
  };
}
