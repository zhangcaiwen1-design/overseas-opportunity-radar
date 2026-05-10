import { isCloudSchemaMissingError, resolveCloudPreflight, type CloudPreflightResult } from '../cloudEnv';
import { loadCloudConfig } from '../loadCloudConfig';
import { createAppSettingsRepository } from '../repositories/appSettingsRepository';
import { createArtifactRepository } from '../repositories/artifactRepository';
import { createCandidateRepository } from '../repositories/candidateRepository';
import { createContentVariantRepository } from '../repositories/contentVariantRepository';
import { createPublicationLogRepository } from '../repositories/publicationLogRepository';
import { createPushConfigRepository } from '../repositories/pushConfigRepository';
import { createLeadEventRepository } from '../repositories/leadEventRepository';
import { createPushLogRepository } from '../repositories/pushLogRepository';
import { createRunRepository } from '../repositories/runRepository';
import { createSelectedItemRepository } from '../repositories/selectedItemRepository';
import type { RunPushDecision } from '../services/buildRunPushDecision';
import { downloadArtifactText } from '../storage/uploadArtifact';
import { createSupabaseServerClient } from '../supabase/serverClient';
import type {
  CloudArtifactLink,
  CloudCandidate,
  CloudContentVariant,
  CloudLeadEvent,
  CloudPublicationLog,
  CloudPushConfig,
  CloudPushLog,
  CloudRun,
  CloudSelectedItem,
  PushChannel,
  RunStatus,
} from '../types';

interface RunPushExecution {
  runId: string;
  status: { feishu: boolean; wecom: boolean; wxpusher: boolean };
  recommendedChannels: string[];
}

interface HistoryRunSummary {
  id: string;
  dateKey: string;
  status: RunStatus;
  triggerType: 'cron' | 'manual';
  startedAt?: string;
  selectedCount: number;
  poolCount: number;
  summaryText?: string;
  errorMessage?: string;
}

interface DashboardData {
  cloudReady: boolean;
  preflight: CloudPreflightResult;
  run: CloudRun | { id: string; dateKey: string; status: 'idle'; triggerType: 'manual' };
  candidates: CloudCandidate[];
  selectedItems: CloudSelectedItem[];
  pushDigest: string;
  pushDecision: RunPushDecision | null;
  pushExecution: RunPushExecution | null;
  pushStatus: Record<PushChannel, boolean>;
  currentPushLogs: CloudPushLog[];
  currentContentVariants: CloudContentVariant[];
  currentPublicationLogs: CloudPublicationLog[];
  recentLeadEvents: CloudLeadEvent[];
  configuredChannels: PushChannel[];
  allPushConfigs: CloudPushConfig[];
  timezone: string;
  dailyRunTime: string;
  openaiBaseUrl: string;
  openaiApiKeyConfigured: boolean;
  historyRuns: HistoryRunSummary[];
  artifacts: CloudArtifactLink[];
}

function createFallbackDashboardData(input: {
  preflight: CloudPreflightResult;
  configuredChannels?: PushChannel[];
  allPushConfigs?: CloudPushConfig[];
}): DashboardData {
  return {
    cloudReady: input.preflight.status === 'ready',
    preflight: input.preflight,
    run: { id: 'uninitialized', dateKey: '未运行', status: 'idle', triggerType: 'manual' },
    candidates: [],
    selectedItems: [],
    pushDigest: '今日还没有推送文稿。',
    pushDecision: null,
    pushExecution: null,
    pushStatus: {
      feishu: input.configuredChannels?.includes('feishu') ?? false,
      wecom: input.configuredChannels?.includes('wecom') ?? false,
      wxpusher: input.configuredChannels?.includes('wxpusher') ?? false,
    },
    currentPushLogs: [],
    currentContentVariants: [],
    currentPublicationLogs: [],
    recentLeadEvents: [],
    configuredChannels: input.configuredChannels ?? [],
    allPushConfigs: input.allPushConfigs ?? [],
    timezone: 'Asia/Shanghai',
    dailyRunTime: '09:00',
    openaiBaseUrl: '',
    openaiApiKeyConfigured: false,
    historyRuns: [],
    artifacts: [],
  };
}

