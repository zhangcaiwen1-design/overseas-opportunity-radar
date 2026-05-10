import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const loadSettingsPageData = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock('../src/cloud/queries/loadSettingsPageData', () => ({
  loadSettingsPageData,
}));

describe('SettingsPage', () => {
  it('renders deployment blockers when cloud preflight is not ready', async () => {
    loadSettingsPageData.mockResolvedValue({
      cloudReady: false,
      preflight: {
        status: 'missing_env',
        environment: 'production',
        environmentLabel: '生产环境',
        summary: '云端环境未完成，缺少：CRON_SECRET、NEXT_PUBLIC_APP_URL',
        hint: '先在 .env.local 或 .env 中补齐这 5 个云端变量。',
        missingKeys: ['CRON_SECRET', 'NEXT_PUBLIC_APP_URL'],
      },
      configuredChannels: [],
      allPushConfigs: [],
      timezone: 'Asia/Shanghai',
      dailyRunTime: '09:00',
      openaiBaseUrl: '',
      openaiApiKeyConfigured: false,
    });

    const { default: SettingsPage } = await import('../app/settings/page');
    const html = renderToStaticMarkup(await SettingsPage());

    expect(html).toContain('当前环境：生产环境');
    expect(html).toContain('运行目标：面向正式生产流量，请确认生产环境变量、定时任务与推送配置均已按基线部署。');
    expect(html).toContain('部署阻断项');
    expect(html).toContain('CRON_SECRET');
    expect(html).toContain('NEXT_PUBLIC_APP_URL');
    expect(html).toContain('当前未配置云端环境，配置保存已禁用。');
  });

  it('renders environment-aware preflight copy and cron expression from the view model chain', async () => {
    loadSettingsPageData.mockResolvedValue({
      cloudReady: true,
      preflight: {
        status: 'ready',
        environment: 'staging',
        environmentLabel: 'Staging 环境',
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

    const { default: SettingsPage } = await import('../app/settings/page');
    const html = renderToStaticMarkup(await SettingsPage());

    expect(html).toContain('云端环境已就绪，可直接连接数据库与对象存储。');
    expect(html).toContain('当前环境：Staging 环境');
    expect(html).toContain('运行目标：用于云端联调与手动 daily run 演练，请避免把 staging 当成正式生产。');
    expect(html).toContain('可以先在 /settings 确认配置，再触发一次手动采集。');
    expect(html).toContain('cron 预览：0 1 * * *');
    expect(html).toContain('仅根据当前时区与每日执行时间计算，不表示云端定时任务已同步部署。');
    expect(html).toContain('上线检查清单');
    expect(html).toContain('确认 preflight 为 ready');
    expect(html).toContain('确认 cron 预览与部署计划一致');
    expect(html).toContain('确认至少一个推送渠道已启用');
    expect(html).toContain('管理密钥');
    expect(html).toContain('https://gateway.example.com/v1');
    expect(html).toContain('OpenAI API Key 已配置');
    expect(html).toContain('OpenAI 网关');
  });
});
