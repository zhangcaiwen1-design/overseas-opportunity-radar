import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadSiteArticleBySlug = vi.fn();
const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});

vi.mock('../src/site/loadSiteArticleBySlug', () => ({
  loadSiteArticleBySlug,
}));

vi.mock('next/navigation', () => ({
  notFound,
}));

describe('SiteArticlePage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    notFound.mockImplementation(() => {
      throw new Error('NEXT_NOT_FOUND');
    });
  });

  it('renders article body, links, and lightweight CTA buttons for a published slug', async () => {
    loadSiteArticleBySlug.mockResolvedValue({
      slug: 'alpha',
      title: 'Alpha',
      bodyHtml: '<p>Alpha body</p>',
      coverImageUrl: 'https://cdn.example.com/alpha.png',
      markdownUrl: 'https://cdn.example.com/alpha.md',
      canonicalSourceUrl: 'https://example.com/alpha',
      publishedAt: '2026-05-09T03:00:00.000Z',
    });

    const { default: SiteArticlePage } = await import('../app/site/[slug]/page');
    const html = renderToStaticMarkup(await SiteArticlePage({ params: Promise.resolve({ slug: 'alpha' }) }));

    expect(html).toContain('Alpha');
    expect(html).toContain('Alpha body');
    expect(html).toContain('https://example.com/alpha');
    expect(html).toContain('https://cdn.example.com/alpha.md');
    expect(html).toContain('https://cdn.example.com/alpha.png');
    expect(html).toContain('订阅');
    expect(html).toContain('咨询');
    expect(html).toContain('联系方式（微信 / 邮箱）');
    expect(html).toContain('补充说明（选填）');
  });

  it('calls notFound when the slug has no published site variant', async () => {
    loadSiteArticleBySlug.mockResolvedValue(null);
    const { default: SiteArticlePage } = await import('../app/site/[slug]/page');

    await expect(SiteArticlePage({ params: Promise.resolve({ slug: 'missing' }) })).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalledTimes(1);
  });
});
