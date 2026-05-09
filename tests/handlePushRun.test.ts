import { beforeEach, describe, expect, it, vi } from 'vitest';

const createSupabaseServerClient = vi.fn();
const createArtifactRepository = vi.fn();
const createPushConfigRepository = vi.fn();
const createPushLogRepository = vi.fn();
const downloadArtifactText = vi.fn();
const uploadArtifact = vi.fn();
const deleteArtifact = vi.fn();
const sendRunPushes = vi.fn();
const sendInternalAlert = vi.fn();

vi.mock('../src/cloud/supabase/serverClient', () => ({
  createSupabaseServerClient,
}));

vi.mock('../src/cloud/repositories/artifactRepository', () => ({
  createArtifactRepository,
}));

vi.mock('../src/cloud/repositories/pushConfigRepository', () => ({
  createPushConfigRepository,
}));

vi.mock('../src/cloud/repositories/pushLogRepository', () => ({
  createPushLogRepository,
}));

vi.mock('../src/cloud/storage/uploadArtifact', () => ({
  downloadArtifactText,
  uploadArtifact,
  deleteArtifact,
}));

vi.mock('../src/cloud/services/sendRunPushes', () => ({
  sendRunPushes,
  sendInternalAlert,
}));

describe('handlePushRun', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    createSupabaseServerClient.mockReturnValue({});
    createArtifactRepository.mockReturnValue({
      listByRun: vi.fn().mockResolvedValue([]),
      deleteByRunAndType: vi.fn().mockResolvedValue(undefined),
      create: vi.fn().mockResolvedValue(undefined),
    });
    createPushConfigRepository.mockReturnValue({ listEnabled: vi.fn().mockResolvedValue([]) });
    createPushLogRepository.mockReturnValue({
      create: vi.fn().mockResolvedValue(undefined),
      deleteByRunId: vi.fn().mockResolvedValue(undefined),
    });
    deleteArtifact.mockResolvedValue(undefined);
    uploadArtifact.mockResolvedValue({
      storagePath: 'runs/run-1/push-execution.json',
      publicUrl: 'https://cdn.example.com/push-execution.json',
    });
  });

  it('skips push delivery when no push digest artifact exists', async () => {
    const { handlePushRun } = await import('../src/cloud/routeHandlers/handlePushRun');

    const result = await handlePushRun('run-1');

    expect(result).toEqual({
      ok: false,
      reason: 'push digest unavailable',
      status: { feishu: false, wecom: false, wxpusher: false },
    });
    expect(downloadArtifactText).not.toHaveBeenCalled();
    expect(sendRunPushes).not.toHaveBeenCalled();
  });

  it('skips push delivery when the push digest cannot be downloaded', async () => {
    createArtifactRepository.mockReturnValue({
      listByRun: vi.fn().mockResolvedValue([{ artifactType: 'push_digest', storagePath: 'runs/run-1/push.txt' }]),
    });
    downloadArtifactText.mockRejectedValue(new Error('storage unavailable'));
    const { handlePushRun } = await import('../src/cloud/routeHandlers/handlePushRun');

    const result = await handlePushRun('run-1');

    expect(result).toEqual({
      ok: false,
      reason: 'push digest unavailable',
      status: { feishu: false, wecom: false, wxpusher: false },
    });
    expect(downloadArtifactText).toHaveBeenCalledWith('runs/run-1/push.txt');
    expect(sendRunPushes).not.toHaveBeenCalled();
  });

  it('clears stale push logs and push execution before delivering push', async () => {
    const deleteByRunAndType = vi.fn().mockResolvedValue(undefined);
    const createArtifact = vi.fn().mockResolvedValue(undefined);
    createArtifactRepository.mockReturnValue({
      listByRun: vi.fn().mockResolvedValue([
        { artifactType: 'push_digest', storagePath: 'runs/run-1/push.txt' },
        { artifactType: 'push_execution', storagePath: 'runs/run-1/push-execution.json' },
      ]),
      deleteByRunAndType,
      create: createArtifact,
    });
    const deleteByRunId = vi.fn().mockResolvedValue(undefined);
    createPushLogRepository.mockReturnValue({
      create: vi.fn().mockResolvedValue(undefined),
      deleteByRunId,
    });
    createPushConfigRepository.mockReturnValue({
      listEnabled: vi.fn().mockResolvedValue([{ channel: 'feishu', enabled: true, secretPayload: 'feishu-hook' }]),
    });
    downloadArtifactText.mockResolvedValue('Digest');
    sendRunPushes.mockResolvedValue({ feishu: true, wecom: false, wxpusher: false });
    const { handlePushRun } = await import('../src/cloud/routeHandlers/handlePushRun');

    await handlePushRun('run-1');

    expect(deleteByRunId).toHaveBeenCalledWith('run-1');
    expect(deleteArtifact).toHaveBeenCalledWith('runs/run-1/push-execution.json');
    expect(deleteByRunAndType).toHaveBeenCalledWith('run-1', 'push_execution');
  });

  it('sends an internal alert when some push channels fail', async () => {
    const createArtifact = vi.fn().mockResolvedValue(undefined);
    createArtifactRepository.mockReturnValue({
      listByRun: vi.fn().mockResolvedValue([{ artifactType: 'push_digest', storagePath: 'runs/run-1/push.txt' }]),
      deleteByRunAndType: vi.fn().mockResolvedValue(undefined),
      create: createArtifact,
    });
    createPushConfigRepository.mockReturnValue({
      listEnabled: vi.fn().mockResolvedValue([
        { channel: 'feishu', enabled: true, secretPayload: 'feishu-hook' },
        { channel: 'wecom', enabled: true, secretPayload: 'wecom-hook' },
      ]),
    });
    downloadArtifactText.mockResolvedValue('Digest');
    sendRunPushes.mockResolvedValue({ feishu: false, wecom: true, wxpusher: false });
    const { handlePushRun } = await import('../src/cloud/routeHandlers/handlePushRun');

    await handlePushRun('run-1');

    expect(sendInternalAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-1',
        failedChannels: ['feishu'],
        configs: [
          { channel: 'feishu', enabled: true, secretPayload: 'feishu-hook' },
          { channel: 'wecom', enabled: true, secretPayload: 'wecom-hook' },
        ],
      }),
    );
  });

  it('filters enabled push configs by recommended channels from push decision', async () => {
    const createArtifact = vi.fn().mockResolvedValue(undefined);
    createArtifactRepository.mockReturnValue({
      listByRun: vi.fn().mockResolvedValue([
        { artifactType: 'push_digest', storagePath: 'runs/run-1/push.txt' },
        { artifactType: 'push_decision', storagePath: 'runs/run-1/push-decision.json' },
      ]),
      deleteByRunAndType: vi.fn().mockResolvedValue(undefined),
      create: createArtifact,
    });
    createPushConfigRepository.mockReturnValue({
      listEnabled: vi.fn().mockResolvedValue([
        { channel: 'feishu', enabled: true, secretPayload: 'feishu-hook' },
        { channel: 'wecom', enabled: true, secretPayload: 'wecom-hook' },
        { channel: 'wxpusher', enabled: true, secretPayload: 'app|uid' },
      ]),
    });
    downloadArtifactText.mockImplementation(async (storagePath: string) => {
      if (storagePath.endsWith('push-decision.json')) {
        return JSON.stringify({
          runId: 'run-1',
          shouldPushToday: true,
          recommendedCandidateIds: ['candidate-1'],
          recommendedChannels: ['wecom'],
          reasonSummary: '建议仅推送企业微信。',
          candidateDecisions: [],
          riskFlags: [],
        });
      }

      return 'Digest';
    });
    sendRunPushes.mockResolvedValue({ feishu: false, wecom: true, wxpusher: false });
    const { handlePushRun } = await import('../src/cloud/routeHandlers/handlePushRun');

    const result = await handlePushRun('run-1');

    expect(result).toEqual({
      ok: true,
      status: { feishu: false, wecom: true, wxpusher: false },
    });
    expect(sendRunPushes).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-1',
        digest: 'Digest',
        configs: [{ channel: 'wecom', enabled: true, secretPayload: 'wecom-hook' }],
      }),
    );
    expect(uploadArtifact).toHaveBeenCalledWith({
      storagePath: 'runs/run-1/push-execution.json',
      body: JSON.stringify(
        {
          runId: 'run-1',
          status: { feishu: false, wecom: true, wxpusher: false },
          recommendedChannels: ['wecom'],
        },
        null,
        2,
      ),
      contentType: 'application/json',
    });
    expect(createArtifact).toHaveBeenCalledWith({
      runId: 'run-1',
      artifactType: 'push_execution',
      storagePath: 'runs/run-1/push-execution.json',
      publicUrl: 'https://cdn.example.com/push-execution.json',
      mimeType: 'application/json',
    });
  });
});
