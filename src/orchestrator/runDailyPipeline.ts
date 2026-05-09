import { collectSignals } from '../cloud/collectSignals';
import { buildRunPushDecision } from '../cloud/services/buildRunPushDecision';
import { createRunPushDigest } from '../cloud/services/createRunPushDigest';
import { collectCandidatesForRun as collectCandidatesForCloudRun, type CandidateRecord } from '../cloud/services/collectCandidatesForRun';
import type { CloudCandidate, CloudSelectedItem } from '../cloud/types';
import type { OpportunitySignal, SourceName } from '../types';

export const collectSignalsForDailyRun = collectSignals;

export async function collectCandidatesForDailyRun(input: {
  runId: string;
  createMany: (runId: string, candidates: CandidateRecord[]) => Promise<void>;
  fetchSignals?: () => Promise<OpportunitySignal[]>;
  openaiBaseUrl?: string;
  openaiApiKey?: string;
}) {
  return collectCandidatesForCloudRun({
    runId: input.runId,
    fetchSignals: input.fetchSignals ?? collectSignalsForDailyRun,
    createMany: input.createMany,
    openaiBaseUrl: input.openaiBaseUrl,
    openaiApiKey: input.openaiApiKey,
  });
}

export async function generateSelectedArtifactsForDailyRun(input: {
  runId: string;
  dateKey: string;
  candidates: CloudCandidate[];
  selectedCandidateIds?: string[];
  createSelectedItems: (runId: string, candidates: OpportunitySignal[]) => Promise<CloudSelectedItem[]>;
  upload: (input: {
    storagePath: string;
    body: Buffer | string;
    contentType: string;
  }) => Promise<{ storagePath: string; publicUrl: string }>;
  saveArtifact: (artifact: {
    runId: string;
    selectedItemId: string;
    artifactType: string;
    storagePath: string;
    publicUrl: string;
    mimeType: string;
  }) => Promise<void>;
}) {
  const { generateSelectedArtifacts } = await import('../cloud/services/generateSelectedArtifacts');
  const selectedCandidates = pickSelectedCandidates(input.candidates, input.selectedCandidateIds).map(toOpportunitySignal);
  const selectedItems = await input.createSelectedItems(input.runId, selectedCandidates);
  const selectedItemIdByCandidateId = new Map(selectedItems.map((item) => [item.candidateId, item.id]));

  const result = await generateSelectedArtifacts({
    runId: input.runId,
    dateKey: input.dateKey,
    selectedCandidates,
    upload: input.upload,
    saveArtifact: (artifact) =>
      input.saveArtifact({
        ...artifact,
        selectedItemId: selectedItemIdByCandidateId.get(artifact.selectedItemId) ?? artifact.selectedItemId,
      }),
  });

  const pushDigest = createRunPushDigest({
    dateKey: input.dateKey,
    poolCount: input.candidates.length,
    leadTitle: result.articles[0]?.title ?? 'N/A',
    outputDir: `runs/${input.dateKey}`,
    selected: result.articles.map((entry) => ({
      article: entry.article,
      artifact: entry.artifact,
    })),
  });
  const pushDecision = JSON.stringify(
    buildRunPushDecision({
      runId: input.runId,
      candidates: input.candidates,
    }),
    null,
    2,
  );

  return {
    selectedCount: result.selectedCount,
    selectedItems,
    pushDigest,
    pushDigestArtifact: {
      storagePath: `runs/${input.dateKey}/push-digest.txt`,
      contentType: 'text/plain; charset=utf-8',
      mimeType: 'text/plain',
    },
    pushDecision,
    pushDecisionArtifact: {
      storagePath: `runs/${input.dateKey}/push-decision.json`,
      contentType: 'application/json',
      mimeType: 'application/json',
    },
  };
}

function pickSelectedCandidates(candidates: CloudCandidate[], selectedCandidateIds?: string[]) {
  const defaultSelectedCandidates = candidates.filter((candidate) => candidate.selectionState === 'selected');

  if (selectedCandidateIds && selectedCandidateIds.length > 0) {
    const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
    return selectedCandidateIds
      .map((candidateId) => candidateById.get(candidateId))
      .filter((candidate): candidate is CloudCandidate => Boolean(candidate));
  }

  if (defaultSelectedCandidates.length > 0) {
    return defaultSelectedCandidates;
  }

  return candidates.slice(0, 3);
}

function toOpportunitySignal(candidate: CloudCandidate): OpportunitySignal {
  return {
    id: candidate.id,
    title: candidate.title,
    summary: candidate.summary,
    canonicalUrl: candidate.canonicalUrl,
    url: candidate.canonicalUrl,
    source: candidate.source as SourceName,
    tags: candidate.tags,
    rawScore: candidate.rank,
    publishedAt: new Date().toISOString(),
  };
}
