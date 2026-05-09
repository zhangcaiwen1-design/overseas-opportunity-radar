import { describe, expect, it, vi } from 'vitest';
import { normalizeSignals } from '../src/pipeline/normalizeSignals';
import { createGithubSource } from '../src/sources/githubSource';
import { createHackerNewsSource } from '../src/sources/hackerNewsSource';
import { createRedditSource } from '../src/sources/redditSource';
import { createRssSource } from '../src/sources/rssSource';
import type { OpportunitySignal } from '../src/types';

describe('normalizeSignals', () => {
  it('deduplicates by canonicalUrl and keeps the higher rawScore', () => {
    const signals: OpportunitySignal[] = [
      {
        id: 'low-score',
        source: 'github',
        title: 'Low score duplicate',
        summary: 'first version',
        url: 'https://github.com/example/repo/issues/1?utm=foo',
        canonicalUrl: 'https://github.com/example/repo/issues/1',
        publishedAt: '2026-05-01T10:00:00.000Z',
        tags: ['github'],
        rawScore: 12,
      },
      {
        id: 'high-score',
        source: 'github',
        title: 'High score duplicate',
        summary: 'better version',
        url: 'https://github.com/example/repo/issues/1',
        canonicalUrl: 'https://github.com/example/repo/issues/1',
        publishedAt: '2026-04-30T10:00:00.000Z',
        tags: ['github', 'duplicate'],
        rawScore: 98,
      },
    ];

    const normalized = normalizeSignals(signals);

    expect(normalized).toHaveLength(1);
    expect(normalized[0].id).toBe('high-score');
    expect(normalized[0].rawScore).toBe(98);
  });

  it('sorts newest signals first', () => {
    const signals: OpportunitySignal[] = [
      {
        id: 'older',
        source: 'reddit',
        title: 'Older post',
        summary: 'older',
        url: 'https://reddit.com/r/test/comments/1',
        canonicalUrl: 'https://reddit.com/r/test/comments/1',
        publishedAt: '2026-04-01T00:00:00.000Z',
        tags: ['reddit'],
        rawScore: 1,
      },
      {
        id: 'newer',
        source: 'reddit',
        title: 'Newer post',
        summary: 'newer',
        url: 'https://reddit.com/r/test/comments/2',
        canonicalUrl: 'https://reddit.com/r/test/comments/2',
        publishedAt: '2026-05-01T00:00:00.000Z',
        tags: ['reddit'],
        rawScore: 2,
      },
    ];

    const normalized = normalizeSignals(signals);

    expect(normalized.map((signal) => signal.id)).toEqual(['newer', 'older']);
  });
});

