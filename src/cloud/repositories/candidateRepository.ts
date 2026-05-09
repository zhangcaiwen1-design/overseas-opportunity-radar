import type { CandidateRecord } from '../services/collectCandidatesForRun';
import type { CloudCandidate } from '../types';

interface SupabaseLike {
  from(table: string): {
    insert(value: unknown): Promise<{ error: unknown }>;
    update(value: unknown): {
      eq(column: string, value: string): {
        eq(column: string, value: string): Promise<{ error: unknown }>;
      };
    };
    select(columns: string): {
      eq(column: string, value: string): {
        order(column: string): Promise<{
          data: Array<{
            id: string;
            title: string;
            source: string;
            summary: string;
            rank: number;
            draft_sort_order?: number | null;
            selection_state: CloudCandidate['selectionState'];
            tags: string[];
            canonical_url: string;
          }> | null;
          error: unknown;
        }>;
      };
    };
  };
}

export function createCandidateRepository(supabase: SupabaseLike) {
  return {
    async createMany(runId: string, candidates: CandidateRecord[]) {
      const { error } = await supabase.from('candidates').insert(
        candidates.map((candidate) => ({
          run_id: runId,
          signal_id: candidate.signalId,
          source: candidate.source,
          title: candidate.title,
          summary: candidate.summary,
          canonical_url: candidate.canonicalUrl,
          published_at: candidate.publishedAt,
          tags: candidate.tags,
          raw_score: candidate.rawScore,
          rank: candidate.rank,
          selection_state: 'pending',
        })),
      );

      if (error) {
        throw error;
      }
    },
    async listByRun(runId: string): Promise<CloudCandidate[]> {
      const { data, error } = await supabase
        .from('candidates')
        .select('id,title,source,summary,rank,draft_sort_order,selection_state,tags,canonical_url')
        .eq('run_id', runId)
        .order('rank');

      if (error) {
        throw error;
      }

      return (data ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        source: row.source,
        summary: row.summary,
        rank: row.rank,
        draftSortOrder: row.draft_sort_order ?? undefined,
        selectionState: row.selection_state,
        tags: row.tags,
        canonicalUrl: row.canonical_url,
      }));
    },
    async updateSelectionState(
      runId: string,
      candidateId: string,
      selectionState: CloudCandidate['selectionState'],
      draftSortOrder?: number,
    ) {
      const { error } = await supabase
        .from('candidates')
        .update({
          selection_state: selectionState,
          draft_sort_order: selectionState === 'selected' ? draftSortOrder : null,
        })
        .eq('run_id', runId)
        .eq('id', candidateId);

      if (error) {
        throw error;
      }
    },
  };
}
