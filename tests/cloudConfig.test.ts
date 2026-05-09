import { describe, expect, it, vi } from 'vitest';
import { detectCloudEnvironment, getMissingCloudEnvKeys, resolveCloudPreflight } from '../src/cloud/cloudEnv';
import { loadCloudConfig } from '../src/cloud/loadCloudConfig';

const validCloudEnv = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://demo.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  SUPABASE_STORAGE_BUCKET: 'artifacts',
  CRON_SECRET: 'cron-secret',
  NEXT_PUBLIC_APP_URL: 'https://radar.example.com',
};

describe('loadCloudConfig', () => {
  it('maps required Supabase and cron settings for the cloud admin app', () => {
    const config = loadCloudConfig(validCloudEnv);

    expect(config.supabaseUrl).toBe('https://demo.supabase.co');
    expect(config.storageBucket).toBe('artifacts');
    expect(config.cronSecret).toBe('cron-secret');
    expect(config.appUrl).toBe('https://radar.example.com');
  });

  it('lists missing cloud environment keys', () => {
    expect(
      getMissingCloudEnvKeys({
        NEXT_PUBLIC_SUPABASE_URL: 'https://demo.supabase.co',
        SUPABASE_STORAGE_BUCKET: 'artifacts',
      }),
    ).toEqual(['SUPABASE_SERVICE_ROLE_KEY', 'CRON_SECRET', 'NEXT_PUBLIC_APP_URL']);
  });
});

describe('detectCloudEnvironment', () => {
  it('returns production when VERCEL_ENV is production', () => {
    expect(detectCloudEnvironment({ VERCEL_ENV: 'production' })).toEqual({
      environment: 'production',
      environmentLabel: '生产环境',
    });
  });

  it('returns staging when VERCEL_ENV is preview', () => {
    expect(detectCloudEnvironment({ VERCEL_ENV: 'preview' })).toEqual({
      environment: 'staging',
      environmentLabel: 'Staging 环境',
    });
  });

  it('falls back to local when VERCEL_ENV is missing or unknown', () => {
    expect(detectCloudEnvironment({})).toEqual({
      environment: 'local',
      environmentLabel: '本地环境',
    });
    expect(detectCloudEnvironment({ VERCEL_ENV: 'development' })).toEqual({
      environment: 'local',
      environmentLabel: '本地环境',
    });
  });
});

describe('isCloudSchemaMissingError', () => {
  it('recognizes known postgres and postgrest schema-missing codes', async () => {
    const { isCloudSchemaMissingError } = await import('../src/cloud/cloudEnv');

    expect(isCloudSchemaMissingError({ code: '42P01' })).toBe(true);
    expect(isCloudSchemaMissingError({ code: 'PGRST205' })).toBe(true);
  });

  it('recognizes schema cache style messages and ignores unrelated errors', async () => {
    const { isCloudSchemaMissingError } = await import('../src/cloud/cloudEnv');

    expect(isCloudSchemaMissingError({ message: 'Could not find the table in schema cache' })).toBe(true);
    expect(isCloudSchemaMissingError({ message: 'network timeout' })).toBe(false);
  });
});

describe('resolveCloudPreflight', () => {
  it('reports missing_env before running live checks', async () => {
    const checkDatabase = vi.fn();
    const checkStorage = vi.fn();

    const result = await resolveCloudPreflight({
      env: {
        NEXT_PUBLIC_SUPABASE_URL: 'https://demo.supabase.co',
        SUPABASE_STORAGE_BUCKET: 'artifacts',
      },
      checkDatabase,
      checkStorage,
    });

    expect(result.status).toBe('missing_env');
    expect(result.environment).toBe('local');
    expect(result.environmentLabel).toBe('本地环境');
    expect(result.missingKeys).toEqual(['SUPABASE_SERVICE_ROLE_KEY', 'CRON_SECRET', 'NEXT_PUBLIC_APP_URL']);
    expect(checkDatabase).not.toHaveBeenCalled();
    expect(checkStorage).not.toHaveBeenCalled();
  });

  it('reports invalid_env for malformed URLs', async () => {
    const checkDatabase = vi.fn();
    const checkStorage = vi.fn();

    const result = await resolveCloudPreflight({
      env: { ...validCloudEnv, NEXT_PUBLIC_APP_URL: 'not-a-url', VERCEL_ENV: 'preview' },
      checkDatabase,
      checkStorage,
    });

    expect(result.status).toBe('invalid_env');
    expect(result.environment).toBe('staging');
    expect(result.environmentLabel).toBe('Staging 环境');
    expect(checkDatabase).not.toHaveBeenCalled();
    expect(checkStorage).not.toHaveBeenCalled();
  });

  it('reports database unreachable when the minimal read cannot connect', async () => {
    const checkStorage = vi.fn();

    const result = await resolveCloudPreflight({
      env: validCloudEnv,
      checkDatabase: async () => ({ status: 'database_unreachable' }),
      checkStorage,
    });

    expect(result.status).toBe('database_unreachable');
    expect(result.environment).toBe('local');
    expect(result.hint).toContain('service role key');
    expect(checkStorage).not.toHaveBeenCalled();
  });

  it('reports database unreachable when the database check throws', async () => {
    const checkStorage = vi.fn();

    const result = await resolveCloudPreflight({
      env: validCloudEnv,
      checkDatabase: async () => {
        throw new Error('network failed');
      },
      checkStorage,
    });

    expect(result.status).toBe('database_unreachable');
    expect(result.environment).toBe('local');
    expect(checkStorage).not.toHaveBeenCalled();
  });

  it('reports database schema missing when the minimal read hits an uninitialized table', async () => {
    const checkStorage = vi.fn();

    const result = await resolveCloudPreflight({
      env: validCloudEnv,
      checkDatabase: async () => ({ status: 'database_schema_missing' }),
      checkStorage,
    });

    expect(result.status).toBe('database_schema_missing');
    expect(result.environment).toBe('local');
    expect(result.hint).toContain('20260508_cloud_admin_mvp.sql');
    expect(checkStorage).not.toHaveBeenCalled();
  });

  it('reports storage unavailable after database passes', async () => {
    const checkStorage = vi.fn().mockResolvedValue({ status: 'storage_unavailable' });

    const result = await resolveCloudPreflight({
      env: validCloudEnv,
      checkDatabase: async () => ({ status: 'ready' }),
      checkStorage,
    });

    expect(result.status).toBe('storage_unavailable');
    expect(result.environment).toBe('local');
    expect(checkStorage).toHaveBeenCalledTimes(1);
  });

  it('reports ready when database and storage checks both pass', async () => {
    const result = await resolveCloudPreflight({
      env: validCloudEnv,
      checkDatabase: async () => ({ status: 'ready' }),
      checkStorage: async () => ({ status: 'ready' }),
    });

    expect(result.status).toBe('ready');
    expect(result.environment).toBe('local');
    expect(result.environmentLabel).toBe('本地环境');
    expect(result.summary).toContain('云端环境已就绪');
  });
});