describe('createGithubSource', () => {
  it('maps GitHub repository results into normalized opportunity signals', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              full_name: 'example/ai-storefront',
              description: 'AI storefront workflow for neighborhood shops',
              html_url: 'https://github.com/example/ai-storefront',
              homepage: 'https://example.com/product?utm=github',
              updated_at: '2026-05-07T09:00:00.000Z',
              stargazers_count: 87,
              topics: ['AI', 'SaaS', 'Retail'],
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: Buffer.from('# AI Storefront\n\nBy me and AI <div align="center"><img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/demo" /></div>\n\nHelps neighborhood shops capture leads, answer customer questions, and turn chats into paid orders.').toString('base64'),
          encoding: 'base64',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => '<html><body><h1>AI storefront for independent retailers</h1><p>Subscription software for neighborhood merchants to collect leads, answer FAQs, and turn chat into paid orders.</p></body></html>',
      });

    const source = createGithubSource(fetcher as never);
    const signals = await source.fetchSignals();

    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({
      id: 'github-example-ai-storefront',
      source: 'github',
      title: 'example/ai-storefront',
      canonicalUrl: 'https://example.com/product',
      publishedAt: '2026-05-07T09:00:00.000Z',
      rawScore: 87,
    });
    expect(signals[0].summary).toContain('neighborhood shops');
    expect(signals[0].summary).toContain('capture leads');
    expect(signals[0].summary).toContain('independent retailers');
    expect(signals[0].summary).toContain('Subscription software');
    expect(signals[0].summary).toContain('商业画像：');
    expect(signals[0].summary).toContain('目标用户');
    expect(signals[0].summary).toContain('变现线索');
    expect(signals[0].tags).toEqual(['github', 'ai', 'saas', 'retail']);
  });

  it('skips invalid repos and tolerates fetch failures', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              full_name: '',
              html_url: 'https://github.com/example/invalid',
              updated_at: '2026-05-07T09:00:00.000Z',
              stargazers_count: 10,
            },
            {
              full_name: 'example/aws-workshop-assets',
              description: 'Official workshop repository for cloud training attendees',
              html_url: 'https://github.com/example/aws-workshop-assets',
              updated_at: '2026-05-07T09:00:00.000Z',
              stargazers_count: 30,
              topics: ['workshop', 'training'],
            },
            {
              full_name: 'example/wechat-order-bot',
              description: null,
              html_url: 'https://github.com/example/wechat-order-bot?tab=readme',
              updated_at: 'not-a-date',
              stargazers_count: 13,
              topics: ['WeChat', 'Automation'],
            },
          ],
        }),
      })
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: Buffer.from('Simple workflow bot for merchants to capture orders from WeChat chats.').toString('base64'),
          encoding: 'base64',
        }),
      });

    const source = createGithubSource(fetcher as never, [
      'https://api.github.com/search/repositories?q=broken',
      'https://api.github.com/search/repositories?q=wechat',
    ]);
    const signals = await source.fetchSignals();

    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({
      title: 'example/wechat-order-bot',
      canonicalUrl: 'https://github.com/example/wechat-order-bot',
      publishedAt: '1970-01-01T00:00:00.000Z',
      rawScore: 13,
    });
    expect(signals[0].summary).toContain('merchants');
    expect(signals[0].tags).toEqual(['github', 'wechat', 'automation']);
  });
});

describe('createHackerNewsSource', () => {
  it('maps Algolia HN hits into normalized opportunity signals', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        hits: [
          {
            objectID: '123',
            title: 'AI order workflow for bakery owners',
            story_text: 'A lightweight workflow small bakery teams can localize to WeChat ordering.',
            url: 'https://example.com/hn-opportunity?ref=hn',
            created_at: '2026-05-07T08:30:00.000Z',
            points: 42,
          },
        ],
      }),
    });

    const source = createHackerNewsSource(fetcher as never);
    const signals = await source.fetchSignals();

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({
      id: 'hackernews-123',
      source: 'hackernews',
      title: 'AI order workflow for bakery owners',
      canonicalUrl: 'https://example.com/hn-opportunity',
      publishedAt: '2026-05-07T08:30:00.000Z',
      rawScore: 42,
    });
    expect(signals[0].tags).toEqual(['hackernews']);
    expect(signals[0].summary).toContain('localize to WeChat');
  });

  it('skips invalid hits and tolerates failed fetches', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          hits: [
            {
              objectID: 'missing-title',
              url: 'https://example.com/missing-title',
              created_at: '2026-05-07T08:30:00.000Z',
              points: 5,
            },
            {
              objectID: '456',
              story_title: 'WhatsApp CRM for local service teams',
              comment_text: 'Could be adapted for Chinese owner-operators.',
              story_url: 'https://example.com/service-crm?utm=hn',
              created_at: 'not-a-date',
              points: 19,
            },
          ],
        }),
      });

    const source = createHackerNewsSource(fetcher as never, [
      'https://hn.algolia.com/api/v1/search?query=broken',
      'https://hn.algolia.com/api/v1/search?query=crm',
    ]);
    const signals = await source.fetchSignals();

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({
      id: 'hackernews-456',
      title: 'WhatsApp CRM for local service teams',
      canonicalUrl: 'https://example.com/service-crm',
      publishedAt: '1970-01-01T00:00:00.000Z',
      rawScore: 19,
    });
  });
});

