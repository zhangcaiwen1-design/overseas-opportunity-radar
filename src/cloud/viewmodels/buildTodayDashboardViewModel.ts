import type { RunPushDecision } from '../services/buildRunPushDecision';

const pushChannels = ['feishu', 'wecom', 'wxpusher'] as const;

function summarizePushExecutionStatus(status: Record<PushChannel, boolean>) {
  const successfulChannels = Object.entries(status)
    .filter(([, ok]) => ok)
    .map(([channel]) => channel);

  if (successfulChannels.length === 0) {
    return '推荐链路未找到成功推送通道。';
  }

  if (successfulChannels.length === Object.keys(status).length) {
    return `推荐链路推送完成：成功通道 ${successfulChannels.join('、')}。`;
  }

  return `推荐链路部分成功：成功通道 ${successfulChannels.join('、')}；其余通道未成功。`;
}

type PushChannel = (typeof pushChannels)[number];
type PushChannelStatus = 'success' | 'failed' | 'configured' | 'not_configured';
type RecoveryAction = '' | 'collect' | 'generate' | 'push' | 'publish';

type ContentVariantStatus = 'draft' | 'reviewed' | 'published' | 'failed';
type PublicationChannel = 'site' | 'wechat' | 'douyin';
type PublicationAction = 'publish' | 'retry' | 'withdraw';

function summarizeLatestPublicationLog(
  publicationLogs: Array<{ channel: PublicationChannel; action: PublicationAction; status: string; responseSummary: string; createdAt?: string }>,
) {
  const latestLog = [...publicationLogs].sort((left, right) => (right.createdAt ?? '').localeCompare(left.createdAt ?? ''))[0];

  if (!latestLog) {
    return '';
  }

  return `${latestLog.channel} ${latestLog.action} ${latestLog.status}：${latestLog.responseSummary || '无返回摘要'}`;
}

