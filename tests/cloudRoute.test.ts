import { ZodError } from 'zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createSupabaseServerClient = vi.fn();
const createPushConfigRepository = vi.fn();
const createAppSettingsRepository = vi.fn();
const createCandidateRepository = vi.fn();
const createRunRepository = vi.fn();
const createArtifactRepository = vi.fn();
const createPushLogRepository = vi.fn();
const createSelectedItemRepository = vi.fn();
const createContentVariantRepository = vi.fn();
const createPublicationLogRepository = vi.fn();
const createLeadEventRepository = vi.fn();
const handlePushRun = vi.fn();
const handleGenerateRun = vi.fn();
const handleDailyCollect = vi.fn();
const handleCandidateSelection = vi.fn();
const handlePublishSiteRun = vi.fn();
const handleWithdrawSiteRun = vi.fn();
const syncCronSchedule = vi.fn(() => {
  throw new Error('syncCronSchedule should not be called by route');
});
const toUtcCronExpression = vi.fn();
const loadCloudConfig = vi.fn();
const collectCandidatesForDailyRun = vi.fn();

vi.mock('../src/cloud/supabase/serverClient', () => ({
  createSupabaseServerClient,
}));

vi.mock('../src/cloud/repositories/pushConfigRepository', () => ({
  createPushConfigRepository,
}));

vi.mock('../src/cloud/repositories/appSettingsRepository', () => ({
  createAppSettingsRepository,
}));

