import { describe, expect, it, vi } from 'vitest';
import { sendInternalAlert, sendRunPushes } from '../src/cloud/services/sendRunPushes';

describe('sendInternalAlert', () => {
  it('broadcasts an internal alert through enabled channels and tolerates delivery failures', async () => {
    const pushToFeishu = vi.fn().mockRejectedValue(new Error('timeout'));
    const pushToWeCom = vi.fn().mockResolvedValue(undefined);

    await expect(
      sendInternalAlert({
        runId: 'run-1',
        failedChannels: ['feishu'],
        configs: [
          { channel: 'feishu', enabled: true, secretPayload: 'https://example.com/feishu' },
          { channel: 'wecom', enabled: true, secretPayload: 'https://example.com/wecom' },
        ],
        pushers: { pushToFeishu, pushToWeCom },
      }),
    ).resolves.toBeUndefined();

    expect(pushToFeishu).toHaveBeenCalledWith('https://example.com/feishu', '内部告警：run run-1 推送失败通道 feishu。');
    expect(pushToWeCom).toHaveBeenCalledWith('https://example.com/wecom', '内部告警：run run-1 推送失败通道 feishu。');
  });
});

describe('sendRunPushes', () => {
  it('sends digest through enabled channels and records push logs', async () => {
    const pushToFeishu = vi.fn().mockResolvedValue(undefined);
    const createPushLog = vi.fn().mockResolvedValue(undefined);

    const result = await sendRunPushes({
      runId: 'run-1',
      digest: '今日海外商业机会雷达｜2026-05-08',
      configs: [{ channel: 'feishu', enabled: true, secretPayload: 'https://example.com/feishu' }],
      pushers: { pushToFeishu },
      createPushLog,
    });

    expect(result.feishu).toBe(true);
    expect(pushToFeishu).toHaveBeenCalledWith('https://example.com/feishu', '今日海外商业机会雷达｜2026-05-08');
    expect(createPushLog).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'feishu', status: 'success' }),
    );
  });

  it('supports wxpusher channel with appToken and uid', async () => {
    const pushToWxPusher = vi.fn().mockResolvedValue(undefined);
    const createPushLog = vi.fn().mockResolvedValue(undefined);

    const result = await sendRunPushes({
      runId: 'run-1',
      digest: 'digest',
      configs: [{ channel: 'wxpusher', enabled: true, secretPayload: 'app-token|uid-1' }],
      pushers: { pushToWxPusher },
      createPushLog,
    });

    expect(result.wxpusher).toBe(true);
    expect(pushToWxPusher).toHaveBeenCalledWith('app-token', 'uid-1', 'digest');
    expect(createPushLog).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'wxpusher', status: 'success' }),
    );
  });

  it('records a failed log and continues with later channels when one push fails', async () => {
    const pushToFeishu = vi.fn().mockRejectedValue(new Error('timeout'));
    const pushToWeCom = vi.fn().mockResolvedValue(undefined);
    const createPushLog = vi.fn().mockResolvedValue(undefined);

    const result = await sendRunPushes({
      runId: 'run-1',
      digest: 'digest',
      configs: [
        { channel: 'feishu', enabled: true, secretPayload: 'https://example.com/feishu' },
        { channel: 'wecom', enabled: true, secretPayload: 'https://example.com/wecom' },
      ],
      pushers: { pushToFeishu, pushToWeCom },
      createPushLog,
    });

    expect(result).toEqual({ feishu: false, wecom: true, wxpusher: false });
    expect(pushToWeCom).toHaveBeenCalledWith('https://example.com/wecom', 'digest');
    expect(createPushLog).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ channel: 'feishu', status: 'failed', responseSummary: 'timeout' }),
    );
    expect(createPushLog).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ channel: 'wecom', status: 'success', responseSummary: 'ok' }),
    );
  });

  it('records a failed log when wxpusher config is malformed', async () => {
    const pushToWxPusher = vi.fn().mockResolvedValue(undefined);
    const createPushLog = vi.fn().mockResolvedValue(undefined);

    const result = await sendRunPushes({
      runId: 'run-1',
      digest: 'digest',
      configs: [{ channel: 'wxpusher', enabled: true, secretPayload: 'app-token-only' }],
      pushers: { pushToWxPusher },
      createPushLog,
    });

    expect(result).toEqual({ feishu: false, wecom: false, wxpusher: false });
    expect(pushToWxPusher).not.toHaveBeenCalled();
    expect(createPushLog).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'wxpusher', status: 'failed', responseSummary: 'invalid wxpusher payload' }),
    );
  });
});
