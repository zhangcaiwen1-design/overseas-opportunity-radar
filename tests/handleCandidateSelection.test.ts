import { beforeEach, describe, expect, it, vi } from 'vitest';

const createSupabaseServerClient = vi.fn();
const createCandidateRepository = vi.fn();
const createSelectedItemRepository = vi.fn();
const createArtifactRepository = vi.fn();
const createPushLogRepository = vi.fn();
const createRunRepository = vi.fn();
const deleteArtifact = vi.fn();

vi.mock('../src/cloud/supabase/serverClient', () => ({
  createSupabaseServerClient,
}));

vi.mock('../src/cloud/repositories/candidateRepository', () => ({
  createCandidateRepository,
}));

vi.mock('../src/cloud/repositories/selectedItemRepository', () => ({
  createSelectedItemRepository,
}));

vi.mock('../src/cloud/repositories/artifactRepository', () => ({
  createArtifactRepository,
}));

vi.mock('../src/cloud/repositories/pushLogRepository', () => ({
  createPushLogRepository,
}));

vi.mock('../src/cloud/repositories/runRepository', () => ({
  createRunRepository,
}));

vi.mock('../src/cloud/storage/uploadArtifact', () => ({
  deleteArtifact,
}));

describe('handleCandidateSelection', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    createSupabaseServerClient.mockReturnValue({});
    createCandidateRepository.mockReturnValue({
      updateSelectionState: vi.fn().mockResolvedValue(undefined),
    });
    createSelectedItemRepository.mockReturnValue({
      deleteByRunId: vi.fn().mockResolvedValue(undefined),
    });
    createArtifactRepository.mockReturnValue({
      listByRun: vi.fn().mockResolvedValue([]),
      deleteByRunAndType: vi.fn().mockResolvedValue(undefined),
    });
    createPushLogRepository.mockReturnValue({
      deleteByRunId: vi.fn().mockResolvedValue(undefined),
    });
    createRunRepository.mockReturnValue({
      updateStatus: vi.fn().mockResolvedValue(undefined),
    });
    deleteArtifact.mockResolvedValue(undefined);
  });

  it('clears stale generation and push outputs after selection changes', async () => {
    const updateSelectionState = vi.fn().mockResolvedValue(undefined);
    createCandidateRepository.mockReturnValue({ updateSelectionState });
    const deleteSelectedItems = vi.fn().mockResolvedValue(undefined);
    createSelectedItemRepository.mockReturnValue({
      deleteByRunId: deleteSelectedItems,
    });
    const deleteByRunAndType = vi.fn().mockResolvedValue(undefined);
    createArtifactRepository.mockReturnValue({
      listByRun: vi.fn().mockResolvedValue([
        {
          artifactType: 'selected_html',
          publicUrl: 'https://cdn.example.com/selected.html',
          storagePath: 'runs/2026-05-01/selected.html',
        },
        {
          artifactType: 'selected_markdown',
          publicUrl: 'https://cdn.example.com/selected.md',
          storagePath: 'runs/2026-05-01/selected.md',
        },
        {
          artifactType: 'selected_png',
          publicUrl: 'https://cdn.example.com/selected.png',
          storagePath: 'runs/2026-05-01/selected.png',
        },
        {
          artifactType: 'push_digest',
          publicUrl: 'https://cdn.example.com/push-digest.txt',
          storagePath: 'runs/2026-05-01/push-digest.txt',
        },
        {
          artifactType: 'push_decision',
          publicUrl: 'https://cdn.example.com/push-decision.json',
          storagePath: 'runs/2026-05-01/push-decision.json',
        },
        {
          artifactType: 'push_execution',
          publicUrl: 'https://cdn.example.com/push-execution.json',
          storagePath: 'runs/2026-05-01/push-execution.json',
        },
      ]),
      deleteByRunAndType,
    });
    const deletePushLogs = vi.fn().mockResolvedValue(undefined);
    createPushLogRepository.mockReturnValue({
      deleteByRunId: deletePushLogs,
    });
    const updateStatus = vi.fn().mockResolvedValue(undefined);
    createRunRepository.mockReturnValue({
      updateStatus,
    });

    const { handleCandidateSelection } = await import('../src/cloud/routeHandlers/handleCandidateSelection');
    const result = await handleCandidateSelection('run-1', 'candidate-1', 'selected', 0);

    expect(result).toEqual({
      runId: 'run-1',
      candidateId: 'candidate-1',
      selectionState: 'selected',
      draftSortOrder: 0,
    });
    expect(updateSelectionState).toHaveBeenCalledWith('run-1', 'candidate-1', 'selected', 0);
    expect(deleteSelectedItems).toHaveBeenCalledWith('run-1');
    expect(deletePushLogs).toHaveBeenCalledWith('run-1');
    expect(updateStatus).toHaveBeenCalledWith(
      'run-1',
      expect.objectContaining({
        status: 'running',
        selectedCount: 0,
        summaryText: '',
        errorMessage: '',
      }),
    );
    expect(deleteArtifact).toHaveBeenCalledWith('runs/2026-05-01/selected.html');
    expect(deleteArtifact).toHaveBeenCalledWith('runs/2026-05-01/selected.md');
    expect(deleteArtifact).toHaveBeenCalledWith('runs/2026-05-01/selected.png');
    expect(deleteArtifact).toHaveBeenCalledWith('runs/2026-05-01/push-digest.txt');
    expect(deleteArtifact).toHaveBeenCalledWith('runs/2026-05-01/push-decision.json');
    expect(deleteArtifact).toHaveBeenCalledWith('runs/2026-05-01/push-execution.json');
    expect(deleteByRunAndType).toHaveBeenCalledWith('run-1', 'selected_html');
    expect(deleteByRunAndType).toHaveBeenCalledWith('run-1', 'selected_markdown');
    expect(deleteByRunAndType).toHaveBeenCalledWith('run-1', 'selected_png');
    expect(deleteByRunAndType).toHaveBeenCalledWith('run-1', 'push_digest');
    expect(deleteByRunAndType).toHaveBeenCalledWith('run-1', 'push_decision');
    expect(deleteByRunAndType).toHaveBeenCalledWith('run-1', 'push_execution');
  });
});
