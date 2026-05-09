import type { OpportunitySignal } from '../types';

export function normalizeSignals(signals: OpportunitySignal[]): OpportunitySignal[] {
  const deduped = new Map<string, OpportunitySignal>();

  for (const signal of signals) {
    const existing = deduped.get(signal.canonicalUrl);
    if (!existing || signal.rawScore > existing.rawScore) {
      deduped.set(signal.canonicalUrl, signal);
    }
  }

  return Array.from(deduped.values()).sort(
    (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
  );
}
