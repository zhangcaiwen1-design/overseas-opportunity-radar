import { PostgrestError } from '@supabase/supabase-js';
import type { CloudLeadEvent, CloudLeadEventType, CloudPublicationChannel } from '../types';

interface LeadEventRow {
  id: string;
  source_channel: CloudPublicationChannel;
  page_type: string;
  event_type: CloudLeadEventType;
  contact?: string;
  notes?: string;
  created_at?: string;
}

interface InsertResult {
  data: LeadEventRow | null;
  error: unknown;
}

interface SelectLimitResult {
  data: LeadEventRow[] | null;
  error: unknown;
}

interface SupabaseLike {
  from(table: string): {
    insert(value: unknown): {
      select(): {
        single(): Promise<InsertResult>;
      };
    };
    select(columns: string): {
      order(column: string, options?: { ascending: boolean }): {
        limit(count: number): Promise<SelectLimitResult>;
      };
    };
  };
}

function mapLeadEvent(row: LeadEventRow): CloudLeadEvent {
  return {
    id: row.id,
    sourceChannel: row.source_channel,
    pageType: row.page_type,
    eventType: row.event_type,
    contact: row.contact ?? '',
    notes: row.notes ?? '',
    createdAt: row.created_at,
  };
}

function isMissingLeadEventFieldError(error: unknown) {
  if (!(error instanceof PostgrestError)) {
    return false;
  }

  return error.code === 'PGRST204' && /contact|notes/.test(error.message);
}

export function createLeadEventRepository(supabase: SupabaseLike) {
  return {
    async create(input: {
      sourceChannel: CloudPublicationChannel;
      pageType: string;
      eventType: CloudLeadEventType;
      contact: string;
      notes: string;
    }): Promise<CloudLeadEvent> {
      const { data, error } = await supabase
        .from('lead_events')
        .insert({
          source_channel: input.sourceChannel,
          page_type: input.pageType,
          event_type: input.eventType,
          contact: input.contact,
          notes: input.notes,
        })
        .select()
        .single();

      if (error || !data) {
        throw error ?? new Error('Failed to create lead event');
      }

      return mapLeadEvent(data);
    },
    async listRecent(limit = 20): Promise<CloudLeadEvent[]> {
      const loadRows = async (columns: string) =>
        supabase
          .from('lead_events')
          .select(columns)
          .order('created_at', { ascending: false })
          .limit(limit);

      let result = await loadRows('id,source_channel,page_type,event_type,contact,notes,created_at');

      if (result.error && isMissingLeadEventFieldError(result.error)) {
        result = await loadRows('id,source_channel,page_type,event_type,created_at');
      }

      if (result.error) {
        throw result.error;
      }

      return (result.data ?? []).map(mapLeadEvent);
    },
  };
}
