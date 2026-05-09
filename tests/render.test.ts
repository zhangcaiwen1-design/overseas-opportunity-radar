import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readStyleText } from '../src/render/readStyleText';
import { renderBriefCardHtml } from '../src/render/renderBriefCard';
import { renderHtmlScreenshot } from '../src/render/renderHtmlScreenshot';
import { renderMagazineArticleHtml } from '../src/render/renderMagazineArticle';
import type { SelectedWrittenOpportunity, WrittenOpportunity } from '../src/types';

const { screenshotMock, setContentMock, newPageMock, closeMock, launchMock } = vi.hoisted(() => ({
  screenshotMock: vi.fn(),
  setContentMock: vi.fn(),
  newPageMock: vi.fn(),
  closeMock: vi.fn(),
  launchMock: vi.fn(),
}));

vi.mock('playwright', () => ({
  chromium: {
    launch: launchMock,
  },
}));

const selectedArticle: SelectedWrittenOpportunity = {
  slug: 'telegram-crm-chengdu-bakery',
  title: '工具机会：Telegram CRM for a local bakery chain in Chengdu',
  sourceLabel: 'GitHub 项目',
  projectType: 'tool-enhancement',
  oneLiner: '一个给本地烘焙店使用的轻量客户跟进工具机会。',
  projectIntro: '它本质上是一个把重复客户跟进动作压缩得更顺手的小工具，而不是完整 ERP。',
  operationModel: ['先录入客户和订单线索。', '工具自动整理跟进动作。'],
  whyItMatters: ['这类需求已经在真实工具社区里反复出现。'],
  chinaAdaptation: ['优先接到微信和本地支付链路。'],
  monetizationExecution: ['先卖代搭建和轻量工具包。'],
  contentAngles: [{ channel: 'wechat-article', angle: '从烘焙店老板的复购动作切入。' }],
  validationSteps: [{ title: '先试跑', detail: '找 1 家门店先跑一周。' }],
};

const escapedSelectedArticle: SelectedWrittenOpportunity = {
  ...selectedArticle,
  title: '<script>alert(1)</script>',
  oneLiner: 'Signal with <b>HTML</b>',
  projectIntro: 'Use "quotes" and <tags>',
  validationSteps: [{ title: 'Owner', detail: "Owner's workflow" }],
};

const briefArticle: WrittenOpportunity = {
  slug: 'telegram-crm-chengdu-bakery',
  title: 'Telegram CRM for a local bakery chain in Chengdu',
  overseasSignal: 'Small Telegram-native service businesses need lighter CRM flows.',
  whyNow: 'Fast-growth overseas tools are showing demand for owner-operator automation.',
  localizationPath: 'Adapt the flows for WeChat and local payment habits.',
  monetizationPaths: ['Subscription', 'Setup fee'],
  validationPath: 'Interview 5 owners and test the landing page.',
  targetProfiles: ['Bakery operators'],
  douyinSummary: 'A quick walk-through of the owner workflow.',
};

const escapedBriefArticle: WrittenOpportunity = {
  ...briefArticle,
  title: '<script>alert(1)</script>',
  overseasSignal: 'Signal with <b>HTML</b>',
  localizationPath: 'Use "quotes" and <tags>',
  validationPath: "Owner's workflow",
};

beforeEach(() => {
  screenshotMock.mockReset();
  setContentMock.mockReset();
  newPageMock.mockReset();
  closeMock.mockReset();
  launchMock.mockReset();

  screenshotMock.mockResolvedValue(undefined);
  setContentMock.mockResolvedValue(undefined);
  newPageMock.mockResolvedValue({
    setContent: setContentMock,
    screenshot: screenshotMock,
  });
  closeMock.mockResolvedValue(undefined);
  launchMock.mockResolvedValue({
    newPage: newPageMock,
    close: closeMock,
  });
});

