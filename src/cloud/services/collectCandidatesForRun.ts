import { normalizeSignals } from '../../pipeline/normalizeSignals';
import type { OpportunitySignal } from '../../types';
import { localizeSignalsForDashboard } from '../localizeSignalsForDashboard';

export interface CandidateRecord {
  signalId: string;
  source: OpportunitySignal['source'];
  title: string;
  summary: string;
  canonicalUrl: string;
  publishedAt: string;
  tags: string[];
  rawScore: number;
  rank: number;
}

export async function collectCandidatesForRun(input: {
  runId: string;
  fetchSignals: () => Promise<OpportunitySignal[]>;
  createMany: (runId: string, candidates: CandidateRecord[]) => Promise<void>;
  openaiBaseUrl?: string;
  openaiApiKey?: string;
}) {
  const normalizedSignals = await localizeSignalsForDashboard(normalizeSignals(await input.fetchSignals()), {
    canTranslate: Boolean(input.openaiApiKey),
    env: {
      ...process.env,
      OPENAI_API_KEY: input.openaiApiKey ?? process.env.OPENAI_API_KEY,
      OPENAI_BASE_URL: input.openaiBaseUrl ?? process.env.OPENAI_BASE_URL,
    },
  });
  const ranked = normalizedSignals.map((signal, index) => ({
    signalId: signal.id,
    source: signal.source,
    title: signal.title,
    summary: signal.summary,
    canonicalUrl: signal.canonicalUrl,
    publishedAt: signal.publishedAt,
    tags: signal.tags,
    rawScore: signal.rawScore,
    rank: index + 1,
  }));

  await input.createMany(input.runId, ranked);

  return {
    poolCount: ranked.length,
    candidates: ranked,
  };
}
