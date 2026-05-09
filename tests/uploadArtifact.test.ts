import { beforeEach, describe, expect, it, vi } from 'vitest';

const createSupabaseServerClient = vi.fn();
const loadCloudConfig = vi.fn();

vi.mock('../src/cloud/supabase/serverClient', () => ({
  createSupabaseServerClient,
}));

vi.mock('../src/cloud/loadCloudConfig', () => ({
  loadCloudConfig,
}));

describe('artifact storage helpers', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    loadCloudConfig.mockReturnValue({ storageBucket: 'artifacts' });
  });

  it('deletes artifact from configured storage bucket', async () => {
    const remove = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ remove });
    createSupabaseServerClient.mockReturnValue({
      storage: { from },
    });

    const { deleteArtifact } = await import('../src/cloud/storage/uploadArtifact');
    await deleteArtifact('runs/run-1/push-execution.json');

    expect(from).toHaveBeenCalledWith('artifacts');
    expect(remove).toHaveBeenCalledWith(['runs/run-1/push-execution.json']);
  });
});
