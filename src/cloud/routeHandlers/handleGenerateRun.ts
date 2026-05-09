import { generateSelectedArtifactsForDailyRun } from '../../orchestrator/runDailyPipeline';
import { createArtifactRepository } from '../repositories/artifactRepository';
import { createCandidateRepository } from '../repositories/candidateRepository';
import { createRunRepository } from '../repositories/runRepository';
import { createSelectedItemRepository } from '../repositories/selectedItemRepository';
import { createPushLogRepository } from '../repositories/pushLogRepository';
import { deleteArtifact, uploadArtifact } from '../storage/uploadArtifact';
import { createSupabaseServerClient } from '../supabase/serverClient';

export async function handleGenerateRun(runId: string, selectedCandidateIds?: string[]) {
  const supabase = createSupabaseServerClient();
  const runRepository = createRunRepository(supabase as never);
  const candidateRepository = createCandidateRepository(supabase as never);
  const selectedItemRepository = createSelectedItemRepository(supabase as never);
  const artifactRepository = createArtifactRepository(supabase as never);
  const pushLogRepository = createPushLogRepository(supabase as never);
  const run = await runRepository.getById(runId);

  if (!run) {
    throw new Error(`Run not found: ${runId}`);
  }

  let candidates: Awaited<ReturnType<typeof candidateRepository.listByRun>> = [];

  try {
    candidates = await candidateRepository.listByRun(runId);

    await selectedItemRepository.deleteByRunId(runId);
    await pushLogRepository.deleteByRunId(runId);

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

    const result = await generateSelectedArtifactsForDailyRun({
      runId,
      dateKey: run.dateKey,
      candidates,
      selectedCandidateIds,
      createSelectedItems: selectedItemRepository.createMany,
      upload: uploadArtifact,
      saveArtifact: artifactRepository.create,
    });

    const digestUpload = await uploadArtifact({
      storagePath: result.pushDigestArtifact.storagePath,
      body: result.pushDigest,
      contentType: result.pushDigestArtifact.contentType,
    });
    await artifactRepository.create({
      runId,
      artifactType: 'push_digest',
      storagePath: digestUpload.storagePath,
      publicUrl: digestUpload.publicUrl,
      mimeType: result.pushDigestArtifact.mimeType,
    });

    const pushDecisionUpload = await uploadArtifact({
      storagePath: result.pushDecisionArtifact.storagePath,
      body: result.pushDecision,
      contentType: result.pushDecisionArtifact.contentType,
    });
    await artifactRepository.create({
      runId,
      artifactType: 'push_decision',
      storagePath: pushDecisionUpload.storagePath,
      publicUrl: pushDecisionUpload.publicUrl,
      mimeType: result.pushDecisionArtifact.mimeType,
    });

    await runRepository.updateStatus(runId, {
      status: 'completed',
      poolCount: candidates.length,
      selectedCount: result.selectedCount,
      summaryText: `已生成 ${result.selectedCount} 条成稿`,
      usedFallback: false,
      errorMessage: '',
    });

    return {
      selectedCount: result.selectedCount,
      selectedItems: result.selectedItems,
      pushDigest: result.pushDigest,
      pushDecision: result.pushDecision,
    };
  } catch (error) {
    await runRepository.updateStatus(runId, {
      status: 'failed',
      poolCount: candidates.length,
      selectedCount: 0,
      summaryText: '',
      usedFallback: false,
      errorMessage: error instanceof Error ? error.message : 'generate run failed',
    });
    throw error;
  }
}
