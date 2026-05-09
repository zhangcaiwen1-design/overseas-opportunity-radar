import type { OpportunitySignal, SourceAdapter } from '../types';

const DEFAULT_REDDIT_LISTING_URLS = [
  'https://www.reddit.com/r/Entrepreneur/hot.json?limit=10',
  'https://www.reddit.com/r/smallbusiness/hot.json?limit=10',
];

type FetchLike = typeof fetch;

type RedditListing = {
  data?: {
    children?: Array<{ data?: RedditPost }>;
  };
};

type RedditPost = {
  id?: string;
  title?: string;
  selftext?: string;
  permalink?: string;
  url?: string;
  created_utc?: number;
  score?: number;
  subreddit?: string;
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

function normalizePublishedAt(createdUtc?: number) {
  if (typeof createdUtc !== 'number' || Number.isNaN(createdUtc)) {
    return new Date(0).toISOString();
  }

  const parsed = new Date(createdUtc * 1000);
  return Number.isNaN(parsed.getTime()) ? new Date(0).toISOString() : parsed.toISOString();
}

function resolveUrl(post: RedditPost) {
  const permalink = post.permalink?.trim();
  if (permalink) {
    return `https://www.reddit.com${permalink}`;
  }

  return post.url?.trim() || '';
}

function toSignal(post: RedditPost): OpportunitySignal | null {
  const id = post.id?.trim();
  const title = post.title?.trim();
  const url = resolveUrl(post);
  if (!id || !title || !url) {
    return null;
  }

  return {
    id: `reddit-${id}`,
    source: 'reddit',
    title,
    summary: post.selftext?.trim() || title,
    url,
    canonicalUrl: canonicalizeUrl(url),
    publishedAt: normalizePublishedAt(post.created_utc),
    tags: ['reddit', post.subreddit?.trim().toLowerCase()].filter(Boolean) as string[],
    rawScore: post.score ?? 0,
  };
}

export function createRedditSource(
  fetcher: FetchLike = fetch,
  listingUrls: string[] = DEFAULT_REDDIT_LISTING_URLS,
): SourceAdapter {
  return {
    async fetchSignals() {
      const signals: OpportunitySignal[] = [];

      for (const listingUrl of listingUrls) {
        let response: Response;

        try {
          response = await fetcher(listingUrl, {
            headers: {
              'User-Agent': 'overseas-opportunity-radar',
            },
          });
        } catch {
          continue;
        }

        if (!response.ok) {
          continue;
        }

        const payload = (await response.json()) as RedditListing;
        const children = Array.isArray(payload.data?.children) ? payload.data?.children : [];

        children.forEach((entry) => {
          const signal = entry.data ? toSignal(entry.data) : null;
          if (signal) {
            signals.push(signal);
          }
        });
      }

      return signals;
    },
  };
}
