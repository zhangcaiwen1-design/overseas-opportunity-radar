import type { CloudPublicationAction, CloudPublicationChannel, CloudPublicationLog } from '../types';

interface PublicationLogRow {
  id: string;
  content_variant_id: string;
  channel: CloudPublicationChannel;
  action: CloudPublicationAction;
  status: string;
  response_summary: string;
  operator: string;
  created_at?: string;
}

interface InsertResult {
  data: PublicationLogRow | null;
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
      in(column: string, values: string[]): {
        order(column: string, options?: { ascending: boolean }): Promise<{
          data: PublicationLogRow[] | null;
          error: unknown;
        }>;
      };
    };
  };
}

function mapPublicationLog(row: PublicationLogRow): CloudPublicationLog {
  return {
    id: row.id,
    contentVariantId: row.content_variant_id,
    channel: row.channel,
    action: row.action,
    status: row.status,
    responseSummary: row.response_summary,
    operator: row.operator,
    createdAt: row.created_at,
  };
}

export function createPublicationLogRepository(supabase: SupabaseLike) {
  return {
    async create(input: {
      contentVariantId: string;
      channel: CloudPublicationChannel;
      action: CloudPublicationAction;
      status: string;
      responseSummary: string;
      operator: string;
    }): Promise<CloudPublicationLog> {
      const { data, error } = await supabase
        .from('publication_logs')
        .insert({
          content_variant_id: input.contentVariantId,
          channel: input.channel,
          action: input.action,
          status: input.status,
          response_summary: input.responseSummary,
          operator: input.operator,
        })
        .select()
        .single();

      if (error || !data) {
        throw error ?? new Error('Failed to create publication log');
      }

      return mapPublicationLog(data);
    },
    async listByContentVariantIds(contentVariantIds: string[]): Promise<CloudPublicationLog[]> {
      if (contentVariantIds.length === 0) {
        return [];
      }

      const { data, error } = await supabase
        .from('publication_logs')
        .select('id,content_variant_id,channel,action,status,response_summary,operator,created_at')
        .in('content_variant_id', contentVariantIds)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return (data ?? []).map(mapPublicationLog);
    },
  };
}
