import { scoreOpportunity } from '../../scoring/scoreOpportunity';
import type { OpportunitySignal } from '../../types';
import type { CloudCandidate, PushChannel } from '../types';

const DEFAULT_CHANNELS: PushChannel[] = ['feishu', 'wecom', 'wxpusher'];

export interface CandidatePushDecision {
  candidateId: string;
  action: 'push' | 'hold';
  scoreLabel: 'high' | 'medium' | 'low';
  reasons: string[];
  suggestedChannels: PushChannel[];
}

export interface RunPushDecision {
  runId: string;
  shouldPushToday: boolean;
  recommendedCandidateIds: string[];
  recommendedChannels: PushChannel[];
  reasonSummary: string;
  candidateDecisions: CandidatePushDecision[];
  riskFlags: string[];
}

// 这是运行级规则建议产物，用于后台展示与人工判断，不直接作为最终推送执行输入。
export function buildRunPushDecision(input: { runId: string; candidates: CloudCandidate[] }): RunPushDecision {
  const scoredCandidates = input.candidates
    .map((candidate) => {
      const score = scoreOpportunity(toOpportunitySignal(candidate));
      const decisionScore = score.total + getRankBoost(candidate.rank) + getSelectionBoost(candidate.selectionState);
      const scoreLabel = toScoreLabel(decisionScore);
      const action: CandidatePushDecision['action'] = scoreLabel === 'low' ? 'hold' : 'push';

      return {
        candidate,
        score,
        decisionScore,
        scoreLabel,
        action,
      };
    })
    .sort(
      (a, b) =>
        b.decisionScore - a.decisionScore || a.candidate.rank - b.candidate.rank || a.candidate.id.localeCompare(b.candidate.id),
    );

  const candidateDecisions: CandidatePushDecision[] = scoredCandidates.map(({ candidate, score, scoreLabel, action }) => ({
    candidateId: candidate.id,
    action,
    scoreLabel,
    reasons: buildReasons(score),
    suggestedChannels: action === 'push' ? DEFAULT_CHANNELS : [],
  }));

  const recommendedCandidates = scoredCandidates.filter((item) => item.action === 'push').slice(0, 3);
  const shouldPushToday = recommendedCandidates.length > 0;
  const recommendedCandidateIds = recommendedCandidates.map((item) => item.candidate.id);
  const riskFlags = buildRiskFlags(scoredCandidates.map((item) => item.score.total), shouldPushToday);

  return {
    runId: input.runId,
    shouldPushToday,
    recommendedCandidateIds,
    recommendedChannels: shouldPushToday ? DEFAULT_CHANNELS : [],
    reasonSummary: buildReasonSummary(recommendedCandidateIds, scoredCandidates[0]?.score.total ?? 0, shouldPushToday),
    candidateDecisions,
    riskFlags,
  };
}

function toOpportunitySignal(candidate: CloudCandidate): OpportunitySignal {
  return {
    id: candidate.id,
    title: candidate.title,
    summary: candidate.summary,
    canonicalUrl: candidate.canonicalUrl,
    url: candidate.canonicalUrl,
    source: candidate.source as OpportunitySignal['source'],
    tags: candidate.tags,
    rawScore: candidate.rank,
    publishedAt: new Date().toISOString(),
  };
}

function toScoreLabel(total: number): CandidatePushDecision['scoreLabel'] {
  if (total >= 23) {
    return 'high';
  }

  if (total >= 16) {
    return 'medium';
  }

  return 'low';
}

function buildReasons(score: ReturnType<typeof scoreOpportunity>) {
  const reasons: string[] = [];

  if (score.localization >= 8) {
    reasons.push('本地化适配信号较强');
  }

  if (score.monetization >= 7) {
    reasons.push('变现路径相对清晰');
  }

  if (score.buildability >= 7) {
    reasons.push('实现门槛较低');
  }

  if (score.contentability >= 7) {
    reasons.push('适合内容传播');
  }

  if (score.competition >= 8) {
    reasons.push('竞争强度偏高');
  }

  if (reasons.length === 0) {
    reasons.push(`综合得分 ${score.total}，暂不具备明显优势`);
  }

  return reasons;
}

function getRankBoost(rank: number) {
  if (rank <= 1) {
    return 10;
  }

  if (rank <= 2) {
    return 7;
  }

  if (rank <= 3) {
    return 4;
  }

  return 0;
}

function getSelectionBoost(selectionState: CloudCandidate['selectionState']) {
  return selectionState === 'selected' ? 2 : 0;
}

function buildRiskFlags(totals: number[], shouldPushToday: boolean) {
  if (totals.length === 0) {
    return ['no_candidates'];
  }

  if (!shouldPushToday) {
    return ['all_candidates_low_score'];
  }

  return [];
}

function buildReasonSummary(recommendedCandidateIds: string[], highestScore: number, shouldPushToday: boolean) {
  if (!shouldPushToday && recommendedCandidateIds.length === 0 && highestScore === 0) {
    return '不建议推送：今日没有可评估的候选机会。';
  }

  if (!shouldPushToday) {
    return `不建议推送：候选机会整体得分偏低，当前最高分为 ${highestScore}。`;
  }

  return `建议推送 ${recommendedCandidateIds.join('、')}，这些候选在规则评分下更适合今日分发。`;
}
