import { ZodError } from 'zod';
import { NextResponse } from 'next/server';
import { hasCloudEnv } from '../../../../src/cloud/cloudEnv';
import { loadCloudConfig } from '../../../../src/cloud/loadCloudConfig';
import { createAppSettingsRepository } from '../../../../src/cloud/repositories/appSettingsRepository';
import { createPushConfigRepository } from '../../../../src/cloud/repositories/pushConfigRepository';
import { toUtcCronExpression } from '../../../../src/cloud/settings/syncCronSchedule';
import { createSupabaseServerClient } from '../../../../src/cloud/supabase/serverClient';

const supportedChannels = ['feishu', 'wecom', 'wxpusher'] as const;
type SupportedChannel = (typeof supportedChannels)[number];

function isSupportedChannel(value: unknown): value is SupportedChannel {
  return typeof value === 'string' && supportedChannels.includes(value as SupportedChannel);
}

function isPushConfigInput(
  value: unknown,
): value is { channel: SupportedChannel; enabled?: boolean; secretPayload?: string } {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return 'channel' in value && isSupportedChannel(value.channel);
}

function isValidTimezone(value: unknown): value is 'Asia/Shanghai' | 'UTC' {
  return value === 'Asia/Shanghai' || value === 'UTC';
}

function isValidDailyRunTime(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
}

function normalizeOptionalString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function isValidSecretPayload(channel: SupportedChannel, value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }

  if (channel === 'wxpusher') {
    const [appToken, uid] = value.split('|');
    return Boolean(appToken && uid);
  }

  try {
    const url = new URL(value);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const adminSecret = process.env.ADMIN_SECRET;
  if (adminSecret && request.headers.get('x-admin-secret') !== adminSecret) {
    return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
  }

  if (!hasCloudEnv(process.env)) {
    return NextResponse.json({ ok: false, reason: 'cloud env not configured' }, { status: 503 });
  }

  try {
    loadCloudConfig(process.env);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ ok: false, reason: 'cloud env invalid' }, { status: 503 });
    }

    throw error;
  }

  const body = await request.json().catch(() => ({}));
  const rawConfigs: unknown[] = Array.isArray(body.configs) ? body.configs : [];
  if (rawConfigs.some((item) => !isPushConfigInput(item))) {
    return NextResponse.json({ ok: false, reason: 'invalid push channel' }, { status: 400 });
  }

  const configs = rawConfigs.filter(isPushConfigInput);

  const timezone = body.timezone;
  const dailyRunTime = body.dailyRunTime;
  const openaiBaseUrl = normalizeOptionalString(body.openaiBaseUrl);
  const openaiApiKey = normalizeOptionalString(body.openaiApiKey);
  if (!isValidTimezone(timezone) || !isValidDailyRunTime(dailyRunTime)) {
    return NextResponse.json({ ok: false, reason: 'invalid schedule settings' }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const repository = createPushConfigRepository(supabase as never);
  const appSettingsRepository = createAppSettingsRepository(supabase as never);
  const existingConfigs = await repository.listAll();

  if (
    configs.some((item) => {
      if (item.enabled === false) {
        return false;
      }

      const nextSecretPayload = typeof item.secretPayload === 'string' ? item.secretPayload.trim() : '';
      const existing = existingConfigs.find((config) => config.channel === item.channel);
      return !isValidSecretPayload(item.channel, nextSecretPayload || existing?.secretPayload || '');
    })
  ) {
    return NextResponse.json({ ok: false, reason: 'invalid push secret payload' }, { status: 400 });
  }

  await repository.saveMany(
    configs.map((item) => {
      const existing = existingConfigs.find((config) => config.channel === item.channel);
      const nextSecretPayload = typeof item.secretPayload === 'string' ? item.secretPayload.trim() : '';

      return {
        channel: item.channel,
        enabled: Boolean(item.enabled),
        secretPayload: nextSecretPayload || existing?.secretPayload || '',
      };
    }),
  );

  await appSettingsRepository.saveMany([
    { key: 'timezone', value: timezone },
    { key: 'dailyRunTime', value: dailyRunTime },
    { key: 'openaiBaseUrl', value: openaiBaseUrl },
    ...(openaiApiKey ? [{ key: 'openaiApiKey', value: openaiApiKey }] : []),
  ]);

  const cronExpression = toUtcCronExpression(dailyRunTime, timezone);

  return NextResponse.json({ ok: true, cronExpression });
}
