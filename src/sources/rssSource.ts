import Parser from 'rss-parser';
import type { OpportunitySignal, SourceAdapter } from '../types';

const DEFAULT_RSS_FEEDS = [
  'https://feeds.feedburner.com/TechCrunch/',
  'https://www.producthunt.com/feed',
];

type ParsedFeed = {
  title?: string;
  items?: Parser.Item[];
};

type FeedParser = {
  parseURL(feedUrl: string): Promise<ParsedFeed>;
};

function canonicalizeUrl(url: string) {
  try {
    const parsed = new URL(url);
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return url;
  }
}

function normalizePublishedAt(item: Parser.Item) {
  const candidate = item.isoDate ?? item.pubDate;
  if (!candidate) {
    return new Date(0).toISOString();
  }

  const parsed = new Date(candidate);
  return Number.isNaN(parsed.getTime()) ? new Date(0).toISOString() : parsed.toISOString();
}

function buildTags(feedTitle: string, categories?: string[]) {
  const baseTags = ['rss', ...feedTitle.toLowerCase().split(/\W+/).filter(Boolean)];
  return Array.from(new Set([...baseTags, ...(categories ?? []).map((item) => item.toLowerCase())]));
}

function toSignal(feedTitle: string, item: Parser.Item, index: number): OpportunitySignal | null {
  const title = item.title?.trim();
  const url = item.link?.trim();
  if (!title || !url) {
    return null;
  }

  const summary = item.contentSnippet?.trim() || item.content?.trim() || item.summary?.trim() || title;

  return {
    id: `rss-${feedTitle}-${index}`,
    source: 'rss',
    title,
    summary,
    url,
    canonicalUrl: canonicalizeUrl(url),
    publishedAt: normalizePublishedAt(item),
    tags: buildTags(feedTitle, item.categories),
    rawScore: Math.max(10, 60 - index * 5),
  };
}

export function createRssSource(
  feeds: string[] = DEFAULT_RSS_FEEDS,
  parser: FeedParser = new Parser({ timeout: 1500 }),
): SourceAdapter {
  return {
    async fetchSignals() {
      const signals: OpportunitySignal[] = [];

      for (const feedUrl of feeds) {
        let feed: ParsedFeed;

        try {
          feed = await parser.parseURL(feedUrl);
        } catch {
          continue;
        }

        const feedTitle = feed.title?.trim() || 'rss';
        const items = Array.isArray(feed.items) ? feed.items : [];

        items.forEach((item, index) => {
          const signal = toSignal(feedTitle, item, index);
          if (signal) {
            signals.push(signal);
          }
        });
      }

      return signals;
    },
  };
}
