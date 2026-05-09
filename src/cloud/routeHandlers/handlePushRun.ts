import { createArtifactRepository } from '../repositories/artifactRepository';
import { createPushConfigRepository } from '../repositories/pushConfigRepository';
import { createPushLogRepository } from '../repositories/pushLogRepository';
import { sendInternalAlert, sendRunPushes } from '../services/sendRunPushes';
import type { RunPushDecision } from '../services/buildRunPushDecision';
import { deleteArtifact, downloadArtifactText, uploadArtifact } from '../storage/uploadArtifact';
import { createSupabaseServerClient } from '../supabase/serverClient';

export async function handlePushRun(runId: string) {
  const supabase = createSupabaseServerClient();
  const artifactRepository = createArtifactRepository(supabase as never);
  const pushConfigRepository = createPushConfigRepository(supabase as never);
  const pushLogRepository = createPushLogRepository(supabase as never);

  const unavailableStatus = { feishu: false, wecom: false, wxpusher: false };
  const artifacts = await artifactRepository.listByRun(runId);
  const digestArtifact = artifacts.find((artifact) => artifact.artifactType === 'push_digest');
  const pushDecisionArtifact = artifacts.find((artifact) => artifact.artifactType === 'push_decision');

  if (!digestArtifact?.storagePath) {
    return { ok: false as const, reason: 'push digest unavailable', status: unavailableStatus };
  }

  const digest = await downloadArtifactText(digestArtifact.storagePath).catch(() => '');
  if (!digest) {
    return { ok: false as const, reason: 'push digest unavailable', status: unavailableStatus };
  }

  await pushLogRepository.deleteByRunId(runId);
  const pushExecutionArtifact = artifacts.find((artifact) => artifact.artifactType === 'push_execution');
  if (pushExecutionArtifact?.storagePath) {
    await deleteArtifact(pushExecutionArtifact.storagePath);
    await artifactRepository.deleteByRunAndType(runId, 'push_execution');
  }

  const configs = await pushConfigRepository.listEnabled();
  const pushDecision = pushDecisionArtifact?.storagePath
    ? await downloadArtifactText(pushDecisionArtifact.storagePath)
        .then((text) => JSON.parse(text) as RunPushDecision)
        .catch(() => null)
    : null;
  const recommendedChannels =
    pushDecision && pushDecision.shouldPushToday && pushDecision.recommendedChannels.length > 0
      ? new Set(pushDecision.recommendedChannels)
      : null;
  const filteredConfigs = recommendedChannels ? configs.filter((config) => recommendedChannels.has(config.channel)) : configs;
  const status = await sendRunPushes({
    runId,
    digest,
    configs: filteredConfigs,
    createPushLog: pushLogRepository.create,
  });
  const failedChannels = (Object.entries(status).filter(([, ok]) => !ok).map(([channel]) => channel) as Array<'feishu' | 'wecom' | 'wxpusher'>)
    .filter((channel) => filteredConfigs.some((config) => config.channel === channel));

  if (failedChannels.length > 0) {
    await sendInternalAlert({
      runId,
      failedChannels,
      configs: filteredConfigs,
    });
  }

  const pushExecution = JSON.stringify(
    {
      runId,
      status,
      recommendedChannels: pushDecision?.recommendedChannels ?? [],
    },
    null,
    2,
  );
  const pushExecutionUpload = await uploadArtifact({
    storagePath: `runs/${runId}/push-execution.json`,
    body: pushExecution,
    contentType: 'application/json',
  });
  await artifactRepository.create({
    runId,
    artifactType: 'push_execution',
    storagePath: pushExecutionUpload.storagePath,
    publicUrl: pushExecutionUpload.publicUrl,
    mimeType: 'application/json',
  });

  return { ok: true as const, status };
}
