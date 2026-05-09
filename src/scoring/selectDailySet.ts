import { scoreOpportunity } from './scoreOpportunity';
import type { OpportunitySignal } from '../types';

export interface DailySelection {
  selected: Array<OpportunitySignal & { score: ReturnType<typeof scoreOpportunity> }>;
  pool: Array<OpportunitySignal & { score: ReturnType<typeof scoreOpportunity> }>;
}

export function selectDailySet(signals: OpportunitySignal[]): DailySelection {
  const scored = signals.map((signal) => ({
    ...signal,
    score: scoreOpportunity(signal),
  }));

  scored.sort((a, b) => b.score.total - a.score.total);

  return {
    selected: scored.slice(0, 3),
    pool: scored.slice(3),
  };
}
