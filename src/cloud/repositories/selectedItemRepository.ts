import type { OpportunitySignal } from '../../types';
import type { CloudSelectedItem } from '../types';

interface SupabaseLike {
  from(table: string): {
    insert(value: unknown): { select(columns: string): { order(column: string): Promise<{ data: Array<{ id: string; candidate_id: string; slug?: string; title: string; status: string }> | null; error: unknown }> } };
    delete(): {
      eq(column: string, value: string): Promise<{ error: unknown }>;
    };
    select(columns: string): {
      eq(column: string, value: string): {
        order(column: string): Promise<{
          data: Array<{ id: string; candidate_id: string; slug?: string; title: string; status: string }> | null;
          error: unknown;
        }>;
      };
    };
  };
}

export function createSelectedItemRepository(supabase: SupabaseLike) {
  return {
    async createMany(runId: string, candidates: OpportunitySignal[]): Promise<CloudSelectedItem[]> {
      const { data, error } = await supabase
        .from('selected_items')
        .insert(
          candidates.map((candidate, index) => ({
            run_id: runId,
            candidate_id: candidate.id,
            title: candidate.title,
            slug: candidate.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'opportunity',
            status: 'queued',
            sort_order: index,
          })),
        )
        .select('id,candidate_id,slug,title,status')
        .order('id');

      if (error) {
        throw error;
      }

      return (data ?? []).map((row) => ({
        id: row.id,
        candidateId: row.candidate_id,
        slug: row.slug,
        title: row.title,
        status: row.status,
      }));
    },
    async listByRun(runId: string): Promise<CloudSelectedItem[]> {
      const { data, error } = await supabase
        .from('selected_items')
        .select('id,candidate_id,slug,title,status')
        .eq('run_id', runId)
        .order('sort_order');

      if (error) {
        throw error;
      }

      return (data ?? []).map((row) => ({
        id: row.id,
        candidateId: row.candidate_id,
        slug: row.slug,
        title: row.title,
        status: row.status,
      }));
    },
    async deleteByRunId(runId: string) {
      const { error } = await supabase.from('selected_items').delete().eq('run_id', runId);

      if (error) {
        throw error;
      }
    },
  };
}