export async function loadDashboardData(): Promise<DashboardData> {
  const preflight = await resolveCloudPreflight({
    env: process.env,
    checkDatabase: async () => {
      const supabase = createSupabaseServerClient();
      const { error } = await supabase.from('runs').select('id').limit(1);

      if (!error) {
        return { status: 'ready' as const };
      }

      return {
        status: isCloudSchemaMissingError(error) ? ('database_schema_missing' as const) : ('database_unreachable' as const),
      };
    },
    checkStorage: async () => {
      const supabase = createSupabaseServerClient();
      const { storageBucket } = loadCloudConfig(process.env);
      const { error } = await supabase.storage.from(storageBucket).list('', { limit: 1 });

      return {
        status: error ? ('storage_unavailable' as const) : ('ready' as const),
      };
    },
  });

  if (preflight.status !== 'ready') {
    return createFallbackDashboardData({ preflight });
  }

  try {
    const supabase = createSupabaseServerClient();
    const runRepository = createRunRepository(supabase as never);
    const candidateRepository = createCandidateRepository(supabase as never);
    const selectedItemRepository = createSelectedItemRepository(supabase as never);
    const artifactRepository = createArtifactRepository(supabase as never);
    const pushConfigRepository = createPushConfigRepository(supabase as never);
    const pushLogRepository = createPushLogRepository(supabase as never);
    const contentVariantRepository = createContentVariantRepository(supabase as never);
    const publicationLogRepository = createPublicationLogRepository(supabase as never);
    const leadEventRepository = createLeadEventRepository(supabase as never);
    const appSettingsRepository = createAppSettingsRepository(supabase as never);

    const [run, recentRuns, pushConfigs, allPushConfigs, appSettings] = await Promise.all([
      runRepository.getLatest(),
      runRepository.listRecent(),
      pushConfigRepository.listEnabled(),
      pushConfigRepository.listAll(),
      appSettingsRepository.listAll(),
    ]);

    const timezone = appSettings.find((item) => item.key === 'timezone')?.value || 'Asia/Shanghai';
    const dailyRunTime = appSettings.find((item) => item.key === 'dailyRunTime')?.value || '09:00';
    const openaiBaseUrl = appSettings.find((item) => item.key === 'openaiBaseUrl')?.value || '';
    const openaiApiKeyConfigured = Boolean(appSettings.find((item) => item.key === 'openaiApiKey')?.value);

    if (!run) {
      return {
        ...createFallbackDashboardData({
          preflight,
          configuredChannels: pushConfigs.map((item) => item.channel),
          allPushConfigs,
        }),
        cloudReady: true,
        preflight,
        timezone,
        dailyRunTime,
        openaiBaseUrl,
        openaiApiKeyConfigured,
      };
    }

    const historyRuns = recentRuns.filter((item) => item.id !== run.id);

    const [candidates, selectedItems, artifacts, currentPushLogs, currentContentVariantsResult, recentLeadEventsResult] = await Promise.all([
      candidateRepository.listByRun(run.id),
      selectedItemRepository.listByRun(run.id),
      artifactRepository.listByRun(run.id),
      pushLogRepository.listByRunIds([run.id]),
      contentVariantRepository.listByRun(run.id).then(
        (currentContentVariants) => ({ currentContentVariants }),
        () => ({ currentContentVariants: [] as CloudContentVariant[] }),
      ),
      leadEventRepository.listRecent(5).then(
        (recentLeadEvents) => ({ recentLeadEvents }),
        () => ({ recentLeadEvents: [] as CloudLeadEvent[] }),
      ),
    ]);
    const currentContentVariants = currentContentVariantsResult.currentContentVariants;
    const recentLeadEvents = recentLeadEventsResult.recentLeadEvents;

    const currentPublicationLogs = await publicationLogRepository.listByContentVariantIds(currentContentVariants.map((item) => item.id)).catch(() => [] as CloudPublicationLog[]);

    const pushDigestArtifact = artifacts.find((artifact) => artifact.artifactType === 'push_digest');
    const pushDecisionArtifact = artifacts.find((artifact) => artifact.artifactType === 'push_decision');
    const pushExecutionArtifact = artifacts.find((artifact) => artifact.artifactType === 'push_execution');
    const pushDigest = pushDigestArtifact?.storagePath
      ? await downloadArtifactText(pushDigestArtifact.storagePath).catch(() => '今日还没有推送文稿。')
      : '今日还没有推送文稿。';
    const pushDecision = pushDecisionArtifact?.storagePath
      ? await downloadArtifactText(pushDecisionArtifact.storagePath)
          .then((text) => JSON.parse(text) as RunPushDecision)
          .catch(() => null)
      : null;
    const pushExecution = pushExecutionArtifact?.storagePath
      ? await downloadArtifactText(pushExecutionArtifact.storagePath)
          .then((text) => JSON.parse(text) as RunPushExecution)
          .catch(() => null)
      : null;

    return {
      cloudReady: true,
      preflight,
      run,
      candidates,
      selectedItems,
      pushDigest,
      pushDecision,
      pushExecution,
      pushStatus: {
        feishu: pushConfigs.some((item) => item.channel === 'feishu'),
        wecom: pushConfigs.some((item) => item.channel === 'wecom'),
        wxpusher: pushConfigs.some((item) => item.channel === 'wxpusher'),
      },
      configuredChannels: pushConfigs.map((item) => item.channel),
      allPushConfigs,
      timezone,
      dailyRunTime,
      openaiBaseUrl,
      openaiApiKeyConfigured,
      currentPushLogs,
      currentContentVariants,
      currentPublicationLogs,
      recentLeadEvents,
      historyRuns: historyRuns.map((historyRun) => ({
        id: historyRun.id,
        dateKey: historyRun.dateKey,
        status: historyRun.status,
        triggerType: historyRun.triggerType,
        startedAt: historyRun.startedAt,
        selectedCount: historyRun.selectedCount,
        poolCount: historyRun.poolCount,
        summaryText: historyRun.summaryText,
        errorMessage: historyRun.errorMessage,
      })),
      artifacts,
    };
  } catch {
    return createFallbackDashboardData({
      preflight: {
        ...preflight,
        status: 'database_unreachable',
        summary: '云端预检已通过，但读取当前运行数据失败。',
        hint: '请确认数据库表数据可读，或稍后重试。',
        missingKeys: [],
      },
    });
  }
}
