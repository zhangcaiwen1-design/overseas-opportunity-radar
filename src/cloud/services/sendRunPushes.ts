import { pushToFeishu } from '../../push/feishuPusher';
import { pushToWeCom } from '../../push/wecomPusher';
import { pushToWxPusher } from '../../push/wxpusherPusher';
import type { PushChannel } from '../types';

export async function sendInternalAlert(input: {
  runId: string;
  failedChannels: PushChannel[];
  configs: Array<{ channel: PushChannel; enabled: boolean; secretPayload: string }>;
  pushers?: {
    pushToFeishu?: typeof pushToFeishu;
    pushToWeCom?: typeof pushToWeCom;
    pushToWxPusher?: typeof pushToWxPusher;
  };
}) {
  const pushers = {
    pushToFeishu,
    pushToWeCom,
    pushToWxPusher,
    ...input.pushers,
  };
  const alertBody = `内部告警：run ${input.runId} 推送失败通道 ${input.failedChannels.join('、')}。`;

  for (const config of input.configs.filter((item) => item.enabled)) {
    if (config.channel === 'feishu' && pushers.pushToFeishu) {
      await pushers.pushToFeishu(config.secretPayload, alertBody).catch(() => undefined);
    }

    if (config.channel === 'wecom' && pushers.pushToWeCom) {
      await pushers.pushToWeCom(config.secretPayload, alertBody).catch(() => undefined);
    }

    if (config.channel === 'wxpusher' && pushers.pushToWxPusher) {
      const [appToken, uid] = config.secretPayload.split('|');
      if (appToken && uid) {
        await pushers.pushToWxPusher(appToken, uid, alertBody).catch(() => undefined);
      }
    }
  }
}

export async function sendRunPushes(input: {
  runId: string;
  digest: string;
  configs: Array<{ channel: 'feishu' | 'wecom' | 'wxpusher'; enabled: boolean; secretPayload: string }>;
  pushers?: {
    pushToFeishu?: typeof pushToFeishu;
    pushToWeCom?: typeof pushToWeCom;
    pushToWxPusher?: typeof pushToWxPusher;
  };
  createPushLog: (input: {
    runId: string;
    channel: string;
    status: 'success' | 'failed';
    responseSummary: string;
  }) => Promise<void>;
}) {
  const pushers = {
    pushToFeishu,
    pushToWeCom,
    pushToWxPusher,
    ...input.pushers,
  };

  const status = {
    feishu: false,
    wecom: false,
    wxpusher: false,
  };

  for (const config of input.configs.filter((item) => item.enabled)) {
    try {
      if (config.channel === 'feishu' && pushers.pushToFeishu) {
        await pushers.pushToFeishu(config.secretPayload, input.digest);
        await input.createPushLog({
          runId: input.runId,
          channel: 'feishu',
          status: 'success',
          responseSummary: 'ok',
        });
        status.feishu = true;
      }

      if (config.channel === 'wecom' && pushers.pushToWeCom) {
        await pushers.pushToWeCom(config.secretPayload, input.digest);
        await input.createPushLog({
          runId: input.runId,
          channel: 'wecom',
          status: 'success',
          responseSummary: 'ok',
        });
        status.wecom = true;
      }

      if (config.channel === 'wxpusher' && pushers.pushToWxPusher) {
        const [appToken, uid] = config.secretPayload.split('|');
        if (!appToken || !uid) {
          throw new Error('invalid wxpusher payload');
        }

        await pushers.pushToWxPusher(appToken, uid, input.digest);
        await input.createPushLog({
          runId: input.runId,
          channel: 'wxpusher',
          status: 'success',
          responseSummary: 'ok',
        });
        status.wxpusher = true;
      }
    } catch (error) {
      await input.createPushLog({
        runId: input.runId,
        channel: config.channel,
        status: 'failed',
        responseSummary: error instanceof Error ? error.message : 'push failed',
      });
    }
  }

  return status;
}
