import { beforeEach, describe, expect, it, vi } from 'vitest';

const createSupabaseServerClient = vi.fn();
const createRunRepository = vi.fn();
const createCandidateRepository = vi.fn();
const createSelectedItemRepository = vi.fn();
const createArtifactRepository = vi.fn();
const createPushLogRepository = vi.fn();
const uploadArtifact = vi.fn();
const deleteArtifact = vi.fn();
const generateSelectedArtifactsForDailyRun = vi.fn();

vi.mock('../src/cloud/supabase/serverClient', () => ({
  createSupabaseServerClient,
}));

vi.mock('../src/cloud/repositories/runRepository', () => ({
  createRunRepository,
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

vi.mock('../src/cloud/storage/uploadArtifact', () => ({
  uploadArtifact,
  deleteArtifact,
}));

vi.mock('../src/orchestrator/runDailyPipeline', () => ({
  generateSelectedArtifactsForDailyRun,
}));

describe('handleGenerateRun', () => {
  const runRepository = {
    getById: vi.fn(),
    updateStatus: vi.fn().mockResolvedValue(undefined),
  };
  const candidateRepository = {
    listByRun: vi.fn(),
  };
  const selectedItemRepository = {
    createMany: vi.fn(),
    deleteByRunId: vi.fn().mockResolvedValue(undefined),
  };
  const artifactRepository = {
    create: vi.fn().mockResolvedValue(undefined),
    listByRun: vi.fn().mockResolvedValue([]),
    deleteByRunAndType: vi.fn().mockResolvedValue(undefined),
  };
  const pushLogRepository = {
    deleteByRunId: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    createSupabaseServerClient.mockReturnValue({});
    createRunRepository.mockReturnValue(runRepository);
    createCandidateRepository.mockReturnValue(candidateRepository);
    createSelectedItemRepository.mockReturnValue(selectedItemRepository);
    createArtifactRepository.mockReturnValue(artifactRepository);
    createPushLogRepository.mockReturnValue(pushLogRepository);
    runRepository.getById.mockResolvedValue({
      id: 'run-1',
      dateKey: '2026-05-01',
      triggerType: 'manual',
      status: 'running',
    });
    runRepository.updateStatus.mockResolvedValue(undefined);
    candidateRepository.listByRun.mockResolvedValue([
      {
        id: 'candidate-1',
        title: 'Alpha',
        source: 'github',
        summary: 'summary',
        rank: 1,
        selectionState: 'selected',
        tags: ['ops'],
        canonicalUrl: 'https://example.com/alpha',
      },
    ]);
    selectedItemRepository.createMany.mockResolvedValue([]);
    selectedItemRepository.deleteByRunId.mockResolvedValue(undefined);
    artifactRepository.create.mockResolvedValue(undefined);
    artifactRepository.listByRun.mockResolvedValue([]);
    artifactRepository.deleteByRunAndType.mockResolvedValue(undefined);
    pushLogRepository.deleteByRunId.mockResolvedValue(undefined);
    deleteArtifact.mockResolvedValue(undefined);
    uploadArtifact.mockResolvedValue({
      storagePath: 'runs/2026-05-01/push-digest.txt',
      publicUrl: 'https://cdn.example.com/push-digest.txt',
    });
  });

  it('uses the run dateKey when generating artifacts for a historical run', async () => {
    generateSelectedArtifactsForDailyRun.mockResolvedValue({
      selectedCount: 1,
      selectedItems: [],
      pushDigest: 'digest text',
      pushDigestArtifact: {
        storagePath: 'runs/2026-05-01/push-digest.txt',
        contentType: 'text/plain; charset=utf-8',
        mimeType: 'text/plain',
      },
      pushDecision: JSON.stringify({ runId: 'run-1', shouldPushToday: true }, null, 2),
      pushDecisionArtifact: {
        storagePath: 'runs/2026-05-01/push-decision.json',
        contentType: 'application/json',
        mimeType: 'application/json',
      },
    });
    const { handleGenerateRun } = await import('../src/cloud/routeHandlers/handleGenerateRun');

    await handleGenerateRun('run-1', ['candidate-1']);

    expect(generateSelectedArtifactsForDailyRun).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-1',
        dateKey: '2026-05-01',
        selectedCandidateIds: ['candidate-1'],
      }),
    );
  });

  it('clears stale selected items and generation artifacts before storing fresh generation outputs', async () => {
    artifactRepository.listByRun.mockResolvedValue([
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
    ]);
    generateSelectedArtifactsForDailyRun.mockResolvedValue({
      selectedCount: 1,
      selectedItems: [],
      pushDigest: 'digest text',
      pushDigestArtifact: {
        storagePath: 'runs/2026-05-01/push-digest.txt',
        contentType: 'text/plain; charset=utf-8',
        mimeType: 'text/plain',
      },
      pushDecision: JSON.stringify({ runId: 'run-1', shouldPushToday: true }, null, 2),
      pushDecisionArtifact: {
        storagePath: 'runs/2026-05-01/push-decision.json',
        contentType: 'application/json',
        mimeType: 'application/json',
      },
    });
    uploadArtifact
      .mockResolvedValueOnce({
        storagePath: 'runs/2026-05-01/push-digest.txt',
        publicUrl: 'https://cdn.example.com/push-digest.txt',
      })
      .mockResolvedValueOnce({
        storagePath: 'runs/2026-05-01/push-decision.json',
        publicUrl: 'https://cdn.example.com/push-decision.json',
      });
    const { handleGenerateRun } = await import('../src/cloud/routeHandlers/handleGenerateRun');

    await handleGenerateRun('run-1');

    expect(selectedItemRepository.deleteByRunId).toHaveBeenCalledWith('run-1');
    expect(deleteArtifact).toHaveBeenCalledWith('runs/2026-05-01/selected.html');
    expect(deleteArtifact).toHaveBeenCalledWith('runs/2026-05-01/selected.md');
    expect(deleteArtifact).toHaveBeenCalledWith('runs/2026-05-01/selected.png');
    expect(deleteArtifact).toHaveBeenCalledWith('runs/2026-05-01/push-digest.txt');
    expect(deleteArtifact).toHaveBeenCalledWith('runs/2026-05-01/push-decision.json');
    expect(artifactRepository.deleteByRunAndType).toHaveBeenCalledWith('run-1', 'selected_html');
    expect(artifactRepository.deleteByRunAndType).toHaveBeenCalledWith('run-1', 'selected_markdown');
    expect(artifactRepository.deleteByRunAndType).toHaveBeenCalledWith('run-1', 'selected_png');
    expect(artifactRepository.deleteByRunAndType).toHaveBeenCalledWith('run-1', 'push_digest');
    expect(artifactRepository.deleteByRunAndType).toHaveBeenCalledWith('run-1', 'push_decision');
  });

  it('clears stale push logs before storing fresh generation outputs', async () => {
    generateSelectedArtifactsForDailyRun.mockResolvedValue({
      selectedCount: 1,
      selectedItems: [],
      pushDigest: 'digest text',
      pushDigestArtifact: {
        storagePath: 'runs/2026-05-01/push-digest.txt',
        contentType: 'text/plain; charset=utf-8',
        mimeType: 'text/plain',
      },
      pushDecision: JSON.stringify({ runId: 'run-1', shouldPushToday: true }, null, 2),
      pushDecisionArtifact: {
        storagePath: 'runs/2026-05-01/push-decision.json',
        contentType: 'application/json',
        mimeType: 'application/json',
      },
    });
    uploadArtifact
      .mockResolvedValueOnce({
        storagePath: 'runs/2026-05-01/push-digest.txt',
        publicUrl: 'https://cdn.example.com/push-digest.txt',
      })
      .mockResolvedValueOnce({
        storagePath: 'runs/2026-05-01/push-decision.json',
        publicUrl: 'https://cdn.example.com/push-decision.json',
      });
    const { handleGenerateRun } = await import('../src/cloud/routeHandlers/handleGenerateRun');

    await handleGenerateRun('run-1');

    expect(pushLogRepository.deleteByRunId).toHaveBeenCalledWith('run-1');
  });

  it('clears stale push execution artifacts before storing fresh generation outputs', async () => {
    artifactRepository.listByRun.mockResolvedValue([
      {
        artifactType: 'push_execution',
        publicUrl: 'https://cdn.example.com/push-execution.json',
        storagePath: 'runs/run-1/push-execution.json',
      },
    ]);
    generateSelectedArtifactsForDailyRun.mockResolvedValue({
      selectedCount: 1,
      selectedItems: [],
      pushDigest: 'digest text',
      pushDigestArtifact: {
        storagePath: 'runs/2026-05-01/push-digest.txt',
        contentType: 'text/plain; charset=utf-8',
        mimeType: 'text/plain',
      },
      pushDecision: JSON.stringify({ runId: 'run-1', shouldPushToday: true }, null, 2),
      pushDecisionArtifact: {
        storagePath: 'runs/2026-05-01/push-decision.json',
        contentType: 'application/json',
        mimeType: 'application/json',
      },
    });
    uploadArtifact
      .mockResolvedValueOnce({
        storagePath: 'runs/2026-05-01/push-digest.txt',
        publicUrl: 'https://cdn.example.com/push-digest.txt',
      })
      .mockResolvedValueOnce({
        storagePath: 'runs/2026-05-01/push-decision.json',
        publicUrl: 'https://cdn.example.com/push-decision.json',
      });
    const { handleGenerateRun } = await import('../src/cloud/routeHandlers/handleGenerateRun');

    await handleGenerateRun('run-1');

    expect(artifactRepository.listByRun).toHaveBeenCalledWith('run-1');
    expect(deleteArtifact).toHaveBeenCalledWith('runs/run-1/push-execution.json');
    expect(artifactRepository.deleteByRunAndType).toHaveBeenCalledWith('run-1', 'push_execution');
  });

  it('uploads and stores both push digest and push decision artifacts', async () => {
    generateSelectedArtifactsForDailyRun.mockResolvedValue({
      selectedCount: 1,
      selectedItems: [],
      pushDigest: 'digest text',
      pushDigestArtifact: {
        storagePath: 'runs/2026-05-01/push-digest.txt',
        contentType: 'text/plain; charset=utf-8',
        mimeType: 'text/plain',
      },
      pushDecision: JSON.stringify({ runId: 'run-1', shouldPushToday: true }, null, 2),
      pushDecisionArtifact: {
        storagePath: 'runs/2026-05-01/push-decision.json',
        contentType: 'application/json',
        mimeType: 'application/json',
      },
    });
    uploadArtifact
      .mockResolvedValueOnce({
        storagePath: 'runs/2026-05-01/push-digest.txt',
        publicUrl: 'https://cdn.example.com/push-digest.txt',
      })
      .mockResolvedValueOnce({
        storagePath: 'runs/2026-05-01/push-decision.json',
        publicUrl: 'https://cdn.example.com/push-decision.json',
      });
    const { handleGenerateRun } = await import('../src/cloud/routeHandlers/handleGenerateRun');

    await handleGenerateRun('run-1');

    expect(uploadArtifact).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        storagePath: 'runs/2026-05-01/push-digest.txt',
        body: 'digest text',
        contentType: 'text/plain; charset=utf-8',
      }),
    );
    expect(uploadArtifact).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        storagePath: 'runs/2026-05-01/push-decision.json',
        body: JSON.stringify({ runId: 'run-1', shouldPushToday: true }, null, 2),
        contentType: 'application/json',
      }),
    );
    expect(artifactRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-1',
        artifactType: 'push_digest',
        storagePath: 'runs/2026-05-01/push-digest.txt',
      }),
    );
    expect(artifactRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-1',
        artifactType: 'push_decision',
        storagePath: 'runs/2026-05-01/push-decision.json',
        mimeType: 'application/json',
      }),
    );
  });

  it('marks the run failed and stores the error message when generation throws', async () => {
    generateSelectedArtifactsForDailyRun.mockRejectedValue(new Error('artifact generation failed'));
    const { handleGenerateRun } = await import('../src/cloud/routeHandlers/handleGenerateRun');

    await expect(handleGenerateRun('run-1')).rejects.toThrow('artifact generation failed');

    expect(runRepository.updateStatus).toHaveBeenCalledWith(
      'run-1',
      expect.objectContaining({
        status: 'failed',
        errorMessage: 'artifact generation failed',
      }),
    );
  });

  it('marks the run failed when listing candidates throws before generation starts', async () => {
    candidateRepository.listByRun.mockRejectedValue(new Error('candidate lookup failed'));
    const { handleGenerateRun } = await import('../src/cloud/routeHandlers/handleGenerateRun');

    await expect(handleGenerateRun('run-1')).rejects.toThrow('candidate lookup failed');

    expect(runRepository.updateStatus).toHaveBeenCalledWith(
      'run-1',
      expect.objectContaining({
        status: 'failed',
        errorMessage: 'candidate lookup failed',
      }),
    );
  });
});
