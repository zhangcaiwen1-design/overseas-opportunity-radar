import { collectCandidatesForDailyRun } from '../../orchestrator/runDailyPipeline';
import { createAppSettingsRepository } from '../repositories/appSettingsRepository';
import { createCandidateRepository } from '../repositories/candidateRepository';
import { createRunRepository } from '../repositories/runRepository';
import { createSupabaseServerClient } from '../supabase/serverClient';

export async function handleDailyCollect(triggerType: 'cron' | 'manual' = 'cron') {
  const supabase = createSupabaseServerClient();
  const runRepository = createRunRepository(supabase as never);
  const candidateRepository = createCandidateRepository(supabase as never);
  const appSettingsRepository = createAppSettingsRepository(supabase as never);
  const appSettings = await appSettingsRepository.listAll();
  const openaiBaseUrl = appSettings.find((item) => item.key === 'openaiBaseUrl')?.value || '';
  const openaiApiKey = appSettings.find((item) => item.key === 'openaiApiKey')?.value || '';
  const dateKey = new Date().toISOString().slice(0, 10);
  const run = await runRepository.create({ dateKey, triggerType });

  try {
    const result = await collectCandidatesForDailyRun({
      runId: run.id,
      createMany: candidateRepository.createMany,
      openaiBaseUrl,
      openaiApiKey,
    });

    await runRepository.updateStatus(run.id, {
      status: 'completed',
      poolCount: result.poolCount,
      selectedCount: 0,
      summaryText: `采集完成，候选 ${result.poolCount} 条`,
      usedFallback: result.poolCount === 0,
      errorMessage: '',
    });

    return {
      run: { ...run, status: 'completed' as const },
      poolCount: result.poolCount,
    };
  } catch (error) {
    await runRepository.updateStatus(run.id, {
      status: 'failed',
      poolCount: 0,
      selectedCount: 0,
      summaryText: '',
      usedFallback: false,
      errorMessage: error instanceof Error ? error.message : 'daily collect failed',
    });
    throw error;
  }
}
