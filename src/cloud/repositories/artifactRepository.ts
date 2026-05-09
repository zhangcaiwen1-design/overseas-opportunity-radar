import type { CloudArtifactLink } from '../types';

export interface CloudArtifactHistoryLink extends CloudArtifactLink {
  runId: string;
}

interface SupabaseLike {
  from(table: string): {
    insert(value: unknown): Promise<{ error: unknown }>;
    delete(): {
      eq(column: string, value: string): {
        eq(column: string, value: string): Promise<{ error: unknown }>;
      };
    };
    select(columns: string): {
      eq(column: string, value: string): {
        order(column: string): Promise<{
          data: Array<{ run_id?: string; selected_item_id?: string | null; artifact_type: string; public_url: string; storage_path: string }> | null;
          error: unknown;
        }>;
      };
      in(column: string, values: string[]): {
        order(column: string): Promise<{
          data: Array<{ run_id: string; selected_item_id?: string | null; artifact_type: string; public_url: string; storage_path: string }> | null;
          error: unknown;
        }>;
      };
    };
  };
}

export function createArtifactRepository(supabase: SupabaseLike) {
  return {
    async create(input: {
      runId: string;
      selectedItemId?: string;
      artifactType: string;
      storagePath: string;
      publicUrl: string;
      mimeType: string;
      status?: string;
    }) {
      const { error } = await supabase.from('artifacts').insert({
        run_id: input.runId,
        selected_item_id: input.selectedItemId,
        artifact_type: input.artifactType,
        storage_path: input.storagePath,
        public_url: input.publicUrl,
        mime_type: input.mimeType,
        status: input.status ?? 'ready',
      });

      if (error) {
        throw error;
      }
    },
    async listByRun(runId: string): Promise<CloudArtifactLink[]> {
      const { data, error } = await supabase
        .from('artifacts')
        .select('selected_item_id,artifact_type,public_url,storage_path')
        .eq('run_id', runId)
        .order('artifact_type');

      if (error) {
        throw error;
      }

      return (data ?? []).map((row) => ({
        artifactType: row.artifact_type,
        publicUrl: row.public_url,
        storagePath: row.storage_path,
        selectedItemId: row.selected_item_id ?? undefined,
      }));
    },
    async listByRunIds(runIds: string[]): Promise<CloudArtifactHistoryLink[]> {
      if (runIds.length === 0) {
        return [];
      }

      const { data, error } = await supabase
        .from('artifacts')
        .select('run_id,selected_item_id,artifact_type,public_url,storage_path')
        .in('run_id', runIds)
        .order('artifact_type');

      if (error) {
        throw error;
      }

      return (data ?? []).map((row) => ({
        runId: row.run_id,
        selectedItemId: row.selected_item_id ?? undefined,
        artifactType: row.artifact_type,
        publicUrl: row.public_url,
        storagePath: row.storage_path,
      }));
    },
    async deleteByRunAndType(runId: string, artifactType: string) {
      const { error } = await supabase.from('artifacts').delete().eq('run_id', runId).eq('artifact_type', artifactType);

      if (error) {
        throw error;
      }
    },
  };
}
