import { createArtifactRepository } from '../repositories/artifactRepository';
import { createContentVariantRepository } from '../repositories/contentVariantRepository';
import { createPublicationLogRepository } from '../repositories/publicationLogRepository';
import { createPushLogRepository } from '../repositories/pushLogRepository';
import { createRunRepository } from '../repositories/runRepository';
import { createSupabaseServerClient } from '../supabase/serverClient';
import type { CloudArtifactLink, CloudContentVariant, CloudPublicationLog, CloudPushLog, RunStatus } from '../types';

export interface HistoryRunDetail {
  id: string;
  dateKey: string;
  status: RunStatus;
  triggerType: 'cron' | 'manual';
  startedAt?: string;
  selectedCount: number;
  poolCount: number;
  summaryText?: string;
  errorMessage?: string;
  artifacts: Array<CloudArtifactLink & { runId: string }>;
  pushLogs: CloudPushLog[];
  contentVariants: CloudContentVariant[];
  publicationLogs: CloudPublicationLog[];
}

export async function loadHistoryData(): Promise<HistoryRunDetail[]> {
  const supabase = createSupabaseServerClient();
  const runRepository = createRunRepository(supabase as never);
  const artifactRepository = createArtifactRepository(supabase as never);
  const pushLogRepository = createPushLogRepository(supabase as never);
  const contentVariantRepository = createContentVariantRepository(supabase as never);
  const publicationLogRepository = createPublicationLogRepository(supabase as never);

  const runs = await runRepository.listRecent();
  const runIds = runs.map((run) => run.id);

  const [artifacts, pushLogs, contentVariants] = await Promise.all([
    artifactRepository.listByRunIds(runIds),
    pushLogRepository.listByRunIds(runIds),
    contentVariantRepository.listByRunIds(runIds),
  ]);
  const publicationLogs = await publicationLogRepository.listByContentVariantIds(contentVariants.map((variant) => variant.id));

  return runs.map((run) => {
    const runContentVariants = contentVariants.filter((variant) => variant.runId === run.id);
    const runContentVariantIds = new Set(runContentVariants.map((variant) => variant.id));

    return {
      id: run.id,
      dateKey: run.dateKey,
      status: run.status,
      triggerType: run.triggerType,
      startedAt: run.startedAt,
      selectedCount: run.selectedCount,
      poolCount: run.poolCount,
      summaryText: run.summaryText,
      errorMessage: run.errorMessage,
      artifacts: artifacts.filter((artifact) => artifact.runId === run.id),
      pushLogs: pushLogs.filter((pushLog) => pushLog.runId === run.id),
      contentVariants: runContentVariants,
      publicationLogs: publicationLogs.filter((log) => runContentVariantIds.has(log.contentVariantId)),
    };
  });
}
