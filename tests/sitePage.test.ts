import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const loadSiteContentIndex = vi.fn();

vi.mock('../src/site/loadSiteContentIndex', () => ({
  loadSiteContentIndex,
}));

describe('SitePage', () => {
  it('renders published opportunity cards and lightweight CTA buttons', async () => {
    loadSiteContentIndex.mockResolvedValue({
      generatedAt: '2026-05-09T03:00:00.000Z',
      dateKey: '',
      items: [
        {
          id: 'selected-1',
          slug: 'alpha',
          title: 'Alpha',
          summary: 'Alpha summary',
          coverImageUrl: 'https://cdn.example.com/alpha.png',
          articleUrl: '/site/alpha',
          markdownUrl: 'https://cdn.example.com/alpha.md',
          canonicalSourceUrl: 'https://example.com/alpha',
          publishedAt: '2026-05-09T03:00:00.000Z',
          bodyHtmlStoragePath: 'runs/2026-05-09/selected/alpha.html',
        },
      ],
    });

    const { default: SitePage } = await import('../app/site/page');
    const html = renderToStaticMarkup(await SitePage());

    expect(html).toContain('海外商业机会内参');
    expect(html).toContain('Commercial Intelligence Brief');
    expect(html).toContain('只看能落地的机会');
    expect(html).toContain('本期精选机会');
    expect(html).toContain('这份内参怎么产出');
    expect(html).toContain('想要更贴近你业务的机会雷达');
    expect(html).toContain('Alpha');
    expect(html).toContain('Alpha summary');
    expect(html).toContain('/site/alpha');
    expect(html).toContain('https://cdn.example.com/alpha.png');
    expect(html).toContain('订阅');
    expect(html).toContain('咨询');
    expect(html).toContain('联系方式（微信 / 邮箱）');
    expect(html).toContain('补充说明（选填）');
    expect(html).toContain('运营入口');
    expect(html).toContain('https://admin-radar.yifan1.com');
    expect(html).toContain('进入后台采集台');
  });

  it('renders no cards when there is no published site variant', async () => {
    loadSiteContentIndex.mockResolvedValue({
      generatedAt: '',
      dateKey: '',
      items: [],
    });

    const { default: SitePage } = await import('../app/site/page');
    const html = renderToStaticMarkup(await SitePage());

    expect(html).toContain('海外商业机会内参');
    expect(html).toContain('新一期内参正在生成');
    expect(html).not.toContain('site-card');
    expect(html).not.toContain('/site/');
  });
});