export function buildTodayDashboardViewModel(input: {
  run: {
    id: string;
    dateKey: string;
    status: string;
    triggerType: string;
    summaryText?: string;
    errorMessage?: string;
    startedAt?: string;
  };
  candidates: Array<{
    id: string;
    title: string;
    source: string;
    summary: string;
    rank: number;
    draftSortOrder?: number;
    selectionState: string;
    tags: string[];
    canonicalUrl: string;
  }>;
  selectedItems: Array<{ id: string; candidateId?: string; title: string; status: string }>;
  artifacts: Array<{ artifactType: string; publicUrl: string; storagePath?: string }>;
  pushDigest: string;
  pushDecision: RunPushDecision | null;
  pushExecution: { runId: string; status: Record<PushChannel, boolean>; recommendedChannels: string[] } | null;
  pushStatus: Record<PushChannel, boolean>;
  pushLogs?: Array<{ channel: PushChannel; status: 'success' | 'failed'; responseSummary: string }>;
  currentContentVariants?: Array<{
    id: string;
    runId: string;
    candidateId?: string;
    selectedItemId?: string;
    channel: PublicationChannel;
    title: string;
    body: string;
    status: ContentVariantStatus;
    publishedAt?: string;
    reviewNotes: string;
  }>;
  currentPublicationLogs?: Array<{
    id: string;
    contentVariantId: string;
    channel: PublicationChannel;
    action: PublicationAction;
    status: string;
    responseSummary: string;
    operator: string;
    createdAt?: string;
  }>;
  recentLeadEvents?: Array<{
    id: string;
    sourceChannel: string;
    pageType: string;
    eventType: 'subscribe' | 'consult';
    contact: string;
    notes: string;
    createdAt?: string;
  }>;
  historyRuns?: Array<{
    id: string;
    dateKey: string;
    status: string;
    triggerType: string;
    summaryText?: string;
    errorMessage?: string;
    startedAt?: string;
  }>;
}) {
  const pushLogByChannel = new Map(input.pushLogs?.map((log) => [log.channel, log]));
  const lastSuccessfulRun = [input.run, ...(input.historyRuns ?? [])].find((run) => run.status === 'completed');
  const currentFailureRun = input.run.status === 'failed' ? input.run : null;
  const recentFailureRun = currentFailureRun ?? (input.historyRuns ?? []).find((run) => run.status === 'failed');
  const artifactReady = input.artifacts.some((artifact) => ['selected_html', 'selected_markdown', 'selected_png'].includes(artifact.artifactType));
  const publishedSiteVariantCount = input.currentContentVariants?.filter((variant) => variant.channel === 'site' && variant.status === 'published').length ?? 0;
  const publicationSuccessCount = input.currentPublicationLogs?.filter((log) => log.status === 'success').length ?? 0;
  const publicationFailureCount = input.currentPublicationLogs?.filter((log) => log.status !== 'success').length ?? 0;
  const latestPublicationSummary = summarizeLatestPublicationLog(input.currentPublicationLogs ?? []);
  const currentPublicationFailureLog = [...(input.currentPublicationLogs ?? [])]
    .filter((log) => log.status === 'failed')
    .sort((left, right) => (right.createdAt ?? '').localeCompare(left.createdAt ?? ''))[0];
  const failedPublicationVariant = currentPublicationFailureLog
    ? (input.currentContentVariants ?? []).find((variant) => variant.id === currentPublicationFailureLog.contentVariantId)
    : null;
  const recentLeadEventCount = input.recentLeadEvents?.length ?? 0;
  const recentLeadEventSummary = Array.from(new Set((input.recentLeadEvents ?? []).map((item) => item.eventType))).join('、');

  return {
    statusCard: {
      runId: input.run.id,
      dateKey: input.run.dateKey,
      status: input.run.status,
      triggerType: input.run.triggerType,
      candidateCount: input.candidates.length,
      selectedCount: input.selectedItems.length,
    },
    overview: {
      startedAt: input.run.startedAt ?? '',
      summaryText: input.run.summaryText ?? '',
      errorMessage: input.run.errorMessage ?? '',
      configuredPushChannels: pushChannels.filter((channel) => input.pushStatus[channel]).length,
      successfulPushChannels: input.pushLogs?.filter((log) => log.status === 'success').length ?? 0,
      failedPushChannels: input.pushLogs?.filter((log) => log.status === 'failed').length ?? 0,
      lastSuccessfulRunStartedAt: lastSuccessfulRun?.startedAt ?? '',
      recentFailureStartedAt: recentFailureRun?.startedAt ?? '',
      recentFailureMessage: recentFailureRun?.errorMessage ?? '',
      artifactReady,
      healthStatus: currentFailureRun || currentPublicationFailureLog || recentFailureRun ? '需要关注' : artifactReady ? '已就绪' : '待生成',
      healthSummary: currentFailureRun
        ? '当前运行失败，请先处理异常后再继续。'
        : currentPublicationFailureLog
          ? '当前发布失败，请先处理发布异常。'
          : recentFailureRun
            ? '最近一次历史运行失败，请先处理异常。'
            : artifactReady
              ? '本次运行已生成成稿产物，可继续推送。'
              : '当前还没有生成成稿产物，请先完成选稿并生成。',
      currentFailureStage: currentFailureRun ? 'run' : currentPublicationFailureLog ? 'publish' : recentFailureRun ? 'run' : '',
      currentFailureSummary: currentFailureRun
        ? `run failed：${currentFailureRun.errorMessage ?? '无返回摘要'}`
        : currentPublicationFailureLog
          ? summarizeLatestPublicationLog([currentPublicationFailureLog])
          : recentFailureRun
            ? `run failed：${recentFailureRun.errorMessage ?? '无返回摘要'}`
            : '',
      recoveryAction: (currentFailureRun ? 'generate' : currentPublicationFailureLog ? 'publish' : recentFailureRun ? 'collect' : '') as RecoveryAction,
      recoverySelectedItemId: failedPublicationVariant?.selectedItemId ?? '',
      recoverySuggestion: currentFailureRun
        ? '可先重新执行采集或重新生成当前 run。'
        : currentPublicationFailureLog
          ? '可在下方已生成条目中重新点击“发布到网站”。'
          : recentFailureRun
            ? '可通过重新采集、重新生成或重新推送来补跑失败 run。'
            : '',
      recentPushExecutionSummary: input.pushExecution ? summarizePushExecutionStatus(input.pushExecution.status) : '',
      recentLeadEventCount,
      recentLeadEventSummary,
      publishedSiteVariantCount,
      publicationSuccessCount,
      publicationFailureCount,
      latestPublicationSummary,
      recentLeadDetails: (input.recentLeadEvents ?? []).map((item) => ({
        id: item.id,
        eventType: item.eventType,
        pageType: item.pageType,
        contact: item.contact,
        notes: item.notes,
        createdAt: item.createdAt ?? '',
      })),
    },
    candidateRows: input.candidates,
    selectedRows: input.selectedItems.map((item) => {
      const siteVariant = (input.currentContentVariants ?? []).find((variant) => variant.channel === 'site' && variant.selectedItemId === item.id);

      return {
        ...item,
        sitePublicationStatus: siteVariant?.status ?? '',
      };
    }),
    artifactLinks: input.artifacts.map((artifact) => ({
      label: artifact.artifactType,
      href: artifact.publicUrl,
    })),
    pushPreview: {
      body: input.pushDigest,
      decision: input.pushDecision
        ? {
            shouldPushToday: input.pushDecision.shouldPushToday,
            reasonSummary: input.pushDecision.reasonSummary,
            recommendedCandidateIds: input.pushDecision.recommendedCandidateIds,
            recommendedChannels: input.pushDecision.recommendedChannels,
            candidateDecisions: input.pushDecision.candidateDecisions,
            riskFlags: input.pushDecision.riskFlags,
          }
        : null,
      execution: input.pushExecution
        ? {
            summary: summarizePushExecutionStatus(input.pushExecution.status),
            recommendedChannels: input.pushExecution.recommendedChannels,
          }
        : null,
      status: input.pushStatus,
      channelStatuses: pushChannels.map((channel) => {
        const log = pushLogByChannel.get(channel);

        if (log) {
          return {
            channel,
            status: log.status as PushChannelStatus,
            responseSummary: log.responseSummary,
          };
        }

        return {
          channel,
          status: input.pushStatus[channel] ? ('configured' as const) : ('not_configured' as const),
          responseSummary: '',
        };
      }),
    },
  };
}
