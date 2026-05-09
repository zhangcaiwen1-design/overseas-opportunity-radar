import { describe, expect, it } from 'vitest';
import { buildRunPushDecision } from '../src/cloud/services/buildRunPushDecision';
import type { CloudCandidate } from '../src/cloud/types';

const strongCandidate: CloudCandidate = {
  id: 'candidate-strong',
  title: 'WeChat order workflow tool for Chengdu shops',
  source: 'rss',
  summary: 'A simple payment and CRM workflow template for local China merchants to capture repeat orders.',
  rank: 1,
  selectionState: 'selected',
  tags: ['local', 'china', 'wechat', 'workflow'],
  canonicalUrl: 'https://example.com/strong',
};

const mediumCandidate: CloudCandidate = {
  id: 'candidate-medium',
  title: 'Exporter CRM assistant with content templates',
  source: 'github',
  summary: 'A simple lead and order follow-up tool for small teams that want reusable content assets.',
  rank: 2,
  selectionState: 'pending',
  tags: ['crm', 'local', 'content'],
  canonicalUrl: 'https://example.com/medium',
};

const lowCandidate: CloudCandidate = {
  id: 'candidate-low',
  title: 'Generic AI SaaS for everyone',
  source: 'hackernews',
  summary: 'A crowded startup platform in a generic market.',
  rank: 3,
  selectionState: 'pending',
  tags: ['ai', 'saas', 'startup'],
  canonicalUrl: 'https://example.com/low',
};

describe('buildRunPushDecision', () => {
  it('builds a stable run-level push recommendation from current candidates', () => {
    const decision = buildRunPushDecision({
      runId: 'run-1',
      candidates: [lowCandidate, mediumCandidate, strongCandidate],
    });

    expect(decision.runId).toBe('run-1');
    expect(decision.shouldPushToday).toBe(true);
    expect(decision.recommendedCandidateIds).toEqual(['candidate-strong', 'candidate-medium']);
    expect(decision.recommendedChannels).toEqual(['feishu', 'wecom', 'wxpusher']);
    expect(decision.reasonSummary).toContain('candidate-strong');
    expect(decision.candidateDecisions).toMatchObject([
      {
        candidateId: 'candidate-strong',
        action: 'push',
        scoreLabel: 'high',
        suggestedChannels: ['feishu', 'wecom', 'wxpusher'],
      },
      {
        candidateId: 'candidate-medium',
        action: 'push',
        scoreLabel: 'high',
        suggestedChannels: ['feishu', 'wecom', 'wxpusher'],
      },
      {
        candidateId: 'candidate-low',
        action: 'hold',
        scoreLabel: 'low',
        suggestedChannels: [],
      },
    ]);
    expect(decision.candidateDecisions[0]?.reasons.length).toBeGreaterThan(0);
    expect(decision.riskFlags).toEqual([]);
  });

  it('suppresses push when all candidates are low confidence', () => {
    const decision = buildRunPushDecision({
      runId: 'run-2',
      candidates: [
        lowCandidate,
        {
          ...lowCandidate,
          id: 'candidate-low-2',
          canonicalUrl: 'https://example.com/low-2',
          title: 'Another generic AI startup',
          rank: 4,
        },
      ],
    });

    expect(decision.shouldPushToday).toBe(false);
    expect(decision.recommendedCandidateIds).toEqual([]);
    expect(decision.recommendedChannels).toEqual([]);
    expect(decision.reasonSummary).toContain('不建议推送');
    expect(decision.candidateDecisions).toEqual([
      expect.objectContaining({ candidateId: 'candidate-low', action: 'hold', scoreLabel: 'low' }),
      expect.objectContaining({ candidateId: 'candidate-low-2', action: 'hold', scoreLabel: 'low' }),
    ]);
    expect(decision.riskFlags).toContain('all_candidates_low_score');
  });

  it('marks empty candidate input as no_candidates and does not recommend push', () => {
    const decision = buildRunPushDecision({
      runId: 'run-empty',
      candidates: [],
    });

    expect(decision.runId).toBe('run-empty');
    expect(decision.shouldPushToday).toBe(false);
    expect(decision.recommendedCandidateIds).toEqual([]);
    expect(decision.recommendedChannels).toEqual([]);
    expect(decision.candidateDecisions).toEqual([]);
    expect(decision.riskFlags).toEqual(['no_candidates']);
    expect(decision.reasonSummary).toBe('不建议推送：今日没有可评估的候选机会。');
  });

  it('returns literal action values for candidate decisions', () => {
    const decision = buildRunPushDecision({
      runId: 'run-3',
      candidates: [strongCandidate, lowCandidate],
    });

    expect(decision.candidateDecisions.map((item) => item.action)).toEqual(['push', 'hold']);
  });
});
