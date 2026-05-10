import { isCloudSchemaMissingError, resolveCloudPreflight, type CloudPreflightResult } from '../cloudEnv';
import { loadCloudConfig } from '../loadCloudConfig';
import { createAppSettingsRepository } from '../repositories/appSettingsRepository';
import { createPushConfigRepository } from '../repositories/pushConfigRepository';
import { createSupabaseServerClient } from '../supabase/serverClient';
import type { CloudPushConfig } from '../types';

interface SettingsPageData {
  cloudReady: boolean;
  preflight: CloudPreflightResult;
  configuredChannels: Array<'feishu' | 'wecom' | 'wxpusher'>;
  allPushConfigs: CloudPushConfig[];
  timezone: string;
  dailyRunTime: string;
  openaiBaseUrl: string;
  openaiApiKeyConfigured: boolean;
}

function createFallbackSettingsPageData(preflight: CloudPreflightResult): SettingsPageData {
  return {
    cloudReady: preflight.status === 'ready',
    preflight,
    configuredChannels: [],
    allPushConfigs: [],
    timezone: 'Asia/Shanghai',
    dailyRunTime: '09:00',
    openaiBaseUrl: '',
    openaiApiKeyConfigured: false,
  };
}

export async function loadSettingsPageData(): Promise<SettingsPageData> {
  const preflight = await resolveCloudPreflight({
    env: process.env,
    checkDatabase: async () => {
      const supabase = createSupabaseServerClient();
      const { error } = await supabase.from('runs').select('id').limit(1);

      if (!error) {
        return { status: 'ready' as const };
      }

      return {
        status: isCloudSchemaMissingError(error) ? ('database_schema_missing' as const) : ('database_unreachable' as const),
      };
    },
    checkStorage: async () => {
      const supabase = createSupabaseServerClient();
      const { storageBucket } = loadCloudConfig(process.env);
      const { error } = await supabase.storage.from(storageBucket).list('', { limit: 1 });

      return {
        status: error ? ('storage_unavailable' as const) : ('ready' as const),
      };
    },
  });

  if (preflight.status !== 'ready') {
    return createFallbackSettingsPageData(preflight);
  }

  try {
    const supabase = createSupabaseServerClient();
    const pushConfigRepository = createPushConfigRepository(supabase as never);
    const appSettingsRepository = createAppSettingsRepository(supabase as never);
    const [pushConfigs, allPushConfigs, appSettings] = await Promise.all([
      pushConfigRepository.listEnabled(),
      pushConfigRepository.listAll(),
      appSettingsRepository.listAll(),
    ]);

    return {
      cloudReady: true,
      preflight,
      configuredChannels: pushConfigs.map((item) => item.channel),
      allPushConfigs,
      timezone: appSettings.find((item) => item.key === 'timezone')?.value || 'Asia/Shanghai',
      dailyRunTime: appSettings.find((item) => item.key === 'dailyRunTime')?.value || '09:00',
      openaiBaseUrl: appSettings.find((item) => item.key === 'openaiBaseUrl')?.value || '',
      openaiApiKeyConfigured: Boolean(appSettings.find((item) => item.key === 'openaiApiKey')?.value),
    };
  } catch {
    return createFallbackSettingsPageData({
      ...preflight,
      status: 'database_unreachable',
      summary: '云端预检已通过，但读取设置配置失败。',
      hint: '请确认 app_settings 与 push_configs 表可读，或稍后重试。',
      missingKeys: [],
    });
  }
}
