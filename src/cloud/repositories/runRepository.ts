import { PostgrestError } from '@supabase/supabase-js';
import type { CloudRun, CreateRunInput } from '../types';

interface InsertResult {
  data: {
    id: string;
    date_key?: string;
    trigger_type: 'cron' | 'manual';
    status?: 'running' | 'completed' | 'failed';
  } | null;
  error: unknown;
}

interface InsertBuilder {
  select(): {
    single(): Promise<InsertResult>;
  };
}

interface RunRow {
  id: string;
  date_key: string;
  trigger_type: 'cron' | 'manual';
  status: 'running' | 'completed' | 'failed';
  started_at?: string;
  selected_count?: number;
  pool_count?: number;
  summary_text?: string;
  error_message?: string;
}

interface SupabaseLike {
  from(table: string): {
    insert(value: unknown): InsertBuilder;
    update(value: unknown): {
      eq(column: string, value: string): Promise<{ error: unknown }>;
    };
    select(columns: string): {
      eq(column: string, value: string): {
        single(): Promise<{
          data: RunRow | null;
          error: unknown;
        }>;
      };
      order(column: string, options?: { ascending: boolean }): {
        limit(count: number): Promise<{
          data: RunRow[] | null;
          error: unknown;
        }>;
      };
    };
  };
}

function isMissingRunFieldError(error: unknown) {
  if (!(error instanceof PostgrestError)) {
    return false;
  }

  return error.code === 'PGRST204' && /selected_count|pool_count|summary_text|error_message/.test(error.message);
}

export function createRunRepository(supabase: SupabaseLike) {
  return {
    async create(input: CreateRunInput): Promise<CloudRun> {
      const { data, error } = await supabase
        .from('runs')
        .insert({ date_key: input.dateKey, trigger_type: input.triggerType, status: 'running' })
        .select()
        .single();

      if (error || !data) {
        throw error ?? new Error('Failed to create run');
      }

      return {
        id: data.id,
        dateKey: data.date_key ?? input.dateKey,
        triggerType: data.trigger_type,
        status: data.status ?? 'running',
      };
    },
    async getById(runId: string): Promise<CloudRun | null> {
      const { data, error } = await supabase
        .from('runs')
        .select('id,date_key,trigger_type,status,started_at,summary_text,error_message')
        .eq('id', runId)
        .single();

      if (error) {
        throw error;
      }

      if (!data) {
        return null;
      }

      return {
        id: data.id,
        dateKey: data.date_key,
        triggerType: data.trigger_type,
        status: data.status,
        startedAt: data.started_at,
        summaryText: data.summary_text ?? '',
        errorMessage: data.error_message ?? '',
      };
    },
    async updateStatus(
      runId: string,
      input: {
        status: 'running' | 'completed' | 'failed';
        poolCount?: number;
        selectedCount?: number;
        summaryText?: string;
        usedFallback?: boolean;
        errorMessage?: string;
      },
    ) {
      const payload = {
        status: input.status,
        pool_count: input.poolCount,
        selected_count: input.selectedCount,
        summary_text: input.summaryText,
        used_fallback: input.usedFallback,
        error_message: input.errorMessage,
        completed_at: input.status === 'completed' || input.status === 'failed' ? new Date().toISOString() : undefined,
      };

      const { error } = await supabase.from('runs').update(payload).eq('id', runId);

      if (error) {
        throw error;
      }
    },
    async getLatest(): Promise<CloudRun | null> {
      const loadRows = async (columns: string) =>
        supabase.from('runs').select(columns).order('started_at', { ascending: false }).limit(1);

      let result = await loadRows('id,date_key,trigger_type,status,started_at,summary_text,error_message');

      if (result.error && isMissingRunFieldError(result.error)) {
        result = await loadRows('id,date_key,trigger_type,status,started_at');
      }

      if (result.error) {
        throw result.error;
      }

      const row = result.data?.[0];
      if (!row) {
        return null;
      }

      return {
        id: row.id,
        dateKey: row.date_key,
        triggerType: row.trigger_type,
        status: row.status,
        startedAt: row.started_at,
        summaryText: row.summary_text ?? '',
        errorMessage: row.error_message ?? '',
      };
    },
    async listRecent(limit = 20): Promise<Array<CloudRun & { startedAt?: string; selectedCount: number; poolCount: number }>> {
      const loadRows = async (columns: string) =>
        supabase.from('runs').select(columns).order('started_at', { ascending: false }).limit(limit);

      let result = await loadRows('id,date_key,trigger_type,status,started_at,selected_count,pool_count,summary_text,error_message');

      if (result.error && isMissingRunFieldError(result.error)) {
        result = await loadRows('id,date_key,trigger_type,status,started_at');
      }

      if (result.error) {
        throw result.error;
      }

      return (result.data ?? []).map((row) => ({
        id: row.id,
        dateKey: row.date_key,
        triggerType: row.trigger_type,
        status: row.status,
        startedAt: row.started_at,
        selectedCount: row.selected_count ?? 0,
        poolCount: row.pool_count ?? 0,
        summaryText: row.summary_text ?? '',
        errorMessage: row.error_message ?? '',
      }));
    },
  };
}
