import { loadCloudConfig } from '../loadCloudConfig';
import { createSupabaseServerClient } from '../supabase/serverClient';

export interface UploadedArtifact {
  storagePath: string;
  publicUrl: string;
}

export async function uploadArtifact(input: {
  storagePath: string;
  body: Buffer | string;
  contentType: string;
}): Promise<UploadedArtifact> {
  const supabase = createSupabaseServerClient();
  const config = loadCloudConfig(process.env);
  const body = typeof input.body === 'string' ? Buffer.from(input.body, 'utf8') : input.body;

  const { error } = await supabase.storage.from(config.storageBucket).upload(input.storagePath, body, {
    contentType: input.contentType,
    upsert: true,
  });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from(config.storageBucket).getPublicUrl(input.storagePath);

  return {
    storagePath: input.storagePath,
    publicUrl: data.publicUrl,
  };
}

export async function downloadArtifactText(storagePath: string) {
  const supabase = createSupabaseServerClient();
  const config = loadCloudConfig(process.env);
  const { data, error } = await supabase.storage.from(config.storageBucket).download(storagePath);

  if (error || !data) {
    throw error ?? new Error('Failed to download artifact');
  }

  return data.text();
}

export async function deleteArtifact(storagePath: string) {
  const supabase = createSupabaseServerClient();
  const config = loadCloudConfig(process.env);
  const { error } = await supabase.storage.from(config.storageBucket).remove([storagePath]);

  if (error) {
    throw error;
  }
}
