import { createArtifactRepository } from '../repositories/artifactRepository';
import { createCandidateRepository } from '../repositories/candidateRepository';
import { createPushLogRepository } from '../repositories/pushLogRepository';
import { createRunRepository } from '../repositories/runRepository';
import { createSelectedItemRepository } from '../repositories/selectedItemRepository';
import { deleteArtifact } from '../storage/uploadArtifact';
import { createSupabaseServerClient } from '../supabase/serverClient';
import type { SelectionState } from '../types';

export async function handleCandidateSelection(
  runId: string,
  candidateId: string,
  selectionState: SelectionState,
  draftSortOrder?: number,
) {
  const supabase = createSupabaseServerClient();
  const candidateRepository = createCandidateRepository(supabase as never);
  const selectedItemRepository = createSelectedItemRepository(supabase as never);
  const artifactRepository = createArtifactRepository(supabase as never);
  const pushLogRepository = createPushLogRepository(supabase as never);
  const runRepository = createRunRepository(supabase as never);

  await candidateRepository.updateSelectionState(runId, candidateId, selectionState, draftSortOrder);

  await selectedItemRepository.deleteByRunId(runId);
  await pushLogRepository.deleteByRunId(runId);
  await runRepository.updateStatus(runId, {
    status: 'running',
    selectedCount: 0,
    summaryText: '',
    errorMessage: '',
  });

  const existingArtifacts = await artifactRepository.listByRun(runId);
  const staleArtifactTypes = [
    'selected_html',
    'selected_markdown',
    'selected_png',
    'push_digest',
    'push_decision',
    'push_execution',
  ];

  for (const artifactType of staleArtifactTypes) {
    const artifact = existingArtifacts.find((item) => item.artifactType === artifactType);
    if (!artifact?.storagePath) {
      continue;
    }

    await deleteArtifact(artifact.storagePath);
    await artifactRepository.deleteByRunAndType(runId, artifactType);
  }

  return {
    runId,
    candidateId,
    selectionState,
    draftSortOrder,
  };
}