vi.mock('../src/cloud/repositories/candidateRepository', () => ({
  createCandidateRepository,
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

vi.mock('../src/cloud/repositories/selectedItemRepository', () => ({
  createSelectedItemRepository,
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

vi.mock('../src/cloud/settings/syncCronSchedule', async () => {
  const actual = await vi.importActual<typeof import('../src/cloud/settings/syncCronSchedule')>(
    '../src/cloud/settings/syncCronSchedule',
  );

  return {
    ...actual,
    syncCronSchedule,
    toUtcCronExpression,
  };
});

vi.mock('../src/cloud/loadCloudConfig', () => ({
  loadCloudConfig,
}));

vi.mock('../src/cloud/routeHandlers/handlePushRun', () => ({
  handlePushRun,
}));

vi.mock('../src/cloud/routeHandlers/handleGenerateRun', () => ({
  handleGenerateRun,
}));

vi.mock('../src/cloud/routeHandlers/handleDailyCollect', () => ({
  handleDailyCollect,
}));

vi.mock('../src/orchestrator/runDailyPipeline', () => ({
  collectCandidatesForDailyRun,
}));

vi.mock('../src/cloud/routeHandlers/handleCandidateSelection', () => ({
  handleCandidateSelection,
}));

vi.mock('../src/cloud/routeHandlers/handlePublishSiteRun', () => ({
  handlePublishSiteRun,
}));

vi.mock('../src/cloud/routeHandlers/handleWithdrawSiteRun', () => ({
  handleWithdrawSiteRun,
}));

describe('cron daily collect route', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://demo.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.SUPABASE_STORAGE_BUCKET = 'artifacts';
    process.env.CRON_SECRET = 'cron-secret';
    process.env.NEXT_PUBLIC_APP_URL = 'https://radar.example.com';
    loadCloudConfig.mockReturnValue({ cronSecret: 'cron-secret' });
  });

  it('accepts GET requests from Vercel cron when bearer token matches', async () => {
    handleDailyCollect.mockResolvedValue({ runId: 'run-1' });
    const { GET } = await import('../app/api/cron/daily-collect/route');

    const response = await GET(
      new Request('http://localhost/api/cron/daily-collect', {
        method: 'GET',
        headers: { authorization: 'Bearer cron-secret' },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, action: 'daily-collect', runId: 'run-1' });
    expect(handleDailyCollect).toHaveBeenCalledWith('cron');
  });

  it('passes stored OpenAI settings into manual collection', async () => {
    handleDailyCollect.mockResolvedValue({ runId: 'run-1', poolCount: 1 });
    const { POST } = await import('../app/api/runs/manual-collect/route');

    const response = await POST(
      new Request('http://localhost/api/runs/manual-collect', {
        method: 'POST',
        headers: { 'x-admin-secret': 'admin-secret' },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, action: 'manual-collect', runId: 'run-1', poolCount: 1 });
    expect(handleDailyCollect).toHaveBeenCalledWith('manual');
  });
});

describe('push configs route', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://demo.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.SUPABASE_STORAGE_BUCKET = 'artifacts';
    process.env.CRON_SECRET = 'cron-secret';
    process.env.NEXT_PUBLIC_APP_URL = 'https://radar.example.com';
  });

  it('returns 401 when admin secret is missing or invalid', async () => {
    process.env.ADMIN_SECRET = 'admin-secret';
    const { POST } = await import('../app/api/settings/push-configs/route');

    const response = await POST(
      new Request('http://localhost/api/settings/push-configs', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ ok: false, reason: 'unauthorized' });
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it('returns 503 when cloud env is missing', async () => {
    process.env.CRON_SECRET = '';
    const { POST } = await import('../app/api/settings/push-configs/route');

    const response = await POST(
      new Request('http://localhost/api/settings/push-configs', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': 'admin-secret' },
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ ok: false, reason: 'cloud env not configured' });
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it('returns 503 when cloud env is invalid', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'not-a-url';
    loadCloudConfig.mockImplementation(() => {
      throw new ZodError([]);
    });
    const { POST } = await import('../app/api/settings/push-configs/route');

    const response = await POST(
      new Request('http://localhost/api/settings/push-configs', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': 'admin-secret' },
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ ok: false, reason: 'cloud env invalid' });
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it('saves settings when cloud env is valid', async () => {
    createSupabaseServerClient.mockReturnValue({});
    createPushConfigRepository.mockReturnValue({ listAll: vi.fn().mockResolvedValue([]), saveMany: vi.fn().mockResolvedValue(undefined) });
    const saveMany = vi.fn().mockResolvedValue(undefined);
    createAppSettingsRepository.mockReturnValue({ saveMany });
    toUtcCronExpression.mockReturnValue('0 1 * * *');
    const { POST } = await import('../app/api/settings/push-configs/route');

    const response = await POST(
      new Request('http://localhost/api/settings/push-configs', {
        method: 'POST',
        body: JSON.stringify({
          configs: [],
          timezone: 'Asia/Shanghai',
          dailyRunTime: '09:00',
          openaiBaseUrl: 'https://gateway.example.com/v1',
          openaiApiKey: 'sk-demo',
        }),
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': 'admin-secret' },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, cronExpression: '0 1 * * *' });
    expect(toUtcCronExpression).toHaveBeenCalledWith('09:00', 'Asia/Shanghai');
    expect(saveMany).toHaveBeenCalledWith([
      { key: 'timezone', value: 'Asia/Shanghai' },
      { key: 'dailyRunTime', value: '09:00' },
      { key: 'openaiBaseUrl', value: 'https://gateway.example.com/v1' },
      { key: 'openaiApiKey', value: 'sk-demo' },
    ]);
    expect(createSupabaseServerClient).toHaveBeenCalledTimes(1);
    expect(syncCronSchedule).not.toHaveBeenCalled();
  });

  it('rejects unsupported push channels', async () => {
    const saveMany = vi.fn().mockResolvedValue(undefined);
    createSupabaseServerClient.mockReturnValue({});
    createPushConfigRepository.mockReturnValue({ listAll: vi.fn().mockResolvedValue([]), saveMany });
    createAppSettingsRepository.mockReturnValue({ saveMany: vi.fn().mockResolvedValue(undefined) });
    const { POST } = await import('../app/api/settings/push-configs/route');

    const response = await POST(
      new Request('http://localhost/api/settings/push-configs', {
        method: 'POST',
        body: JSON.stringify({
          configs: [{ channel: 'slack', enabled: true, secretPayload: 'x' }],
          timezone: 'Asia/Shanghai',
          dailyRunTime: '09:00',
        }),
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': 'admin-secret' },
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ ok: false, reason: 'invalid push channel' });
    expect(saveMany).not.toHaveBeenCalled();
    expect(toUtcCronExpression).not.toHaveBeenCalled();
  });

  it('rejects invalid daily run time format', async () => {
    const saveMany = vi.fn().mockResolvedValue(undefined);
    createSupabaseServerClient.mockReturnValue({});
    createPushConfigRepository.mockReturnValue({ listAll: vi.fn().mockResolvedValue([]), saveMany });
    createAppSettingsRepository.mockReturnValue({ saveMany: vi.fn().mockResolvedValue(undefined) });
    const { POST } = await import('../app/api/settings/push-configs/route');

    const response = await POST(
      new Request('http://localhost/api/settings/push-configs', {
        method: 'POST',
        body: JSON.stringify({ configs: [], timezone: 'Asia/Shanghai', dailyRunTime: '9am' }),
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': 'admin-secret' },
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ ok: false, reason: 'invalid schedule settings' });
    expect(saveMany).not.toHaveBeenCalled();
    expect(toUtcCronExpression).not.toHaveBeenCalled();
  });

  it('allows disabled channels with empty secret payload', async () => {
    const saveMany = vi.fn().mockResolvedValue(undefined);
    createSupabaseServerClient.mockReturnValue({});
    createPushConfigRepository.mockReturnValue({ listAll: vi.fn().mockResolvedValue([]), saveMany });
    createAppSettingsRepository.mockReturnValue({ saveMany: vi.fn().mockResolvedValue(undefined) });
    toUtcCronExpression.mockReturnValue('0 1 * * *');
    const { POST } = await import('../app/api/settings/push-configs/route');

    const response = await POST(
      new Request('http://localhost/api/settings/push-configs', {
        method: 'POST',
        body: JSON.stringify({
          configs: [{ channel: 'wxpusher', enabled: false, secretPayload: '' }],
          timezone: 'Asia/Shanghai',
          dailyRunTime: '09:00',
        }),
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': 'admin-secret' },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, cronExpression: '0 1 * * *' });
    expect(toUtcCronExpression).toHaveBeenCalledWith('09:00', 'Asia/Shanghai');
    expect(saveMany).toHaveBeenCalledWith([
      { channel: 'wxpusher', enabled: false, secretPayload: '' },
    ]);
    expect(syncCronSchedule).not.toHaveBeenCalled();
  });

  it('rejects malformed wxpusher secret payload', async () => {
    const saveMany = vi.fn().mockResolvedValue(undefined);
    createSupabaseServerClient.mockReturnValue({});
    createPushConfigRepository.mockReturnValue({ listAll: vi.fn().mockResolvedValue([]), saveMany });
    createAppSettingsRepository.mockReturnValue({ saveMany: vi.fn().mockResolvedValue(undefined) });
    const { POST } = await import('../app/api/settings/push-configs/route');

    const response = await POST(
      new Request('http://localhost/api/settings/push-configs', {
        method: 'POST',
        body: JSON.stringify({
          configs: [{ channel: 'wxpusher', enabled: true, secretPayload: 'app-token-only' }],
          timezone: 'Asia/Shanghai',
          dailyRunTime: '09:00',
        }),
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': 'admin-secret' },
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ ok: false, reason: 'invalid push secret payload' });
    expect(saveMany).not.toHaveBeenCalled();
    expect(toUtcCronExpression).not.toHaveBeenCalled();
  });

  it('rejects malformed feishu webhook payload', async () => {
    const saveMany = vi.fn().mockResolvedValue(undefined);
    createSupabaseServerClient.mockReturnValue({});
    createPushConfigRepository.mockReturnValue({ listAll: vi.fn().mockResolvedValue([]), saveMany });
    createAppSettingsRepository.mockReturnValue({ saveMany: vi.fn().mockResolvedValue(undefined) });
    const { POST } = await import('../app/api/settings/push-configs/route');

    const response = await POST(
      new Request('http://localhost/api/settings/push-configs', {
        method: 'POST',
        body: JSON.stringify({
          configs: [{ channel: 'feishu', enabled: true, secretPayload: 'not-a-url' }],
          timezone: 'Asia/Shanghai',
          dailyRunTime: '09:00',
        }),
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': 'admin-secret' },
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ ok: false, reason: 'invalid push secret payload' });
    expect(saveMany).not.toHaveBeenCalled();
    expect(toUtcCronExpression).not.toHaveBeenCalled();
  });

  it('keeps an existing saved secret when an enabled config is submitted blank', async () => {
    const saveMany = vi.fn().mockResolvedValue(undefined);
    const listAll = vi.fn().mockResolvedValue([{ channel: 'feishu', enabled: true, secretPayload: 'https://hooks.example.com/demo' }]);
    createSupabaseServerClient.mockReturnValue({});
    createPushConfigRepository.mockReturnValue({ listAll, saveMany });
    createAppSettingsRepository.mockReturnValue({ saveMany: vi.fn().mockResolvedValue(undefined) });
    toUtcCronExpression.mockReturnValue('0 1 * * *');
    const { POST } = await import('../app/api/settings/push-configs/route');

    const response = await POST(
      new Request('http://localhost/api/settings/push-configs', {
        method: 'POST',
        body: JSON.stringify({
          configs: [{ channel: 'feishu', enabled: true, secretPayload: '' }],
          timezone: 'Asia/Shanghai',
          dailyRunTime: '09:00',
        }),
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': 'admin-secret' },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, cronExpression: '0 1 * * *' });
    expect(saveMany).toHaveBeenCalledWith([
      { channel: 'feishu', enabled: true, secretPayload: 'https://hooks.example.com/demo' },
    ]);
  });
});

describe('manual collect route', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://demo.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.SUPABASE_STORAGE_BUCKET = 'artifacts';
    process.env.CRON_SECRET = 'cron-secret';
    process.env.NEXT_PUBLIC_APP_URL = 'https://radar.example.com';
  });

  it('returns 401 when admin secret is missing or invalid', async () => {
    process.env.ADMIN_SECRET = 'admin-secret';
    const { POST } = await import('../app/api/runs/manual-collect/route');

    const response = await POST(new Request('http://localhost/api', { method: 'POST' }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ ok: false, reason: 'unauthorized' });
    expect(handleDailyCollect).not.toHaveBeenCalled();
  });
});

describe('candidate selection route', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://demo.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.SUPABASE_STORAGE_BUCKET = 'artifacts';
    process.env.CRON_SECRET = 'cron-secret';
    process.env.NEXT_PUBLIC_APP_URL = 'https://radar.example.com';
  });

  it('returns 401 when admin secret is missing or invalid', async () => {
    process.env.ADMIN_SECRET = 'admin-secret';
    const { POST } = await import('../app/api/runs/[runId]/candidates/[candidateId]/selection/route');

    const response = await POST(new Request('http://localhost/api', { method: 'POST', body: JSON.stringify({ selectionState: 'selected' }) }), {
      params: Promise.resolve({ runId: 'run-1', candidateId: 'candidate-1' }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ ok: false, runId: 'run-1', candidateId: 'candidate-1', reason: 'unauthorized' });
    expect(handleCandidateSelection).not.toHaveBeenCalled();
  });

  it('returns 503 when cloud env is missing', async () => {
    process.env.CRON_SECRET = '';
    const { POST } = await import('../app/api/runs/[runId]/candidates/[candidateId]/selection/route');

    const response = await POST(new Request('http://localhost/api', { method: 'POST', body: JSON.stringify({ selectionState: 'selected' }), headers: { 'x-admin-secret': 'admin-secret' } }), {
      params: Promise.resolve({ runId: 'run-1', candidateId: 'candidate-1' }),
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ ok: false, runId: 'run-1', candidateId: 'candidate-1', reason: 'cloud env not configured' });
  });

  it('returns 400 for invalid selection state', async () => {
    const { POST } = await import('../app/api/runs/[runId]/candidates/[candidateId]/selection/route');

    const response = await POST(new Request('http://localhost/api', { method: 'POST', body: JSON.stringify({ selectionState: 'weird' }), headers: { 'x-admin-secret': 'admin-secret' } }), {
      params: Promise.resolve({ runId: 'run-1', candidateId: 'candidate-1' }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ ok: false, runId: 'run-1', candidateId: 'candidate-1', reason: 'invalid selection state' });
  });

  it('saves selection state when cloud env is valid', async () => {
    createSupabaseServerClient.mockReturnValue({});
    handleCandidateSelection.mockResolvedValue({ runId: 'run-1', candidateId: 'candidate-1', selectionState: 'selected' });
    const { POST } = await import('../app/api/runs/[runId]/candidates/[candidateId]/selection/route');

    const response = await POST(new Request('http://localhost/api', { method: 'POST', body: JSON.stringify({ selectionState: 'selected' }), headers: { 'x-admin-secret': 'admin-secret' } }), {
      params: Promise.resolve({ runId: 'run-1', candidateId: 'candidate-1' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, action: 'candidate-selection', runId: 'run-1', candidateId: 'candidate-1', selectionState: 'selected' });
    expect(handleCandidateSelection).toHaveBeenCalledTimes(1);
  });

  it('returns 400 for invalid draft sort order', async () => {
    const updateSelectionState = vi.fn().mockResolvedValue(undefined);
    createSupabaseServerClient.mockReturnValue({});
    createCandidateRepository.mockReturnValue({ updateSelectionState });
    const { POST } = await import('../app/api/runs/[runId]/candidates/[candidateId]/selection/route');

    const response = await POST(new Request('http://localhost/api', { method: 'POST', body: JSON.stringify({ selectionState: 'selected', draftSortOrder: -1 }), headers: { 'x-admin-secret': 'admin-secret' } }), {
      params: Promise.resolve({ runId: 'run-1', candidateId: 'candidate-1' }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ ok: false, runId: 'run-1', candidateId: 'candidate-1', reason: 'invalid draft sort order' });
    expect(updateSelectionState).not.toHaveBeenCalled();
  });

  it('returns 400 when draft sort order is sent for a non-selected state', async () => {
    const updateSelectionState = vi.fn().mockResolvedValue(undefined);
    createSupabaseServerClient.mockReturnValue({});
    createCandidateRepository.mockReturnValue({ updateSelectionState });
    const { POST } = await import('../app/api/runs/[runId]/candidates/[candidateId]/selection/route');

    const response = await POST(new Request('http://localhost/api', { method: 'POST', body: JSON.stringify({ selectionState: 'discarded', draftSortOrder: 0 }), headers: { 'x-admin-secret': 'admin-secret' } }), {
      params: Promise.resolve({ runId: 'run-1', candidateId: 'candidate-1' }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ ok: false, runId: 'run-1', candidateId: 'candidate-1', reason: 'invalid draft sort order' });
    expect(updateSelectionState).not.toHaveBeenCalled();
  });
});

describe('generate route', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://demo.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.SUPABASE_STORAGE_BUCKET = 'artifacts';
    process.env.CRON_SECRET = 'cron-secret';
    process.env.NEXT_PUBLIC_APP_URL = 'https://radar.example.com';
  });

  it('returns 401 when admin secret is missing or invalid', async () => {
    process.env.ADMIN_SECRET = 'admin-secret';
    const { POST } = await import('../app/api/runs/[runId]/generate/route');

    const response = await POST(new Request('http://localhost/api', { method: 'POST', body: JSON.stringify({ selectedCandidateIds: ['candidate-1'] }) }), {
      params: Promise.resolve({ runId: 'run-1' }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ ok: false, runId: 'run-1', reason: 'unauthorized' });
    expect(handleGenerateRun).not.toHaveBeenCalled();
  });
});

describe('publish site route', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://demo.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.SUPABASE_STORAGE_BUCKET = 'artifacts';
    process.env.CRON_SECRET = 'cron-secret';
    process.env.NEXT_PUBLIC_APP_URL = 'https://radar.example.com';
  });

  it('returns 401 when admin secret is missing or invalid', async () => {
    process.env.ADMIN_SECRET = 'admin-secret';
    const { POST } = await import('../app/api/runs/[runId]/publish-site/route');

    const response = await POST(new Request('http://localhost/api', { method: 'POST', body: JSON.stringify({ selectedItemId: 'selected-1' }) }), {
      params: Promise.resolve({ runId: 'run-1' }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ ok: false, runId: 'run-1', reason: 'unauthorized' });
    expect(handlePublishSiteRun).not.toHaveBeenCalled();
  });

  it('returns 400 when selected item id is missing', async () => {
    const { POST } = await import('../app/api/runs/[runId]/publish-site/route');

    const response = await POST(new Request('http://localhost/api', { method: 'POST', headers: { 'x-admin-secret': 'admin-secret' }, body: JSON.stringify({}) }), {
      params: Promise.resolve({ runId: 'run-1' }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ ok: false, runId: 'run-1', reason: 'selected item id required' });
  });

  it('returns 503 when cloud env is missing', async () => {
    process.env.CRON_SECRET = '';
    const { POST } = await import('../app/api/runs/[runId]/publish-site/route');

    const response = await POST(new Request('http://localhost/api', { method: 'POST', headers: { 'x-admin-secret': 'admin-secret' }, body: JSON.stringify({ selectedItemId: 'selected-1' }) }), {
      params: Promise.resolve({ runId: 'run-1' }),
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ ok: false, runId: 'run-1', reason: 'cloud env not configured' });
  });

  it('publishes the selected item to site when request is valid', async () => {
    createSupabaseServerClient.mockReturnValue({});
    createContentVariantRepository.mockReturnValue({});
    createSelectedItemRepository.mockReturnValue({});
    createCandidateRepository.mockReturnValue({});
    createArtifactRepository.mockReturnValue({});
    createPublicationLogRepository.mockReturnValue({});
    handlePublishSiteRun.mockResolvedValue({
      runId: 'run-1',
      selectedItemId: 'selected-1',
      contentVariantId: 'variant-1',
      action: 'publish',
      channel: 'site',
      publishedAt: '2026-05-09T03:30:00.000Z',
    });
    const { POST } = await import('../app/api/runs/[runId]/publish-site/route');

    const response = await POST(new Request('http://localhost/api', { method: 'POST', headers: { 'x-admin-secret': 'admin-secret' }, body: JSON.stringify({ selectedItemId: 'selected-1' }) }), {
      params: Promise.resolve({ runId: 'run-1' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      runId: 'run-1',
      action: 'publish-site',
      selectedItemId: 'selected-1',
      contentVariantId: 'variant-1',
      channel: 'site',
      publishedAt: '2026-05-09T03:30:00.000Z',
    });
    expect(handlePublishSiteRun).toHaveBeenCalledWith('run-1', 'selected-1', 'admin');
  });

  it('withdraws the selected item from site when request is valid', async () => {
    handleWithdrawSiteRun.mockResolvedValue({
      runId: 'run-1',
      selectedItemId: 'selected-1',
      contentVariantId: 'variant-1',
      action: 'withdraw',
      channel: 'site',
    });
    const { POST } = await import('../app/api/runs/[runId]/withdraw-site/route');

    const response = await POST(new Request('http://localhost/api', { method: 'POST', headers: { 'x-admin-secret': 'admin-secret' }, body: JSON.stringify({ selectedItemId: 'selected-1' }) }), {
      params: Promise.resolve({ runId: 'run-1' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      runId: 'run-1',
      action: 'withdraw-site',
      selectedItemId: 'selected-1',
      contentVariantId: 'variant-1',
      channel: 'site',
    });
    expect(handleWithdrawSiteRun).toHaveBeenCalledWith('run-1', 'selected-1', 'admin');
  });
});

describe('lead events route', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://demo.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.SUPABASE_STORAGE_BUCKET = 'artifacts';
    process.env.CRON_SECRET = 'cron-secret';
    process.env.NEXT_PUBLIC_APP_URL = 'https://radar.example.com';
    delete process.env.ADMIN_SECRET;
  });

  it('creates a public lead event with contact fields', async () => {
    createSupabaseServerClient.mockReturnValue({});
    const create = vi.fn().mockResolvedValue({
      id: 'lead-1',
      sourceChannel: 'site',
      pageType: 'site_article',
      eventType: 'subscribe',
      contact: 'founder@example.com',
      notes: '想看案例',
      createdAt: '2026-05-09T04:00:00.000Z',
    });
    createLeadEventRepository.mockReturnValue({ create });
    const { POST } = await import('../app/api/lead-events/route');

    const response = await POST(
      new Request('http://localhost/api/lead-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceChannel: 'site',
          pageType: 'site_article',
          eventType: 'subscribe',
          contact: 'founder@example.com',
          notes: '想看案例',
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(createLeadEventRepository).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({
      sourceChannel: 'site',
      pageType: 'site_article',
      eventType: 'subscribe',
      contact: 'founder@example.com',
      notes: '想看案例',
    });
  });

  it('rejects unsupported lead event types', async () => {
    const { POST } = await import('../app/api/lead-events/route');

    const response = await POST(
      new Request('http://localhost/api/lead-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceChannel: 'site', pageType: 'site_index', eventType: 'partner_inquiry' }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ ok: false, reason: 'invalid eventType' });
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it('rejects missing lead event fields', async () => {
    const { POST } = await import('../app/api/lead-events/route');

    const response = await POST(
      new Request('http://localhost/api/lead-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceChannel: 'site', eventType: 'consult' }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ ok: false, reason: 'missing fields' });
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it('rejects missing contact for public lead capture', async () => {
    const { POST } = await import('../app/api/lead-events/route');

    const response = await POST(
      new Request('http://localhost/api/lead-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceChannel: 'site', pageType: 'site_index', eventType: 'consult', contact: '   ' }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ ok: false, reason: 'contact required' });
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });
});

describe('push route', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://demo.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.SUPABASE_STORAGE_BUCKET = 'artifacts';
    process.env.CRON_SECRET = 'cron-secret';
    process.env.NEXT_PUBLIC_APP_URL = 'https://radar.example.com';
  });

  it('returns 401 when admin secret is missing or invalid', async () => {
    process.env.ADMIN_SECRET = 'admin-secret';
    const { POST } = await import('../app/api/runs/[runId]/push/route');

    const response = await POST(new Request('http://localhost/api', { method: 'POST' }), {
      params: Promise.resolve({ runId: 'run-1' }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ ok: false, runId: 'run-1', reason: 'unauthorized' });
    expect(handlePushRun).not.toHaveBeenCalled();
  });

  it('returns mixed push status when some channels fail and others succeed', async () => {
    handlePushRun.mockResolvedValue({ ok: true, status: { feishu: false, wecom: true, wxpusher: false } });
    const { POST } = await import('../app/api/runs/[runId]/push/route');

    const response = await POST(new Request('http://localhost/api', { method: 'POST', headers: { 'x-admin-secret': 'admin-secret' } }), {
      params: Promise.resolve({ runId: 'run-1' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      runId: 'run-1',
      action: 'push',
      status: { feishu: false, wecom: true, wxpusher: false },
    });
    expect(handlePushRun).toHaveBeenCalledWith('run-1');
  });

  it('returns 409 when no push digest is available for delivery', async () => {
    handlePushRun.mockResolvedValue({ ok: false, reason: 'push digest unavailable', status: { feishu: false, wecom: false, wxpusher: false } });
    const { POST } = await import('../app/api/runs/[runId]/push/route');

    const response = await POST(new Request('http://localhost/api', { method: 'POST', headers: { 'x-admin-secret': 'admin-secret' } }), {
      params: Promise.resolve({ runId: 'run-1' }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      runId: 'run-1',
      action: 'push',
      reason: 'push digest unavailable',
      status: { feishu: false, wecom: false, wxpusher: false },
    });
  });
});