describe('createRedditSource', () => {
  it('maps Reddit listing posts into normalized opportunity signals', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          children: [
            {
              data: {
                id: 'abc123',
                title: 'Shop owners want a simpler booking workflow',
                selftext: 'Could be localized into a WeChat mini workflow for service teams.',
                permalink: '/r/Entrepreneur/comments/abc123/shop_owners_booking_workflow/',
                created_utc: 1778140800,
                score: 55,
                subreddit: 'Entrepreneur',
              },
            },
          ],
        },
      }),
    });

    const source = createRedditSource(fetcher as never, ['https://www.reddit.com/r/Entrepreneur/hot.json?limit=10']);
    const signals = await source.fetchSignals();

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({
      id: 'reddit-abc123',
      source: 'reddit',
      title: 'Shop owners want a simpler booking workflow',
      canonicalUrl: 'https://www.reddit.com/r/Entrepreneur/comments/abc123/shop_owners_booking_workflow/',
      publishedAt: '2026-05-07T08:00:00.000Z',
      rawScore: 55,
    });
    expect(signals[0].tags).toEqual(['reddit', 'entrepreneur']);
    expect(signals[0].summary).toContain('WeChat mini workflow');
  });

  it('skips invalid posts and tolerates fetch failures', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            children: [
              {
                data: {
                  id: 'missing-title',
                  permalink: '/r/startups/comments/missing_title/',
                  created_utc: 1778140800,
                  score: 10,
                  subreddit: 'startups',
                },
              },
              {
                data: {
                  id: 'xyz789',
                  title: 'CRM scripts for home service operators',
                  selftext: '',
                  url: 'https://example.com/reddit-crm?utm=reddit',
                  created_utc: NaN,
                  score: 21,
                  subreddit: 'smallbusiness',
                },
              },
            ],
          },
        }),
      });

    const source = createRedditSource(fetcher as never, [
      'https://www.reddit.com/r/broken/hot.json?limit=10',
      'https://www.reddit.com/r/smallbusiness/hot.json?limit=10',
    ]);
    const signals = await source.fetchSignals();

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({
      id: 'reddit-xyz789',
      canonicalUrl: 'https://example.com/reddit-crm',
      publishedAt: '1970-01-01T00:00:00.000Z',
      rawScore: 21,
    });
    expect(signals[0].tags).toEqual(['reddit', 'smallbusiness']);
  });
});

describe('createRssSource', () => {
  it('parses RSS feed items into normalized opportunity signals', async () => {
    const parser = {
      parseURL: vi.fn().mockResolvedValue({
        title: 'Product Hunt',
        items: [
          {
            title: 'AI storefront assistant',
            link: 'https://example.com/post?ref=rss',
            contentSnippet: 'A storefront workflow for small shops.',
            isoDate: '2026-05-07T08:00:00.000Z',
            categories: ['AI', 'SaaS'],
          },
        ],
      }),
    };

    const source = createRssSource(['https://example.com/feed.xml'], parser as never);
    const signals = await source.fetchSignals();

    expect(parser.parseURL).toHaveBeenCalledWith('https://example.com/feed.xml');
    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({
      source: 'rss',
      title: 'AI storefront assistant',
      canonicalUrl: 'https://example.com/post',
      publishedAt: '2026-05-07T08:00:00.000Z',
    });
    expect(signals[0].tags).toContain('rss');
    expect(signals[0].tags).toContain('product');
    expect(signals[0].tags).toContain('hunt');
    expect(signals[0].tags).toContain('ai');
  });

  it('skips invalid items and tolerates feed failures', async () => {
    const parser = {
      parseURL: vi.fn(async (feedUrl: string) => {
        if (feedUrl.includes('broken')) {
          throw new Error('network');
        }

        return {
          title: 'TechCrunch',
          items: [
            { title: '', link: 'https://example.com/missing-title' },
            { title: 'Missing link' },
            {
              title: 'Valid item',
              link: 'https://example.com/valid?utm=1',
              contentSnippet: 'Valid summary',
              pubDate: 'Wed, 07 May 2026 08:00:00 GMT',
            },
          ],
        };
      }),
    };

    const source = createRssSource(
      ['https://broken.example/feed.xml', 'https://ok.example/feed.xml'],
      parser as never,
    );
    const signals = await source.fetchSignals();

    expect(parser.parseURL).toHaveBeenCalledTimes(2);
    expect(signals).toHaveLength(1);
    expect(signals[0].title).toBe('Valid item');
    expect(signals[0].canonicalUrl).toBe('https://example.com/valid');
  });
});
