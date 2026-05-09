import { describe, expect, it } from 'vitest';
import { scoreOpportunity } from '../src/scoring/scoreOpportunity';
import { selectDailySet } from '../src/scoring/selectDailySet';
import type { OpportunitySignal } from '../src/types';

const nicheSignal: OpportunitySignal = {
  id: 'niche-local',
  source: 'rss',
  title: 'Telegram CRM for a local bakery chain in Chengdu',
  summary: 'A small business tool for neighborhood shops that want simple order capture and repeat customer follow-up.',
  url: 'https://example.com/niche-local',
  canonicalUrl: 'https://example.com/niche-local',
  publishedAt: '2026-05-07T00:00:00.000Z',
  tags: ['local', 'small-business', 'china'],
  rawScore: 42,
};

const crowdedGenericSignal: OpportunitySignal = {
  id: 'generic-crowded',
  source: 'hackernews',
  title: 'New AI SaaS launch',
  summary: 'A generic AI platform for everyone in a competitive market.',
  url: 'https://example.com/generic-crowded',
  canonicalUrl: 'https://example.com/generic-crowded',
  publishedAt: '2026-05-07T00:00:00.000Z',
  tags: ['ai', 'saas', 'startup'],
  rawScore: 90,
};

describe('scoreOpportunity', () => {
  it('ranks niche localized opportunities above crowded generic ones', () => {
    const nicheScore = scoreOpportunity(nicheSignal);
    const crowdedScore = scoreOpportunity(crowdedGenericSignal);

    expect(nicheScore.total).toBeGreaterThan(crowdedScore.total);
  });

  it('treats local tags case-insensitively', () => {
    const uppercaseLocalScore = scoreOpportunity({
      ...nicheSignal,
      id: 'uppercase-local',
      tags: ['LOCAL', 'small-business', 'china'],
    });

    expect(uppercaseLocalScore.localization).toBe(scoreOpportunity(nicheSignal).localization);
  });
});

describe('selectDailySet', () => {
  it('returns the top 3 as selected and the rest as pool', () => {
    const result = selectDailySet([
      crowdedGenericSignal,
      nicheSignal,
      {
        ...nicheSignal,
        id: 'selected-2',
        canonicalUrl: 'https://example.com/selected-2',
        url: 'https://example.com/selected-2',
        rawScore: 30,
      },
      {
        ...nicheSignal,
        id: 'selected-3',
        canonicalUrl: 'https://example.com/selected-3',
        url: 'https://example.com/selected-3',
        rawScore: 28,
      },
      {
        ...crowdedGenericSignal,
        id: 'pool-1',
        canonicalUrl: 'https://example.com/pool-1',
        url: 'https://example.com/pool-1',
        rawScore: 20,
      },
    ]);

    expect(result.selected).toHaveLength(3);
    expect(result.pool).toHaveLength(2);
    expect(result.selected.map((item) => item.id)).toEqual(['niche-local', 'selected-2', 'selected-3']);
    expect(result.pool.map((item) => item.id)).toEqual(['generic-crowded', 'pool-1']);
    expect(result.selected[2].score.total).toBeGreaterThanOrEqual(result.pool[0].score.total);
  });

  it('keeps all items selected when there are exactly 3 signals', () => {
    const result = selectDailySet([
      crowdedGenericSignal,
      nicheSignal,
      {
        ...nicheSignal,
        id: 'selected-2',
        canonicalUrl: 'https://example.com/selected-2',
        url: 'https://example.com/selected-2',
        rawScore: 30,
      },
    ]);

    expect(result.selected).toHaveLength(3);
    expect(result.pool).toEqual([]);
  });

  it('returns all signals in selected when there are fewer than 3', () => {
    expect(selectDailySet([])).toEqual({ selected: [], pool: [] });

    const result = selectDailySet([crowdedGenericSignal, nicheSignal]);
    expect(result.selected).toHaveLength(2);
    expect(result.pool).toEqual([]);
  });
});



