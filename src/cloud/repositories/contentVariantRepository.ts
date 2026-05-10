import { PostgrestError } from '@supabase/supabase-js';
import type { CloudContentVariant, CloudContentVariantStatus, CloudPublicationChannel } from '../types';

interface ContentVariantRow {
  id: string;
  run_id: string;
  candidate_id?: string | null;
  selected_item_id?: string | null;
  channel: CloudPublicationChannel;
  title: string;
  body: string;
  status: CloudContentVariantStatus;
  published_at?: string | null;
  review_notes?: string | null;
}

interface SingleResult {
  data: ContentVariantRow | null;
  error: unknown;
}

interface ListResult {
  data: ContentVariantRow[] | null;
  error: unknown;
}

interface SupabaseLike {
  from(table: string): {
    insert(value: unknown): {
      select(): {
        single(): Promise<SingleResult>;
      };
    };
    update(value: unknown): {
      eq(column: string, value: string): {
        select(): {
          single(): Promise<SingleResult>;
        };
      };
    };
    select(columns: string): {
      eq(column: string, value: string): {
        eq(column: string, value: string): {
          order(column: string, options?: { ascending: boolean }): Promise<ListResult>;
        };
        order(column: string, options?: { ascending: boolean }): Promise<ListResult>;
      };
      in(column: string, values: string[]): {
        order(column: string, options?: { ascending: boolean }): Promise<ListResult>;
      };
    };
  };
}

function mapContentVariant(row: ContentVariantRow): CloudContentVariant {
  return {
    id: row.id,
    runId: row.run_id,
    candidateId: row.candidate_id ?? undefined,
    selectedItemId: row.selected_item_id ?? undefined,
    channel: row.channel,
    title: row.title,
    body: row.body,
    status: row.status,
    publishedAt: row.published_at ?? undefined,
    reviewNotes: row.review_notes ?? '',
  };
}

function isMissingContentVariantFieldError(error: unknown) {
  if (!(error instanceof PostgrestError)) {
    return false;
  }

  return error.code === 'PGRST204' && /review_notes/.test(error.message);
}

export function createContentVariantRepository(supabase: SupabaseLike) {
  return {
    async create(input: {
      runId: string;
      candidateId?: string;
      selectedItemId?: string;
      channel: CloudPublicationChannel;
      title: string;
      body: string;
      status?: CloudContentVariantStatus;
      publishedAt?: string;
      reviewNotes?: string;
    }): Promise<CloudContentVariant> {
      const payload: {
        run_id: string;
        channel: CloudPublicationChannel;
        title: string;
        body: string;
        status: CloudContentVariantStatus;
        candidate_id?: string;
        selected_item_id?: string;
        published_at?: string;
        review_notes?: string;
      } = {
        run_id: input.runId,
        channel: input.channel,
        title: input.title,
        body: input.body,
        status: input.status ?? 'draft',
      };

      if (input.candidateId) {
        payload.candidate_id = input.candidateId;
      }

      if (input.selectedItemId) {
        payload.selected_item_id = input.selectedItemId;
      }

      if (input.publishedAt) {
        payload.published_at = input.publishedAt;
      }

      if (input.reviewNotes !== undefined) {
        payload.review_notes = input.reviewNotes;
      }

      const { data, error } = await supabase.from('content_variants').insert(payload).select().single();

      if (error || !data) {
        throw error ?? new Error('Failed to create content variant');
      }

      return mapContentVariant(data);
    },
    async updateById(
      id: string,
      input: {
        candidateId?: string;
        title: string;
        body: string;
        status: CloudContentVariantStatus;
        publishedAt?: string;
      },
    ): Promise<CloudContentVariant> {
      const payload: {
        candidate_id?: string;
        title: string;
        body: string;
        status: CloudContentVariantStatus;
        published_at?: string;
      } = {
        title: input.title,
        body: input.body,
        status: input.status,
      };

      if (input.candidateId) {
        payload.candidate_id = input.candidateId;
      }

      if (input.publishedAt) {
        payload.published_at = input.publishedAt;
      }

      const { data, error } = await supabase.from('content_variants').update(payload).eq('id', id).select().single();

      if (error || !data) {
        throw error ?? new Error('Failed to update content variant');
      }

      return mapContentVariant(data);
    },
    async listByRun(runId: string): Promise<CloudContentVariant[]> {
      const loadRows = async (columns: string) =>
        supabase.from('content_variants').select(columns).eq('run_id', runId).order('id');

      let result = await loadRows('id,run_id,candidate_id,selected_item_id,channel,title,body,status,published_at,review_notes');

      if (result.error && isMissingContentVariantFieldError(result.error)) {
        result = await loadRows('id,run_id,candidate_id,selected_item_id,channel,title,body,status,published_at');
      }

      if (result.error) {
        throw result.error;
      }

      return (result.data ?? []).map(mapContentVariant);
    },
    async listByRunIds(runIds: string[]): Promise<CloudContentVariant[]> {
      if (runIds.length === 0) {
        return [];
      }

      const loadRows = async (columns: string) =>
        supabase.from('content_variants').select(columns).in('run_id', runIds).order('published_at', { ascending: false });

      let result = await loadRows('id,run_id,candidate_id,selected_item_id,channel,title,body,status,published_at,review_notes');

      if (result.error && isMissingContentVariantFieldError(result.error)) {
        result = await loadRows('id,run_id,candidate_id,selected_item_id,channel,title,body,status,published_at');
      }

      if (result.error) {
        throw result.error;
      }

      return (result.data ?? []).map(mapContentVariant);
    },
    async listPublishedByChannel(channel: CloudPublicationChannel): Promise<CloudContentVariant[]> {
      const loadRows = async (columns: string) =>
        supabase.from('content_variants').select(columns).eq('channel', channel).eq('status', 'published').order('published_at', { ascending: false });

      let result = await loadRows('id,run_id,candidate_id,selected_item_id,channel,title,body,status,published_at,review_notes');

      if (result.error && isMissingContentVariantFieldError(result.error)) {
        result = await loadRows('id,run_id,candidate_id,selected_item_id,channel,title,body,status,published_at');
      }

      if (result.error) {
        throw result.error;
      }

      return (result.data ?? []).map(mapContentVariant);
    },
  };
}
