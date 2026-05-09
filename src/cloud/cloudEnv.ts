import { ZodError } from 'zod';
import { loadCloudConfig } from './loadCloudConfig';

const requiredCloudEnvKeys = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_STORAGE_BUCKET',
  'CRON_SECRET',
  'NEXT_PUBLIC_APP_URL',
] as const;

export type CloudRuntimeEnvironment = 'local' | 'staging' | 'production';

export type CloudPreflightStatus =
  | 'missing_env'
  | 'invalid_env'
  | 'database_unreachable'
  | 'database_schema_missing'
  | 'storage_unavailable'
  | 'ready';

export interface CloudEnvironmentInfo {
  environment: CloudRuntimeEnvironment;
  environmentLabel: string;
}

export interface CloudPreflightResult extends CloudEnvironmentInfo {
  status: CloudPreflightStatus;
  summary: string;
  hint: string;
  missingKeys: string[];
}

export function getMissingCloudEnvKeys(env: Record<string, string | undefined>) {
  return requiredCloudEnvKeys.filter((key) => !env[key]);
}

export function hasCloudEnv(env: Record<string, string | undefined>) {
  return getMissingCloudEnvKeys(env).length === 0;
}

export function detectCloudEnvironment(env: Record<string, string | undefined>): CloudEnvironmentInfo {
  const vercelEnv = env.VERCEL_ENV;

  if (vercelEnv === 'production') {
    return {
      environment: 'production',
      environmentLabel: '生产环境',
    };
  }

  if (vercelEnv === 'preview') {
    return {
      environment: 'staging',
      environmentLabel: 'Staging 环境',
    };
  }

  return {
    environment: 'local',
    environmentLabel: '本地环境',
  };
}

export function isCloudSchemaMissingError(error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
  const message = typeof error === 'object' && error && 'message' in error ? String(error.message) : '';

  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    message.includes('does not exist') ||
    message.includes('Could not find the table') ||
    message.includes('schema cache')
  );
}

export async function resolveCloudPreflight(input: {
  env: Record<string, string | undefined>;
  checkDatabase: () => Promise<{ status: 'ready' | 'database_unreachable' | 'database_schema_missing' }>;
  checkStorage: () => Promise<{ status: 'ready' | 'storage_unavailable' }>;
}): Promise<CloudPreflightResult> {
  const environmentInfo = detectCloudEnvironment(input.env);
  const missingKeys = getMissingCloudEnvKeys(input.env);
  if (missingKeys.length > 0) {
    return {
      ...environmentInfo,
      status: 'missing_env',
      summary: `云端环境未完成，缺少：${missingKeys.join('、')}`,
      hint: '先在 .env.local 或 .env 中补齐这 5 个云端变量。',
      missingKeys,
    };
  }

  try {
    loadCloudConfig(input.env);
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        ...environmentInfo,
        status: 'invalid_env',
        summary: '云端环境变量格式无效，请检查 URL 配置。',
        hint: '确认 NEXT_PUBLIC_SUPABASE_URL 与 NEXT_PUBLIC_APP_URL 是完整 URL，其他变量不能为空。',
        missingKeys: [],
      };
    }

    throw error;
  }

  let databaseResult: Awaited<ReturnType<typeof input.checkDatabase>>;

  try {
    databaseResult = await input.checkDatabase();
  } catch {
    databaseResult = { status: 'database_unreachable' };
  }

  if (databaseResult.status === 'database_unreachable') {
    return {
      ...environmentInfo,
      status: 'database_unreachable',
      summary: '云端数据库暂不可用，当前无法建立最小读连接。',
      hint: '确认 Supabase URL、service role key 和当前网络连通性是否正确。',
      missingKeys: [],
    };
  }

  if (databaseResult.status === 'database_schema_missing') {
    return {
      ...environmentInfo,
      status: 'database_schema_missing',
      summary: '云端数据库已连接，但业务表尚未初始化。',
      hint: '先执行 supabase/migrations/20260508_cloud_admin_mvp.sql。',
      missingKeys: [],
    };
  }

  let storageResult: Awaited<ReturnType<typeof input.checkStorage>>;

  try {
    storageResult = await input.checkStorage();
  } catch {
    storageResult = { status: 'storage_unavailable' };
  }

  if (storageResult.status === 'storage_unavailable') {
    return {
      ...environmentInfo,
      status: 'storage_unavailable',
      summary: '云端数据库已连接，但 Storage bucket 不可用。',
      hint: '在 Supabase 中手动创建与 SUPABASE_STORAGE_BUCKET 同名的 bucket。',
      missingKeys: [],
    };
  }

  return {
    ...environmentInfo,
    status: 'ready',
    summary: '云端环境已就绪，可直接连接数据库与对象存储。',
    hint: '可以先在 /settings 确认配置，再触发一次手动采集。',
    missingKeys: [],
  };
}
