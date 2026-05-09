interface SupabaseLike {
  from(table: string): {
    select(columns: string): {
      order(column: string): Promise<{
        data: Array<{ key: string; value: string }> | null;
        error: unknown;
      }>;
    };
    upsert(value: unknown, options?: unknown): Promise<{ error: unknown }>;
  };
}

export function createAppSettingsRepository(supabase: SupabaseLike) {
  return {
    async listAll(): Promise<Array<{ key: string; value: string }>> {
      const { data, error } = await supabase.from('app_settings').select('key,value').order('key');

      if (error) {
        throw error;
      }

      return (data ?? []).map((row) => ({ key: row.key, value: row.value }));
    },
    async saveMany(entries: Array<{ key: string; value: string }>) {
      const { error } = await supabase.from('app_settings').upsert(entries, { onConflict: 'key' });

      if (error) {
        throw error;
      }
    },
  };
}
