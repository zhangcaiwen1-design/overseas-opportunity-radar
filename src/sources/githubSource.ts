import type { OpportunitySignal, SourceAdapter } from '../types';

const DEFAULT_GITHUB_SEARCH_URLS = [
  'https://api.github.com/search/repositories?q=(ai%20OR%20automation%20OR%20workflow)%20(saas%20OR%20shop%20OR%20retail)&sort=updated&order=desc&per_page=10',
];

type FetchLike = typeof fetch;

type GithubSearchResult = {
  items?: GithubRepository[];
};

type GithubRepository = {
  full_name?: string;
  description?: string | null;
  html_url?: string;
  homepage?: string | null;
  updated_at?: string;
  stargazers_count?: number;
  topics?: string[];
};

type GithubReadmeResult = {
  content?: string;
  encoding?: string;
};

function extractHomepageSummary(content: string) {
  return content
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<img[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

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

function buildTags(topics?: string[]) {
  return Array.from(new Set(['github', ...(topics ?? []).map((item) => item.trim().toLowerCase()).filter(Boolean)]));
}

function extractReadmeSummary(content: string) {
  return content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<img[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^#+\s+/gm, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]+\]\([^)]*\)/g, '$1')
    .split(/\n\s*\n/)
    .map((block) => block.replace(/\s+/g, ' ').trim())
    .find((block) => block.length >= 40 && /[a-z]/i.test(block)) ?? '';
}

async function loadReadmeSummary(fetcher: FetchLike, repoFullName: string) {
  try {
    const response = await fetcher(`https://api.github.com/repos/${repoFullName}/readme`, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'overseas-opportunity-radar',
      },
    });

    if (!response.ok) {
      return '';
    }

    const payload = (await response.json()) as GithubReadmeResult;
    if (payload.encoding !== 'base64' || typeof payload.content !== 'string') {
      return '';
    }

    return extractReadmeSummary(Buffer.from(payload.content, 'base64').toString('utf8'));
  } catch {
    return '';
  }
}

async function loadHomepageSummary(fetcher: FetchLike, homepageUrl?: string | null) {
  if (!homepageUrl?.trim()) {
    return '';
  }

  try {
    const response = await fetcher(homepageUrl, {
      headers: {
        'User-Agent': 'overseas-opportunity-radar',
      },
    });

    if (!response.ok) {
      return '';
    }

    return extractHomepageSummary(await response.text());
  } catch {
    return '';
  }
}

function buildSummary(repo: GithubRepository, readmeSummary: string, homepageSummary: string, fallbackTitle: string) {
  const description = repo.description?.trim() || '';
  const parts = [description, readmeSummary, homepageSummary]
    .filter(Boolean)
    .filter((part, index, array) => array.findIndex((entry) => entry.toLowerCase() === part.toLowerCase()) === index);
  const baseSummary = parts.join(' ') || fallbackTitle;

  const businessProfile = buildBusinessProfile(repo, baseSummary);
  return businessProfile ? `${baseSummary} 商业画像：${businessProfile}` : baseSummary;
}

function buildBusinessProfile(repo: GithubRepository, summary: string) {
  const text = `${repo.full_name ?? ''} ${repo.description ?? ''} ${summary} ${(repo.topics ?? []).join(' ')}`.toLowerCase();
  const audience =
    text.includes('shop') || text.includes('retail')
      ? '目标用户：门店/零售商家'
      : text.includes('developer') || text.includes('github') || text.includes('mcp')
        ? '目标用户：开发者/技术团队'
        : text.includes('team') || text.includes('workflow')
          ? '目标用户：运营或协作团队'
          : '目标用户：待进一步确认';

  const monetization =
    text.includes('saas') || text.includes('subscription') || text.includes('platform')
      ? '变现线索：更像订阅制 SaaS'
      : text.includes('automation') || text.includes('workflow') || text.includes('service')
        ? '变现线索：可走项目制或服务费'
        : '变现线索：待进一步确认';

  return `${audience}；${monetization}`;
}

function isLikelyCommercialOpportunity(repo: GithubRepository, summary: string) {
  const text = [repo.full_name, repo.description, summary, ...(repo.topics ?? [])].join(' ').toLowerCase();
  const blockedTerms = ['workshop', 'tutorial', 'course', 'training', 'portfolio', 'awesome-', 'boilerplate'];

  return !blockedTerms.some((term) => text.includes(term));
}

async function toSignal(fetcher: FetchLike, repo: GithubRepository): Promise<OpportunitySignal | null> {
  const title = repo.full_name?.trim();
  const url = repo.homepage?.trim() || repo.html_url?.trim();
  if (!title || !url) {
    return null;
  }

  const readmeSummary = await loadReadmeSummary(fetcher, title);
  const homepageSummary = await loadHomepageSummary(fetcher, repo.homepage);
  const summary = buildSummary(repo, readmeSummary, homepageSummary, title);
  if (!isLikelyCommercialOpportunity(repo, summary)) {
    return null;
  }

  return {
    id: `github-${title.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase()}`,
    source: 'github',
    title,
    summary,
    url,
    canonicalUrl: canonicalizeUrl(url),
    publishedAt: normalizePublishedAt(repo.updated_at),
    tags: buildTags(repo.topics),
    rawScore: repo.stargazers_count ?? 0,
  };
}

export function createGithubSource(
  fetcher: FetchLike = fetch,
  searchUrls: string[] = DEFAULT_GITHUB_SEARCH_URLS,
): SourceAdapter {
  return {
    async fetchSignals() {
      const signals: OpportunitySignal[] = [];

      for (const searchUrl of searchUrls) {
        let response: Response;

        try {
          response = await fetcher(searchUrl, {
            headers: {
              Accept: 'application/vnd.github+json',
              'User-Agent': 'overseas-opportunity-radar',
            },
          });
        } catch {
          continue;
        }

        if (!response.ok) {
          continue;
        }

        const payload = (await response.json()) as GithubSearchResult;
        const items = Array.isArray(payload.items) ? payload.items : [];

        for (const repo of items) {
          const signal = await toSignal(fetcher, repo);
          if (signal) {
            signals.push(signal);
          }
        }
      }

      return signals;
    },
  };
}
