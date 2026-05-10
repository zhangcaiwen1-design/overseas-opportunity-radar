import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolveCloudPreflight = vi.fn();
const createSupabaseServerClient = vi.fn();
const createPushConfigRepository = vi.fn();
const createAppSettingsRepository = vi.fn();

vi.mock('../src/cloud/cloudEnv', () => ({
  resolveCloudPreflight,
  isCloudSchemaMissingError: vi.fn(),
}));

vi.mock('../src/cloud/supabase/serverClient', () => ({
  createSupabaseServerClient,
}));

vi.mock('../src/cloud/repositories/pushConfigRepository', () => ({
  createPushConfigRepository,
}));

vi.mock('../src/cloud/repositories/appSettingsRepository', () => ({
  createAppSettingsRepository,
}));

describe('loadSettingsPageData', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  it('returns ready settings data without depending on dashboard run queries', async () => {
    resolveCloudPreflight.mockResolvedValue({
      status: 'ready',
      environment: 'production',
      environmentLabel: '生产环境',
      summary: '云端环境已就绪，可直接连接数据库与对象存储。',
      hint: '可以先在 /settings 确认配置，再触发一次手动采集。',
      missingKeys: [],
    });
    createSupabaseServerClient.mockReturnValue({});
    createPushConfigRepository.mockReturnValue({
      listEnabled: vi.fn().mockResolvedValue([{ channel: 'feishu', enabled: true, secretPayload: 'https://example.com/hook' }]),
      listAll: vi.fn().mockResolvedValue([{ channel: 'feishu', enabled: true, secretPayload: 'https://example.com/hook' }]),
    });
    createAppSettingsRepository.mockReturnValue({
      listAll: vi.fn().mockResolvedValue([
        { key: 'timezone', value: 'Asia/Shanghai' },
        { key: 'dailyRunTime', value: '09:00' },
        { key: 'openaiBaseUrl', value: 'https://gateway.example.com/v1' },
        { key: 'openaiApiKey', value: 'configured' },
      ]),
    });

    const { loadSettingsPageData } = await import('../src/cloud/queries/loadSettingsPageData');
    const result = await loadSettingsPageData();

    expect(result).toEqual({
      cloudReady: true,
      preflight: {
        status: 'ready',
        environment: 'production',
        environmentLabel: '生产环境',
        summary: '云端环境已就绪，可直接连接数据库与对象存储。',
        hint: '可以先在 /settings 确认配置，再触发一次手动采集。',
        missingKeys: [],
      },
      configuredChannels: ['feishu'],
      allPushConfigs: [{ channel: 'feishu', enabled: true, secretPayload: 'https://example.com/hook' }],
      timezone: 'Asia/Shanghai',
      dailyRunTime: '09:00',
      openaiBaseUrl: 'https://gateway.example.com/v1',
      openaiApiKeyConfigured: true,
    });
  });

  it('returns settings-specific fallback copy when settings tables cannot be read', async () => {
    resolveCloudPreflight.mockResolvedValue({
      status: 'ready',
      environment: 'production',
      environmentLabel: '生产环境',
      summary: '云端环境已就绪，可直接连接数据库与对象存储。',
      hint: '可以先在 /settings 确认配置，再触发一次手动采集。',
      missingKeys: [],
    });
    createSupabaseServerClient.mockReturnValue({});
    createPushConfigRepository.mockReturnValue({
      listEnabled: vi.fn().mockRejectedValue(new Error('push_configs unreadable')),
      listAll: vi.fn().mockResolvedValue([]),
    });
    createAppSettingsRepository.mockReturnValue({
      listAll: vi.fn().mockResolvedValue([]),
    });

    const { loadSettingsPageData } = await import('../src/cloud/queries/loadSettingsPageData');
    const result = await loadSettingsPageData();

    expect(result.cloudReady).toBe(false);
    expect(result.preflight.summary).toBe('云端预检已通过，但读取设置配置失败。');
    expect(result.preflight.hint).toBe('请确认 app_settings 与 push_configs 表可读，或稍后重试。');
  });
});
