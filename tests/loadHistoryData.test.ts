import { beforeEach, describe, expect, it, vi } from 'vitest';

const createSupabaseServerClient = vi.fn();
const createRunRepository = vi.fn();
const createArtifactRepository = vi.fn();
const createPushLogRepository = vi.fn();
const createContentVariantRepository = vi.fn();
const createPublicationLogRepository = vi.fn();

vi.mock('../src/cloud/supabase/serverClient', () => ({
  createSupabaseServerClient,
}));

vi.mock('../src/cloud/repositories/runRepository', () => ({
  createRunRepository,
}));

vi.mock('../src/cloud/repositories/artifactRepository', () => ({
  createArtifactRepository,
}));

vi.mock('../src/cloud/repositories/pushLogRepository', () => ({
  createPushLogRepository,
}));

vi.mock('../src/cloud/repositories/contentVariantRepository', () => ({
  createContentVariantRepository,
}));

vi.mock('../src/cloud/repositories/publicationLogRepository', () => ({
  createPublicationLogRepository,
}));

describe('loadHistoryData', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  it('loads detailed history with batched content variants and publication logs', async () => {
    createSupabaseServerClient.mockReturnValue({});
    createRunRepository.mockReturnValue({
      listRecent: vi.fn().mockResolvedValue([
        {
          id: 'run-2',
          dateKey: '2026-05-08',
          triggerType: 'manual',
          status: 'completed',
          startedAt: '2026-05-08T02:00:00.000Z',
          selectedCount: 4,
          poolCount: 10,
          summaryText: '生成了 4 条成稿',
          errorMessage: '',
        },
        {
          id: 'run-1',
          dateKey: '2026-05-07',
          triggerType: 'cron',
          status: 'failed',
          startedAt: '2026-05-07T02:00:00.000Z',
          selectedCount: 1,
          poolCount: 8,
          summaryText: '',
          errorMessage: 'timeout',
        },
      ]),
    });
    createArtifactRepository.mockReturnValue({
      listByRunIds: vi.fn().mockResolvedValue([
        {
          runId: 'run-2',
          artifactType: 'push_execution',
          publicUrl: 'https://cdn.example.com/push-execution.json',
          storagePath: 'runs/2026-05-08/push-execution.json',
        },
      ]),
    });
    createPushLogRepository.mockReturnValue({
      listByRunIds: vi.fn().mockResolvedValue([
        { runId: 'run-2', channel: 'feishu', status: 'success', responseSummary: 'ok' },
      ]),
    });
    const listByRun = vi.fn();
    const listByRunIds = vi.fn().mockResolvedValue([
      {
        id: 'variant-1',
        runId: 'run-2',
        candidateId: 'candidate-1',
        selectedItemId: 'selected-1',
        channel: 'site',
        title: '站点稿件 A',
        body: 'body-a',
        status: 'published',
        publishedAt: '2026-05-08T02:15:00.000Z',
        reviewNotes: '',
      },
    ]);
    createContentVariantRepository.mockReturnValue({
      listByRun,
      listByRunIds,
    });
    const listByContentVariantIds = vi.fn().mockResolvedValue([
      {
        id: 'publication-log-1',
        contentVariantId: 'variant-1',
        channel: 'site',
        action: 'publish',
        status: 'success',
        responseSummary: 'Published to /posts/a',
        operator: 'system',
        createdAt: '2026-05-08T02:16:00.000Z',
      },
    ]);
    createPublicationLogRepository.mockReturnValue({
      listByContentVariantIds,
    });

    const { loadHistoryData } = await import('../src/cloud/queries/loadHistoryData');
    const result = await loadHistoryData();

    expect(result).toEqual([
      expect.objectContaining({
        id: 'run-2',
        artifacts: [
          expect.objectContaining({
            artifactType: 'push_execution',
          }),
        ],
        pushLogs: [
          expect.objectContaining({
            channel: 'feishu',
          }),
        ],
        contentVariants: [
          expect.objectContaining({
            id: 'variant-1',
          }),
        ],
        publicationLogs: [
          expect.objectContaining({
            responseSummary: 'Published to /posts/a',
          }),
        ],
      }),
      expect.objectContaining({
        id: 'run-1',
        contentVariants: [],
        publicationLogs: [],
      }),
    ]);
    expect(listByRun).not.toHaveBeenCalled();
    expect(listByRunIds).toHaveBeenCalledWith(['run-2', 'run-1']);
    expect(listByContentVariantIds).toHaveBeenCalledWith(['variant-1']);
  });
});
