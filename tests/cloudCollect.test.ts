import { describe, expect, it, vi } from 'vitest';
import { collectCandidatesForRun } from '../src/cloud/services/collectCandidatesForRun';
import type { OpportunitySignal } from '../src/types';

vi.mock('../src/cloud/localizeSignalsForDashboard', () => ({
  localizeSignalsForDashboard: vi.fn(async (signals: OpportunitySignal[]) =>
    signals.map((signal) => ({
      ...signal,
      title: '中文标题',
      summary: '中文摘要',
    })),
  ),
}));

describe('collectCandidatesForRun', () => {
  it('normalizes signals, ranks candidates, and persists them under the run', async () => {
    const fetchSignals = vi.fn<() => Promise<OpportunitySignal[]>>().mockResolvedValue([
      {
        id: 'signal-1',
        source: 'github',
        title: 'Signal One',
        summary: 'summary',
        canonicalUrl: 'https://example.com/1',
        url: 'https://example.com/1',
        publishedAt: '2026-05-08T00:00:00.000Z',
        tags: ['ops'],
        rawScore: 40,
      },
    ]);
    const createMany = vi.fn().mockResolvedValue(undefined);

    const result = await collectCandidatesForRun({
      runId: 'run-1',
      fetchSignals,
      createMany,
    });

    expect(result.poolCount).toBe(1);
    expect(createMany).toHaveBeenCalledWith(
      'run-1',
      expect.arrayContaining([expect.objectContaining({ signalId: 'signal-1', title: '中文标题', summary: '中文摘要', rank: 1 })]),
    );
  });
});
