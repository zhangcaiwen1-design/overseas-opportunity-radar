import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import * as settingsFormModule from '../app/settings/SettingsForm';
import { SettingsForm } from '../app/settings/SettingsForm';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe('SettingsForm', () => {
  it('renders the cron expression passed from the settings view model', () => {
    const html = renderToStaticMarkup(
      createElement(SettingsForm, {
        timezone: 'Asia/Shanghai',
        dailyRunTime: '09:00',
        cronExpression: '0 1 * * *',
        configs: [],
        cloudReady: true,
      }),
    );

    expect(html).toContain('cron 预览：0 1 * * *');
    expect(html).toContain('仅根据当前时区与每日执行时间计算，不表示云端定时任务已同步部署。');
    expect(html).toContain('管理密钥');
    expect(html).toContain('ADMIN_SECRET');
    expect(html).toContain('OpenAI 网关');
    expect(html).toContain('OpenAI API Key');
  });

  it('reports an error for malformed wxpusher payload', () => {
    expect(
      settingsFormModule.validatePushConfigSecretPayload({
        channel: 'wxpusher',
        enabled: true,
        secretPayload: 'app-token-only',
      }),
    ).toBe('WxPusher 配置格式必须是 appToken|uid');
  });

  it('reports an error for malformed feishu webhook payload', () => {
    expect(
      settingsFormModule.validatePushConfigSecretPayload({
        channel: 'feishu',
        enabled: true,
        secretPayload: 'not-a-url',
      }),
    ).toBe('飞书 Webhook 必须使用 https URL');
  });

  it('renders a validation error and disables save for malformed enabled config', () => {
    const html = renderToStaticMarkup(
      createElement(SettingsForm, {
        timezone: 'Asia/Shanghai',
        dailyRunTime: '09:00',
        cronExpression: '0 1 * * *',
        configs: [{ channel: 'wxpusher', enabled: true, secretPayload: 'app-token-only' }],
        cloudReady: true,
      }),
    );

    expect(html).toContain('WxPusher 配置格式必须是 appToken|uid');
    expect(html).toContain('disabled=""');
  });

  it('renders a validation error and disables save for invalid daily run time', () => {
    const html = renderToStaticMarkup(
      createElement(SettingsForm, {
        timezone: 'Asia/Shanghai',
        dailyRunTime: '9am',
        cronExpression: '0 1 * * *',
        configs: [],
        cloudReady: true,
      }),
    );

    expect(html).toContain('每日执行时间必须是 HH:MM 格式');
    expect(html).toContain('disabled=""');
  });

  it('renders a validation error and disables save for invalid timezone', () => {
    const html = renderToStaticMarkup(
      createElement(SettingsForm, {
        timezone: 'Europe/Berlin',
        dailyRunTime: '09:00',
        cronExpression: '0 1 * * *',
        configs: [],
        cloudReady: true,
      }),
    );

    expect(html).toContain('时区必须是 Asia/Shanghai 或 UTC');
    expect(html).toContain('disabled=""');
  });

  it('formats save success status as a cron preview only', () => {
    expect(settingsFormModule.formatSaveSuccessStatus('0 1 * * *')).toBe(
      '保存成功，cron 表达式预览为 0 1 * * *；这是按当前设置计算的结果，正在刷新配置...',
    );
  });
});
