import type { CloudPushConfig } from '../types';

interface SupabaseLike {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: boolean): Promise<{
        data: Array<{ channel: CloudPushConfig['channel']; enabled: boolean; secret_payload: string }> | null;
        error: unknown;
      }>;
      order(column: string): Promise<{
        data: Array<{ channel: CloudPushConfig['channel']; enabled: boolean; secret_payload: string }> | null;
        error: unknown;
      }>;
    };
    upsert(value: unknown, options?: unknown): Promise<{ error: unknown }>;
  };
}

export function createPushConfigRepository(supabase: SupabaseLike) {
  return {
    async listEnabled(): Promise<CloudPushConfig[]> {
      const { data, error } = await supabase
        .from('push_configs')
        .select('channel,enabled,secret_payload')
        .eq('enabled', true);

      if (error) {
        throw error;
      }

      return (data ?? []).map((row) => ({
        channel: row.channel,
        enabled: row.enabled,
        secretPayload: row.secret_payload,
      }));
    },
    async listAll(): Promise<CloudPushConfig[]> {
      const { data, error } = await supabase
        .from('push_configs')
        .select('channel,enabled,secret_payload')
        .order('channel');

      if (error) {
        throw error;
      }

      return (data ?? []).map((row) => ({
        channel: row.channel,
        enabled: row.enabled,
        secretPayload: row.secret_payload,
      }));
    },
    async saveMany(configs: CloudPushConfig[]) {
      const { error } = await supabase.from('push_configs').upsert(
        configs.map((config) => ({
          channel: config.channel,
          enabled: config.enabled,
          secret_payload: config.secretPayload,
        })),
        { onConflict: 'channel' },
      );

      if (error) {
        throw error;
      }
    },
  };
}
