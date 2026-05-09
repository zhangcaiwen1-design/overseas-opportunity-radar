import type { OpportunitySignal, SourceAdapter } from '../types';

const DEFAULT_HN_SEARCH_URLS = [
  'https://hn.algolia.com/api/v1/search_by_date?query=(ai%20OR%20automation%20OR%20workflow)%20(saas%20OR%20retail%20OR%20shop)&tags=story&hitsPerPage=10',
];

type FetchLike = typeof fetch;

type HackerNewsSearchResult = {
  hits?: HackerNewsHit[];
};

type HackerNewsHit = {
  objectID?: string;
  title?: string | null;
  story_title?: string | null;
  story_text?: string | null;
  comment_text?: string | null;
  url?: string | null;
  story_url?: string | null;
  created_at?: string;
  points?: number | null;
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

function normalizePublishedAt(value?: string) {
  if (!value) {
    return new Date(0).toISOString();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date(0).toISOString() : parsed.toISOString();
}

function toSignal(hit: HackerNewsHit): OpportunitySignal | null {
  const id = hit.objectID?.trim();
  const title = hit.title?.trim() || hit.story_title?.trim();
  const url = hit.url?.trim() || hit.story_url?.trim();
  if (!id || !title || !url) {
    return null;
  }

  return {
    id: `hackernews-${id}`,
    source: 'hackernews',
    title,
    summary: hit.story_text?.trim() || hit.comment_text?.trim() || title,
    url,
    canonicalUrl: canonicalizeUrl(url),
    publishedAt: normalizePublishedAt(hit.created_at),
    tags: ['hackernews'],
    rawScore: hit.points ?? 0,
  };
}

export function createHackerNewsSource(
  fetcher: FetchLike = fetch,
  searchUrls: string[] = DEFAULT_HN_SEARCH_URLS,
): SourceAdapter {
  return {
    async fetchSignals() {
      const signals: OpportunitySignal[] = [];

      for (const searchUrl of searchUrls) {
        let response: Response;

        try {
          response = await fetcher(searchUrl);
        } catch {
          continue;
        }

        if (!response.ok) {
          continue;
        }

        const payload = (await response.json()) as HackerNewsSearchResult;
        const hits = Array.isArray(payload.hits) ? payload.hits : [];

        hits.forEach((hit) => {
          const signal = toSignal(hit);
          if (signal) {
            signals.push(signal);
          }
        });
      }

      return signals;
    },
  };
}
