import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { archiveRun } from '../src/archive/archiveRun';
import { pushToFeishu } from '../src/push/feishuPusher';
import { buildPushSummary, renderPushDigest } from '../src/push/renderPushDigest';
import { pushToWeCom } from '../src/push/wecomPusher';
import { pushToWxPusher } from '../src/push/wxpusherPusher';

const fetchMock = vi.fn();

let originalFetch: typeof globalThis.fetch | undefined;
let tempDir = '';

beforeEach(async () => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true });
  originalFetch = globalThis.fetch;
  globalThis.fetch = fetchMock as typeof globalThis.fetch;
  tempDir = await mkdtemp(path.join(os.tmpdir(), 'opportunity-radar-'));
});

afterEach(async () => {
  if (originalFetch) {
    globalThis.fetch = originalFetch;
  }

  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
  }
});

describe('buildPushSummary', () => {
  it('includes selected story count and pool count', () => {
    const summary = buildPushSummary({
      selectedCount: 5,
      poolCount: 12,
      leadTitle: '国外 OCR 工具，怎么国产化卖给批发行',
    });

    expect(summary).toContain('精选 5 条');
    expect(summary).toContain('机会池 12 条');
    expect(summary).toContain('国外 OCR 工具，怎么国产化卖给批发行');
  });

  it('renders a delivery-ready push digest with mobile-friendly sections and artifact paths', () => {
    const digest = renderPushDigest({
      dateKey: '2026-05-08',
      poolCount: 9,
      leadTitle: '工具机会：海外自动报价台',
      outputDir: 'output/2026-05-08',
      selected: [
        {
          article: {
            slug: 'quote-desk',
            title: '工具机会：海外自动报价台',
            sourceLabel: 'GitHub 项目',
            projectType: 'tool-enhancement',
            oneLiner: '这是一个给门店老板用的报价工具机会。',
            projectIntro: '项目介绍',
            operationModel: ['先录入'],
            whyItMatters: ['真实需求'],
            chinaAdaptation: ['先接微信表单'],
            monetizationExecution: ['先卖代搭建'],
            contentAngles: [{ channel: 'wechat-article', angle: '从门店成交切入。' }],
          },
          artifact: {
            slug: 'quote-desk',
            title: '工具机会：海外自动报价台',
            markdownPath: 'output/2026-05-08/selected/quote-desk.md',
            htmlPath: 'output/2026-05-08/selected/quote-desk.html',
            screenshotPath: 'output/2026-05-08/selected/quote-desk.png',
            materialPath: 'output/2026-05-08/materials/quote-desk.png',
          },
        },
      ],
    });

    expect(digest).toContain('今日海外商业机会雷达｜2026-05-08');
    expect(digest).toContain('精选 1 条｜机会池 9 条');
    expect(digest).toContain('今日头条：工具机会：海外自动报价台');
    expect(digest).toContain('【机会 1】工具机会：海外自动报价台');
    expect(digest).toContain('国产化落地：先接微信表单');
    expect(digest).toContain('变现实操：先卖代搭建');
    expect(digest).toContain('查看成稿：');
    expect(digest).toContain('- HTML：output/2026-05-08/selected/quote-desk.html');
    expect(digest).toContain('- 来源素材：output/2026-05-08/materials/quote-desk.png');
    expect(digest).toContain('本次输出目录：');
  });
});

describe('push adapters', () => {
  it('posts text payloads to Feishu, WeCom, and WxPusher', async () => {
    await pushToFeishu('https://example.com/feishu', '今日精选 3 条');
    await pushToWeCom('https://example.com/wecom', '今日精选 3 条');
    await pushToWxPusher('app-token', 'uid-1', '今日精选 3 条');

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://example.com/feishu',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          msg_type: 'text',
          content: { text: '今日精选 3 条' },
        }),
      },
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://example.com/wecom',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          msgtype: 'text',
          text: { content: '今日精选 3 条' },
        }),
      },
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'https://wxpusher.zjiecode.com/api/send/message',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appToken: 'app-token',
          content: '今日精选 3 条',
          uids: ['uid-1'],
          contentType: 1,
        }),
      },
    );
  });
});

describe('archiveRun', () => {
  it('writes each artifact into the dated output folder', async () => {
    const folder = await archiveRun(tempDir, '2026-05-07', {
      'summary.md': '# 今日精选',
      'pool.md': '机会池内容',
    });

    expect(folder).toBe(path.join(tempDir, '2026-05-07'));
    await expect(readFile(path.join(folder, 'summary.md'), 'utf8')).resolves.toBe('# 今日精选');
    await expect(readFile(path.join(folder, 'pool.md'), 'utf8')).resolves.toBe('机会池内容');
  });
});
