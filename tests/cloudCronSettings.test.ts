import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { readFile, writeFile } = vi.hoisted(() => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  readFile,
  writeFile,
}));

import { syncCronSchedule, toUtcCronExpression } from '../src/cloud/settings/syncCronSchedule';

describe('cloud admin migration', () => {
  it('declares push_configs.channel as a unique key for upsert safety', () => {
    const sql = readFileSync('supabase/migrations/20260508_cloud_admin_mvp.sql', 'utf8');

    expect(sql).toMatch(/channel\s+text\s+not\s+null[^\n]*unique/i);
  });
});

describe('syncCronSchedule', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns the computed cron expression without reading or writing vercel.json', async () => {
    await expect(syncCronSchedule({ dailyRunTime: '09:00', timezone: 'Asia/Shanghai' })).resolves.toBe('0 1 * * *');
    expect(readFile).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
  });
});

describe('toUtcCronExpression', () => {
  it('converts Asia/Shanghai local time to UTC cron expression', () => {
    expect(toUtcCronExpression('09:00', 'Asia/Shanghai')).toBe('0 1 * * *');
    expect(toUtcCronExpression('18:30', 'Asia/Shanghai')).toBe('30 10 * * *');
  });

  it('keeps UTC time unchanged when timezone is UTC', () => {
    expect(toUtcCronExpression('09:15', 'UTC')).toBe('15 9 * * *');
  });

  it('falls back to Asia/Shanghai offset for unknown timezone previews', () => {
    expect(toUtcCronExpression('09:00', 'Europe/Berlin')).toBe('0 1 * * *');
  });

  it('falls back to default expression for invalid time', () => {
    expect(toUtcCronExpression('bad', 'Asia/Shanghai')).toBe('0 1 * * *');
  });
});