describe('renderMagazineArticleHtml', () => {
  it('includes project intro and monetization execution sections', () => {
    const html = renderMagazineArticleHtml(selectedArticle);

    expect(html).toContain('项目介绍');
    expect(html).toContain('变现实操');
    expect(html).toContain(selectedArticle.projectIntro);
    expect(html).toContain(selectedArticle.monetizationExecution[0]);
  });

  it('renders a hero cover section and evidence guide for selected articles', () => {
    const html = renderMagazineArticleHtml({
      ...selectedArticle,
      heroImage: {
        prompt: 'premium commercial magazine cover',
        imagePath: '../visuals/demo-hero.png',
        status: 'generated',
      },
      collageImages: [{ path: '../materials/demo.png', alt: 'demo material' }],
    });

    expect(html).toContain('article-cover');
    expect(html).toContain('article-hero-image');
    expect(html).toContain('证据导览');
    expect(html).toContain('../visuals/demo-hero.png');
  });

  it('omits the hero image block when no generated hero visual is available', () => {
    const html = renderMagazineArticleHtml({
      ...selectedArticle,
      heroImage: { prompt: 'x', status: 'failed' },
    });

    expect(html).not.toContain('<div class="article-hero-image">');
  });

  it('escapes user-provided content', () => {
    const html = renderMagazineArticleHtml(escapedSelectedArticle);

    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('Signal with &lt;b&gt;HTML&lt;/b&gt;');
    expect(html).toContain('Use &quot;quotes&quot; and &lt;tags&gt;');
    expect(html).toContain('Owner&#39;s workflow');
  });
});

describe('renderBriefCardHtml', () => {
  it('includes the brief sections and escapes content', () => {
    const html = renderBriefCardHtml(escapedBriefArticle);

    expect(html).toContain('Business brief');
    expect(html).toContain('Localization');
    expect(html).toContain('Validation');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('Signal with &lt;b&gt;HTML&lt;/b&gt;');
  });
});

describe('readStyleText', () => {
  it('reads a Next traced style asset from the build output path', () => {
    const stylePath = path.join(process.cwd(), '.next', 'static', 'media', 'test-style.css');
    mkdirSync(path.dirname(stylePath), { recursive: true });
    writeFileSync(stylePath, 'body{color:#123456;}', 'utf8');

    try {
      const style = readStyleText(new URL('/_next/static/media/test-style.css', 'file:///ignored'));
      expect(style).toBe('body{color:#123456;}');
    } finally {
      rmSync(stylePath, { force: true });
    }
  });

  it('falls back to the traced server chunk asset path for standalone builds', () => {
    const stylePath = path.join(process.cwd(), '.next', 'server', 'chunks', 'static', 'media', 'chunk-style.css');
    mkdirSync(path.dirname(stylePath), { recursive: true });
    writeFileSync(stylePath, 'body{color:#654321;}', 'utf8');

    try {
      const style = readStyleText(new URL('/_next/static/media/chunk-style.css', 'file:///ignored'));
      expect(style).toBe('body{color:#654321;}');
    } finally {
      rmSync(stylePath, { force: true });
    }
  });
});

describe('renderHtmlScreenshot', () => {
  it('returns the screenshot buffer using the requested viewport', async () => {
    const screenshotBuffer = Buffer.from('png-binary');
    screenshotMock.mockResolvedValueOnce(screenshotBuffer);

    await expect(renderHtmlScreenshot('<html><body>ok</body></html>', 1080, 1920)).resolves.toBe(screenshotBuffer);

    expect(launchMock).toHaveBeenCalledWith({ headless: true });
    expect(newPageMock).toHaveBeenCalledWith({ viewport: { width: 1080, height: 1920 } });
    expect(setContentMock).toHaveBeenCalledWith('<html><body>ok</body></html>', { waitUntil: 'load' });
    expect(screenshotMock).toHaveBeenCalledWith({ type: 'png', fullPage: false });
    expect(closeMock).toHaveBeenCalledTimes(1);
  });

  it('closes the browser when screenshot rendering fails', async () => {
    screenshotMock.mockRejectedValueOnce(new Error('boom'));

    await expect(renderHtmlScreenshot('<html></html>', 800, 600)).rejects.toThrow('boom');
    expect(closeMock).toHaveBeenCalledTimes(1);
  });
});
