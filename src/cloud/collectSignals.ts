import { createGithubSource, createHackerNewsSource, createRedditSource, createRssSource } from '../sources';
import type { OpportunitySignal } from '../types';

function isSourceEnabled(flagName: string) {
  return process.env[flagName] !== '0';
}

function resolveRssFeedsFromEnv() {
  if (!isSourceEnabled('RSS_SOURCE_ENABLED')) {
    return [];
  }

  const configuredFeeds = process.env.RSS_FEEDS?.split(',').map((item) => item.trim()).filter(Boolean);
  return configuredFeeds && configuredFeeds.length > 0 ? configuredFeeds : undefined;
}

export async function collectSignals(): Promise<OpportunitySignal[]> {
  const sources = [
    ...(isSourceEnabled('GITHUB_SOURCE_ENABLED') ? [createGithubSource()] : []),
    ...(isSourceEnabled('HACKERNEWS_SOURCE_ENABLED') ? [createHackerNewsSource()] : []),
    ...(isSourceEnabled('REDDIT_SOURCE_ENABLED') ? [createRedditSource()] : []),
    createRssSource(resolveRssFeedsFromEnv()),
  ];

  const results = await Promise.all(
    sources.map(async (source) => {
      try {
        return await source.fetchSignals();
      } catch {
        return [] as OpportunitySignal[];
      }
    }),
  );

  return results.flat();
}
