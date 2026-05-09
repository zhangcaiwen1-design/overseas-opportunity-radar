import type { CloudPushLog } from '../types';

interface SupabaseLike {
  from(table: string): {
    insert(value: unknown): Promise<{ error: unknown }>;
    delete(): {
      eq(column: string, value: string): Promise<{ error: unknown }>;
    };
    select(columns: string): {
      in(column: string, values: string[]): {
        order(column: string, options?: { ascending: boolean }): Promise<{
          data: Array<{
            run_id: string;
            channel: CloudPushLog['channel'];
            status: CloudPushLog['status'];
            response_summary: string;
            pushed_at?: string;
          }> | null;
          error: unknown;
        }>;
      };
    };
  };
}

export function createPushLogRepository(supabase: SupabaseLike) {
  return {
    async create(input: { runId: string; channel: string; status: 'success' | 'failed'; responseSummary: string }) {
      const { error } = await supabase.from('push_logs').insert({
        run_id: input.runId,
        channel: input.channel,
        status: input.status,
        response_summary: input.responseSummary,
      });

      if (error) {
        throw error;
      }
    },
    async listByRunIds(runIds: string[]): Promise<CloudPushLog[]> {
      if (runIds.length === 0) {
        return [];
      }

      const { data, error } = await supabase
        .from('push_logs')
        .select('run_id,channel,status,response_summary,pushed_at')
        .in('run_id', runIds)
        .order('pushed_at', { ascending: false });

      if (error) {
        throw error;
      }

      return (data ?? []).map((row) => ({
        runId: row.run_id,
        channel: row.channel,
        status: row.status,
        responseSummary: row.response_summary,
        pushedAt: row.pushed_at,
      }));
    },
    async deleteByRunId(runId: string) {
      const { error } = await supabase.from('push_logs').delete().eq('run_id', runId);

      if (error) {
        throw error;
      }
    },
  };
}
