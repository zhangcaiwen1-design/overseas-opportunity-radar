import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolveCloudPreflight = vi.fn();
const createSupabaseServerClient = vi.fn();
const createRunRepository = vi.fn();
const createCandidateRepository = vi.fn();
const createSelectedItemRepository = vi.fn();
const createArtifactRepository = vi.fn();
const createPushConfigRepository = vi.fn();
const createPushLogRepository = vi.fn();
const createContentVariantRepository = vi.fn();
const createPublicationLogRepository = vi.fn();
const createLeadEventRepository = vi.fn();
const createAppSettingsRepository = vi.fn();
const downloadArtifactText = vi.fn();

vi.mock('../src/cloud/cloudEnv', () => ({
  resolveCloudPreflight,
  isCloudSchemaMissingError: vi.fn(),
}));

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

vi.mock('../src/cloud/repositories/pushConfigRepository', () => ({
  createPushConfigRepository,
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

vi.mock('../src/cloud/repositories/leadEventRepository', () => ({
  createLeadEventRepository,
}));

vi.mock('../src/cloud/repositories/appSettingsRepository', () => ({
  createAppSettingsRepository,
}));

vi.mock('../src/cloud/storage/uploadArtifact', () => ({
  downloadArtifactText,
}));

describe('loadDashboardData', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
    createContentVariantRepository.mockReturnValue({
      listByRun: vi.fn().mockResolvedValue([]),
      listByRunIds: vi.fn().mockResolvedValue([]),
    });
    createPublicationLogRepository.mockReturnValue({
      listByContentVariantIds: vi.fn().mockResolvedValue([]),
    });
    createLeadEventRepository.mockReturnValue({
      listRecent: vi.fn().mockResolvedValue([]),
    });
  });

  it('returns fallback data when preflight is not ready', async () => {
    resolveCloudPreflight.mockResolvedValue({
      status: 'missing_env',
      environment: 'local',
      environmentLabel: '本地环境',
      summary: '云端环境未完成',
      hint: '补齐变量',
      missingKeys: ['CRON_SECRET'],
    });

    const { loadDashboardData } = await import('../src/cloud/queries/loadDashboardData');
    const result = await loadDashboardData();

    expect(result.cloudReady).toBe(false);
    expect(result.preflight.status).toBe('missing_env');
    expect(result.run.id).toBe('uninitialized');
    expect(result.openaiBaseUrl).toBe('');
    expect(result.openaiApiKeyConfigured).toBe(false);
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it('returns initialized fallback data when preflight is ready but no run exists yet', async () => {
    resolveCloudPreflight.mockResolvedValue({
      status: 'ready',
      environment: 'staging',
      environmentLabel: 'Staging 环境',
      summary: '云端环境已就绪',
      hint: '继续',
      missingKeys: [],
    });
    createSupabaseServerClient.mockReturnValue({});
    createRunRepository.mockReturnValue({
      getLatest: vi.fn().mockResolvedValue(null),
      listRecent: vi.fn().mockResolvedValue([]),
    });
    createPushConfigRepository.mockReturnValue({
      listEnabled: vi.fn().mockResolvedValue([{ channel: 'feishu', enabled: true, secretPayload: 'https://example.com/hook' }]),
      listAll: vi.fn().mockResolvedValue([{ channel: 'feishu', enabled: true, secretPayload: 'https://example.com/hook' }]),
    });
    createPushLogRepository.mockReturnValue({
      listByRunIds: vi.fn().mockResolvedValue([]),
    });
    createAppSettingsRepository.mockReturnValue({
      listAll: vi.fn().mockResolvedValue([
        { key: 'timezone', value: 'UTC' },
        { key: 'dailyRunTime', value: '08:30' },
        { key: 'openaiBaseUrl', value: 'https://gateway.example.com/v1' },
        { key: 'openaiApiKey', value: 'configured' },
      ]),
    });
    createCandidateRepository.mockReturnValue({ listByRun: vi.fn() });
    createSelectedItemRepository.mockReturnValue({ listByRun: vi.fn() });
    createArtifactRepository.mockReturnValue({ listByRun: vi.fn(), listByRunIds: vi.fn() });

    const { loadDashboardData } = await import('../src/cloud/queries/loadDashboardData');
    const result = await loadDashboardData();

    expect(result.cloudReady).toBe(true);
    expect(result.run.id).toBe('uninitialized');
    expect(result.configuredChannels).toEqual(['feishu']);
    expect(result.allPushConfigs).toEqual([{ channel: 'feishu', enabled: true, secretPayload: 'https://example.com/hook' }]);
    expect(result.timezone).toBe('UTC');
    expect(result.dailyRunTime).toBe('08:30');
    expect(result.openaiBaseUrl).toBe('https://gateway.example.com/v1');
    expect(result.openaiApiKeyConfigured).toBe(true);
  });

  it('keeps fallback state when preflight is ready and latest run is missing even if recent runs exist', async () => {
    resolveCloudPreflight.mockResolvedValue({
      status: 'ready',
      environment: 'staging',
      environmentLabel: 'Staging 环境',
      summary: '云端环境已就绪',
      hint: '继续',
      missingKeys: [],
    });
    createSupabaseServerClient.mockReturnValue({});
    createRunRepository.mockReturnValue({
      getLatest: vi.fn().mockResolvedValue(null),
      listRecent: vi.fn().mockResolvedValue([
        {
          id: 'run-older',
          dateKey: '2026-05-07',
          triggerType: 'manual',
          status: 'failed',
          startedAt: '2026-05-07T09:00:00.000Z',
          selectedCount: 0,
          poolCount: 4,
          summaryText: '',
          errorMessage: 'timeout',
        },
      ]),
    });
    createPushConfigRepository.mockReturnValue({
      listEnabled: vi.fn().mockResolvedValue([{ channel: 'feishu', enabled: true, secretPayload: 'https://example.com/hook' }]),
      listAll: vi.fn().mockResolvedValue([{ channel: 'feishu', enabled: true, secretPayload: 'https://example.com/hook' }]),
    });
    createPushLogRepository.mockReturnValue({
      listByRunIds: vi.fn().mockResolvedValue([]),
    });
    createAppSettingsRepository.mockReturnValue({
      listAll: vi.fn().mockResolvedValue([
        { key: 'timezone', value: 'UTC' },
        { key: 'dailyRunTime', value: '08:30' },
        { key: 'openaiBaseUrl', value: 'https://gateway.example.com/v1' },
        { key: 'openaiApiKey', value: 'configured' },
      ]),
    });
    createCandidateRepository.mockReturnValue({ listByRun: vi.fn() });
    createSelectedItemRepository.mockReturnValue({ listByRun: vi.fn() });
    createArtifactRepository.mockReturnValue({ listByRun: vi.fn(), listByRunIds: vi.fn() });

    const { loadDashboardData } = await import('../src/cloud/queries/loadDashboardData');
    const result = await loadDashboardData();

    expect(result.cloudReady).toBe(true);
    expect(result.run.id).toBe('uninitialized');
    expect(result.configuredChannels).toEqual(['feishu']);
    expect(result.allPushConfigs).toEqual([{ channel: 'feishu', enabled: true, secretPayload: 'https://example.com/hook' }]);
    expect(result.timezone).toBe('UTC');
    expect(result.dailyRunTime).toBe('08:30');
    expect(result.openaiBaseUrl).toBe('https://gateway.example.com/v1');
    expect(result.openaiApiKeyConfigured).toBe(true);
  });

  it('falls back when repositories fail after preflight passes', async () => {
    resolveCloudPreflight.mockResolvedValue({
      status: 'ready',
      environment: 'staging',
      environmentLabel: 'Staging 环境',
      summary: '云端环境已就绪',
      hint: '继续',
      missingKeys: [],
    });
    createSupabaseServerClient.mockReturnValue({});
    createRunRepository.mockReturnValue({
      getLatest: vi.fn().mockRejectedValue(new Error('read failed')),
      listRecent: vi.fn().mockResolvedValue([]),
    });
    createPushConfigRepository.mockReturnValue({
      listEnabled: vi.fn().mockResolvedValue([]),
      listAll: vi.fn().mockResolvedValue([]),
    });
    createPushLogRepository.mockReturnValue({
      listByRunIds: vi.fn().mockResolvedValue([]),
    });
    createAppSettingsRepository.mockReturnValue({
      listAll: vi.fn().mockResolvedValue([]),
    });
    createCandidateRepository.mockReturnValue({ listByRun: vi.fn() });
    createSelectedItemRepository.mockReturnValue({ listByRun: vi.fn() });
    createArtifactRepository.mockReturnValue({ listByRun: vi.fn(), listByRunIds: vi.fn() });

    const { loadDashboardData } = await import('../src/cloud/queries/loadDashboardData');
    const result = await loadDashboardData();

    expect(result.cloudReady).toBe(false);
    expect(result.preflight.status).toBe('database_unreachable');
    expect(result.preflight.summary).toContain('读取当前运行数据失败');
    expect(result.run.id).toBe('uninitialized');
    expect(downloadArtifactText).not.toHaveBeenCalled();
  });

  it('excludes the latest run from history runs when recent runs includes it', async () => {
    resolveCloudPreflight.mockResolvedValue({
      status: 'ready',
      environment: 'staging',
      environmentLabel: 'Staging 环境',
      summary: '云端环境已就绪',
      hint: '继续',
      missingKeys: [],
    });
    createSupabaseServerClient.mockReturnValue({});
    createRunRepository.mockReturnValue({
      getLatest: vi.fn().mockResolvedValue({
        id: 'run-1',
        dateKey: '2026-05-08',
        triggerType: 'cron',
        status: 'completed',
        startedAt: '2026-05-08T09:00:00.000Z',
        summaryText: 'done',
        errorMessage: '',
      }),
      listRecent: vi.fn().mockResolvedValue([
        {
          id: 'run-1',
          dateKey: '2026-05-08',
          triggerType: 'cron',
          status: 'completed',
          startedAt: '2026-05-08T09:00:00.000Z',
          selectedCount: 3,
          poolCount: 12,
          summaryText: 'done',
          errorMessage: '',
        },
        {
          id: 'run-0',
          dateKey: '2026-05-07',
          triggerType: 'manual',
          status: 'failed',
          startedAt: '2026-05-07T09:00:00.000Z',
          selectedCount: 0,
          poolCount: 4,
          summaryText: '',
          errorMessage: 'timeout',
        },
      ]),
    });
    createPushConfigRepository.mockReturnValue({
      listEnabled: vi.fn().mockResolvedValue([]),
      listAll: vi.fn().mockResolvedValue([]),
    });
    createPushLogRepository.mockReturnValue({
      listByRunIds: vi.fn().mockResolvedValue([]),
    });
    createAppSettingsRepository.mockReturnValue({
      listAll: vi.fn().mockResolvedValue([]),
    });
    createCandidateRepository.mockReturnValue({ listByRun: vi.fn().mockResolvedValue([]) });
    createSelectedItemRepository.mockReturnValue({ listByRun: vi.fn().mockResolvedValue([]) });
    createArtifactRepository.mockReturnValue({ listByRun: vi.fn().mockResolvedValue([]), listByRunIds: vi.fn().mockResolvedValue([]) });

    const { loadDashboardData } = await import('../src/cloud/queries/loadDashboardData');
    const result = await loadDashboardData();

    expect(result.run.id).toBe('run-1');
    expect(result.historyRuns).toHaveLength(1);
    expect(result.historyRuns[0]).toEqual(
      expect.objectContaining({
        id: 'run-0',
        triggerType: 'manual',
      }),
    );
  });

  it('maps history run triggerType from recent runs', async () => {
    resolveCloudPreflight.mockResolvedValue({
      status: 'ready',
      environment: 'staging',
      environmentLabel: 'Staging 环境',
      summary: '云端环境已就绪',
      hint: '继续',
      missingKeys: [],
    });
    createSupabaseServerClient.mockReturnValue({});
    createRunRepository.mockReturnValue({
      getLatest: vi.fn().mockResolvedValue({
        id: 'run-1',
        dateKey: '2026-05-08',
        triggerType: 'cron',
        status: 'completed',
        startedAt: '2026-05-08T09:00:00.000Z',
        summaryText: 'done',
        errorMessage: '',
      }),
      listRecent: vi.fn().mockResolvedValue([
        {
          id: 'run-0',
          dateKey: '2026-05-07',
          triggerType: 'manual',
          status: 'failed',
          startedAt: '2026-05-07T09:00:00.000Z',
          selectedCount: 0,
          poolCount: 4,
          summaryText: '',
          errorMessage: 'timeout',
        },
      ]),
    });
    createPushConfigRepository.mockReturnValue({
      listEnabled: vi.fn().mockResolvedValue([]),
      listAll: vi.fn().mockResolvedValue([]),
    });
    createPushLogRepository.mockReturnValue({
      listByRunIds: vi.fn().mockResolvedValue([]),
    });
    createAppSettingsRepository.mockReturnValue({
      listAll: vi.fn().mockResolvedValue([
        { key: 'openaiBaseUrl', value: 'https://gateway.example.com/v1' },
        { key: 'openaiApiKey', value: 'sk-demo' },
      ]),
    });
    createCandidateRepository.mockReturnValue({ listByRun: vi.fn().mockResolvedValue([]) });
    createSelectedItemRepository.mockReturnValue({ listByRun: vi.fn().mockResolvedValue([]) });
    createArtifactRepository.mockReturnValue({ listByRun: vi.fn().mockResolvedValue([]), listByRunIds: vi.fn().mockResolvedValue([]) });

    const { loadDashboardData } = await import('../src/cloud/queries/loadDashboardData');
    const result = await loadDashboardData();

    expect(result.openaiBaseUrl).toBe('https://gateway.example.com/v1');
    expect(result.openaiApiKeyConfigured).toBe(true);
    expect(result.historyRuns).toHaveLength(1);
    expect(result.historyRuns[0]).toEqual(
      expect.objectContaining({
        id: 'run-0',
        triggerType: 'manual',
      }),
    );
  });

  it('loads and parses push decision artifact for the current run', async () => {
    resolveCloudPreflight.mockResolvedValue({
      status: 'ready',
      environment: 'staging',
      environmentLabel: 'Staging 环境',
      summary: '云端环境已就绪',
      hint: '继续',
      missingKeys: [],
    });
    createSupabaseServerClient.mockReturnValue({});
    createRunRepository.mockReturnValue({
      getLatest: vi.fn().mockResolvedValue({
        id: 'run-1',
        dateKey: '2026-05-08',
        triggerType: 'cron',
        status: 'completed',
        startedAt: '2026-05-08T09:00:00.000Z',
        summaryText: 'done',
        errorMessage: '',
      }),
      listRecent: vi.fn().mockResolvedValue([]),
    });
    createPushConfigRepository.mockReturnValue({
      listEnabled: vi.fn().mockResolvedValue([{ channel: 'feishu', enabled: true, secretPayload: 'hook' }]),
      listAll: vi.fn().mockResolvedValue([{ channel: 'feishu', enabled: true, secretPayload: 'hook' }]),
    });
    createPushLogRepository.mockReturnValue({
      listByRunIds: vi.fn().mockResolvedValue([]),
    });
    createAppSettingsRepository.mockReturnValue({
      listAll: vi.fn().mockResolvedValue([]),
    });
    createCandidateRepository.mockReturnValue({ listByRun: vi.fn().mockResolvedValue([]) });
    createSelectedItemRepository.mockReturnValue({ listByRun: vi.fn().mockResolvedValue([]) });
    createArtifactRepository.mockReturnValue({
      listByRun: vi.fn().mockResolvedValue([
        {
          artifactType: 'push_digest',
          publicUrl: 'https://cdn.example.com/push.txt',
          storagePath: 'runs/2026-05-08/push-digest.txt',
        },
        {
          artifactType: 'push_decision',
          publicUrl: 'https://cdn.example.com/push-decision.json',
          storagePath: 'runs/2026-05-08/push-decision.json',
        },
      ]),
      listByRunIds: vi.fn().mockResolvedValue([]),
    });
    downloadArtifactText.mockImplementation(async (storagePath: string) => {
      if (storagePath.endsWith('push-decision.json')) {
        return JSON.stringify({
          runId: 'run-1',
          shouldPushToday: true,
          recommendedCandidateIds: ['candidate-strong'],
          recommendedChannels: ['feishu'],
          reasonSummary: '建议推送 candidate-strong。',
          candidateDecisions: [
            {
              candidateId: 'candidate-strong',
              action: 'push',
              scoreLabel: 'high',
              reasons: ['本地化适配信号较强'],
              suggestedChannels: ['feishu'],
            },
          ],
          riskFlags: [],
        });
      }

      return 'Digest';
    });

    const { loadDashboardData } = await import('../src/cloud/queries/loadDashboardData');
    const result = await loadDashboardData();

    expect(result).toMatchObject({
      pushDigest: 'Digest',
      pushDecision: {
        runId: 'run-1',
        shouldPushToday: true,
        recommendedCandidateIds: ['candidate-strong'],
        recommendedChannels: ['feishu'],
        reasonSummary: '建议推送 candidate-strong。',
        riskFlags: [],
      },
    });
    expect(downloadArtifactText).toHaveBeenCalledWith('runs/2026-05-08/push-digest.txt');
    expect(downloadArtifactText).toHaveBeenCalledWith('runs/2026-05-08/push-decision.json');
  });

  it('loads only lightweight history runs for the dashboard home data', async () => {
    resolveCloudPreflight.mockResolvedValue({
      status: 'ready',
      environment: 'staging',
      environmentLabel: 'Staging 环境',
      summary: '云端环境已就绪',
      hint: '继续',
      missingKeys: [],
    });
    createSupabaseServerClient.mockReturnValue({});
    createRunRepository.mockReturnValue({
      getLatest: vi.fn().mockResolvedValue({
        id: 'run-1',
        dateKey: '2026-05-08',
        triggerType: 'cron',
        status: 'completed',
        startedAt: '2026-05-08T09:00:00.000Z',
        summaryText: 'done',
        errorMessage: '',
      }),
      listRecent: vi.fn().mockResolvedValue([
        {
          id: 'run-1',
          dateKey: '2026-05-08',
          triggerType: 'cron',
          status: 'completed',
          startedAt: '2026-05-08T09:00:00.000Z',
          selectedCount: 2,
          poolCount: 6,
          summaryText: 'done',
          errorMessage: '',
        },
        {
          id: 'run-0',
          dateKey: '2026-05-07',
          triggerType: 'manual',
          status: 'completed',
          startedAt: '2026-05-07T09:00:00.000Z',
          selectedCount: 1,
          poolCount: 4,
          summaryText: 'history done',
          errorMessage: '',
        },
      ]),
    });
    createPushConfigRepository.mockReturnValue({
      listEnabled: vi.fn().mockResolvedValue([]),
      listAll: vi.fn().mockResolvedValue([]),
    });
    createAppSettingsRepository.mockReturnValue({
      listAll: vi.fn().mockResolvedValue([]),
    });
    createCandidateRepository.mockReturnValue({ listByRun: vi.fn().mockResolvedValue([]) });
    createSelectedItemRepository.mockReturnValue({ listByRun: vi.fn().mockResolvedValue([]) });
    createArtifactRepository.mockReturnValue({
      listByRun: vi.fn().mockResolvedValue([]),
      listByRunIds: vi.fn().mockResolvedValue([{ runId: 'run-0', artifactType: 'selected_html', publicUrl: 'https://cdn.example.com/run-0.html' }]),
    });
    const listByRunIds = vi.fn().mockResolvedValue([{ runId: 'run-0', channel: 'feishu', status: 'success', responseSummary: 'ok' }]);
    createPushLogRepository.mockReturnValue({
      listByRunIds,
    });
    const listByRun = vi.fn().mockResolvedValue([
      {
        id: 'variant-current-1',
        runId: 'run-1',
        candidateId: 'candidate-1',
        selectedItemId: 'selected-1',
        channel: 'site',
        title: '站点稿件 A',
        body: 'body-a',
        status: 'published',
        publishedAt: '2026-05-08T09:30:00.000Z',
        reviewNotes: '',
      },
    ]);
    const listByRunIdsForVariants = vi.fn().mockResolvedValue([
      {
        id: 'variant-history-1',
        runId: 'run-0',
        candidateId: 'candidate-h1',
        selectedItemId: 'selected-h1',
        channel: 'site',
        title: '历史站点稿件',
        body: 'history-body',
        status: 'published',
        publishedAt: '2026-05-07T09:20:00.000Z',
        reviewNotes: '',
      },
    ]);
    createContentVariantRepository.mockReturnValue({
      listByRun,
      listByRunIds: listByRunIdsForVariants,
    });
    const listByContentVariantIds = vi.fn().mockResolvedValue([
      {
        id: 'publication-log-1',
        contentVariantId: 'variant-current-1',
        channel: 'site',
        action: 'publish',
        status: 'success',
        responseSummary: 'Published to /posts/a',
        operator: 'system',
        createdAt: '2026-05-08T09:31:00.000Z',
      },
    ]);
    createPublicationLogRepository.mockReturnValue({
      listByContentVariantIds,
    });

    const { loadDashboardData } = await import('../src/cloud/queries/loadDashboardData');
    const result = await loadDashboardData();

    expect(result.currentContentVariants).toHaveLength(1);
    expect(result.currentPublicationLogs).toHaveLength(1);
    expect(result.historyRuns).toEqual([
      expect.objectContaining({
        id: 'run-0',
        status: 'completed',
        triggerType: 'manual',
        selectedCount: 1,
        poolCount: 4,
        summaryText: 'history done',
      }),
    ]);
    expect(listByRun).toHaveBeenCalledWith('run-1');
    expect(listByRunIdsForVariants).not.toHaveBeenCalled();
    expect(listByRunIds).not.toHaveBeenCalledWith(['run-0']);
    expect(listByContentVariantIds).toHaveBeenCalledWith(['variant-current-1']);
  });

  it('loads recent lead events for the dashboard home data', async () => {
    resolveCloudPreflight.mockResolvedValue({
      status: 'ready',
      environment: 'staging',
      environmentLabel: 'Staging 环境',
      summary: '云端环境已就绪',
      hint: '继续',
      missingKeys: [],
    });
    createSupabaseServerClient.mockReturnValue({});
    createRunRepository.mockReturnValue({
      getLatest: vi.fn().mockResolvedValue({
        id: 'run-1',
        dateKey: '2026-05-08',
        triggerType: 'cron',
        status: 'completed',
        startedAt: '2026-05-08T09:00:00.000Z',
        summaryText: 'done',
        errorMessage: '',
      }),
      listRecent: vi.fn().mockResolvedValue([]),
    });
    createPushConfigRepository.mockReturnValue({
      listEnabled: vi.fn().mockResolvedValue([]),
      listAll: vi.fn().mockResolvedValue([]),
    });
    createPushLogRepository.mockReturnValue({
      listByRunIds: vi.fn().mockResolvedValue([]),
    });
    createAppSettingsRepository.mockReturnValue({
      listAll: vi.fn().mockResolvedValue([]),
    });
    createCandidateRepository.mockReturnValue({ listByRun: vi.fn().mockResolvedValue([]) });
    createSelectedItemRepository.mockReturnValue({ listByRun: vi.fn().mockResolvedValue([]) });
    createArtifactRepository.mockReturnValue({
      listByRun: vi.fn().mockResolvedValue([]),
      listByRunIds: vi.fn().mockResolvedValue([]),
    });
    const listRecent = vi.fn().mockResolvedValue([
      {
        id: 'lead-1',
        sourceChannel: 'site',
        pageType: 'site_article',
        eventType: 'subscribe',
        contact: 'founder@example.com',
        notes: '想看案例',
        createdAt: '2026-05-08T10:00:00.000Z',
      },
      {
        id: 'lead-2',
        sourceChannel: 'site',
        pageType: 'site_index',
        eventType: 'consult',
        contact: 'wechat-radar',
        notes: '',
        createdAt: '2026-05-08T10:05:00.000Z',
      },
    ]);
    createLeadEventRepository.mockReturnValue({ listRecent });

    const { loadDashboardData } = await import('../src/cloud/queries/loadDashboardData');
    const result = await loadDashboardData();

    expect(result.recentLeadEvents).toEqual([
      {
        id: 'lead-1',
        sourceChannel: 'site',
        pageType: 'site_article',
        eventType: 'subscribe',
        contact: 'founder@example.com',
        notes: '想看案例',
        createdAt: '2026-05-08T10:00:00.000Z',
      },
      {
        id: 'lead-2',
        sourceChannel: 'site',
        pageType: 'site_index',
        eventType: 'consult',
        contact: 'wechat-radar',
        notes: '',
        createdAt: '2026-05-08T10:05:00.000Z',
      },
    ]);
    expect(listRecent).toHaveBeenCalledWith(5);
  });

  it('loads and parses push execution artifact for the current run', async () => {
    resolveCloudPreflight.mockResolvedValue({
      status: 'ready',
      environment: 'staging',
      environmentLabel: 'Staging 环境',
      summary: '云端环境已就绪',
      hint: '继续',
      missingKeys: [],
    });
    createSupabaseServerClient.mockReturnValue({});
    createRunRepository.mockReturnValue({
      getLatest: vi.fn().mockResolvedValue({
        id: 'run-1',
        dateKey: '2026-05-08',
        triggerType: 'cron',
        status: 'completed',
        startedAt: '2026-05-08T09:00:00.000Z',
        summaryText: 'done',
        errorMessage: '',
      }),
      listRecent: vi.fn().mockResolvedValue([]),
    });
    createPushConfigRepository.mockReturnValue({
      listEnabled: vi.fn().mockResolvedValue([{ channel: 'feishu', enabled: true, secretPayload: 'hook' }]),
      listAll: vi.fn().mockResolvedValue([{ channel: 'feishu', enabled: true, secretPayload: 'hook' }]),
    });
    createPushLogRepository.mockReturnValue({
      listByRunIds: vi.fn().mockResolvedValue([]),
    });
    createAppSettingsRepository.mockReturnValue({
      listAll: vi.fn().mockResolvedValue([]),
    });
    createCandidateRepository.mockReturnValue({ listByRun: vi.fn().mockResolvedValue([]) });
    createSelectedItemRepository.mockReturnValue({ listByRun: vi.fn().mockResolvedValue([]) });
    createArtifactRepository.mockReturnValue({
      listByRun: vi.fn().mockResolvedValue([
        {
          artifactType: 'push_digest',
          publicUrl: 'https://cdn.example.com/push.txt',
          storagePath: 'runs/2026-05-08/push-digest.txt',
        },
        {
          artifactType: 'push_execution',
          publicUrl: 'https://cdn.example.com/push-execution.json',
          storagePath: 'runs/2026-05-08/push-execution.json',
        },
      ]),
      listByRunIds: vi.fn().mockResolvedValue([]),
    });
    downloadArtifactText.mockImplementation(async (storagePath: string) => {
      if (storagePath.endsWith('push-execution.json')) {
        return JSON.stringify({
          runId: 'run-1',
          status: { feishu: true, wecom: false, wxpusher: false },
          recommendedChannels: ['feishu'],
        });
      }

      return 'Digest';
    });

    const { loadDashboardData } = await import('../src/cloud/queries/loadDashboardData');
    const result = await loadDashboardData();

    expect(result).toMatchObject({
      pushExecution: {
        runId: 'run-1',
        status: { feishu: true, wecom: false, wxpusher: false },
        recommendedChannels: ['feishu'],
      },
    });
    expect(downloadArtifactText).toHaveBeenCalledWith('runs/2026-05-08/push-execution.json');
  });
});
