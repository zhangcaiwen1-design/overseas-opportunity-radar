import { toUtcCronExpression } from '../settings/syncCronSchedule';

const supportedChannels = ['feishu', 'wecom', 'wxpusher'] as const;

export function buildSettingsPageViewModel(input: {
  timezone: string;
  dailyRunTime: string;
  openaiBaseUrl: string;
  openaiApiKeyConfigured: boolean;
  configuredChannels: Array<'feishu' | 'wecom' | 'wxpusher'>;
  allPushConfigs: Array<{ channel: 'feishu' | 'wecom' | 'wxpusher'; enabled: boolean; secretPayload: string }>;
}) {
  return {
    timezone: input.timezone,
    dailyRunTime: input.dailyRunTime,
    openaiBaseUrl: input.openaiBaseUrl,
    openaiApiKeyConfigured: input.openaiApiKeyConfigured,
    cronExpression: toUtcCronExpression(input.dailyRunTime, input.timezone),
    channels: supportedChannels.map((channel) => {
      const config = input.allPushConfigs.find((item) => item.channel === channel);

      return {
        channel,
        configured: config?.enabled ?? input.configuredChannels.includes(channel),
        enabled: config?.enabled ?? input.configuredChannels.includes(channel),
        hasSavedSecret: Boolean(config?.secretPayload),
      };
    }),
  };
}
