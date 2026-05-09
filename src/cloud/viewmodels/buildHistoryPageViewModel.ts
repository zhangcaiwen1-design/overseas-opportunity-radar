type RecoveryAction = '' | 'collect' | 'generate' | 'push' | 'publish';

const artifactTypeLabels: Record<string, string> = {
  selected_html: '成稿 HTML',
  selected_markdown: '成稿 Markdown',
  selected_png: '成稿预览图',
  push_digest: '推送文稿',
  push_decision: '推送决策建议',
  push_execution: '推送执行结果',
};

function summarizeLatestPublicationLog(
  publicationLogs: Array<{ channel: string; action: string; status: string; responseSummary: string; createdAt?: string }>,
) {
  const latestLog = [...publicationLogs].sort((left, right) => (right.createdAt ?? '').localeCompare(left.createdAt ?? ''))[0];

  if (!latestLog) {
    return '';
  }

  return `${latestLog.channel} ${latestLog.action} ${latestLog.status}：${latestLog.responseSummary || '无返回摘要'}`;
}

export function buildHistoryPageViewModel(
  runs: Array<{
    id: string;
    dateKey: string;
    status: string;
    startedAt?: string;
    selectedCount: number;
    poolCount: number;
    summaryText?: string;
    errorMessage?: string;
    artifacts: Array<{ artifactType: string; publicUrl: string; storagePath?: string }>;
    pushLogs: Array<{ channel: string; status: string; responseSummary: string; pushedAt?: string }>;
    contentVariants: Array<{ channel: string; status: string; selectedItemId?: string }>;
    publicationLogs: Array<{ channel: string; action: string; status: string; responseSummary: string; createdAt?: string }>;
  }>,
) {
  return {
    summary: {
      totalRuns: runs.length,
      completedRuns: runs.filter((run) => run.status === 'completed').length,
      failedRuns: runs.filter((run) => run.status === 'failed').length,
      totalSelectedCount: runs.reduce((total, run) => total + run.selectedCount, 0),
    },
    rows: [...runs]
      .sort((left, right) => {
        if (left.startedAt && right.startedAt && left.startedAt !== right.startedAt) {
          return right.startedAt.localeCompare(left.startedAt);
        }

        return right.dateKey.localeCompare(left.dateKey);
      })
      .map((run) => {
        const runSiteVariant = run.contentVariants.find((variant) => variant.channel === 'site');
        const grouped = Object.entries(
          run.artifacts.reduce(
            (groups, artifact) => {
              const current = groups[artifact.artifactType] ?? [];
              return {
                ...groups,
                [artifact.artifactType]: [
                  ...current,
                  {
                    label: artifact.artifactType,
                    href: artifact.publicUrl,
                    storagePath: artifact.storagePath,
                  },
                ],
              };
            },
            {} as Record<string, Array<{ label: string; href: string; storagePath?: string }>>,
          ),
        ).map(([artifactType, links]) => ({
          artifactType,
          title: artifactTypeLabels[artifactType] ?? artifactType,
          links,
        }));

        const failedPublicationLog = [...run.publicationLogs]
          .filter((log) => log.status === 'failed')
          .sort((left, right) => (right.createdAt ?? '').localeCompare(left.createdAt ?? ''))[0];
        const hasGeneratedArtifacts = run.artifacts.some((artifact) => ['selected_html', 'selected_markdown', 'selected_png'].includes(artifact.artifactType));

        const recoveryAction = (
          run.status === 'failed'
            ? hasGeneratedArtifacts
              ? 'push'
              : run.selectedCount > 0
                ? 'generate'
                : 'collect'
            : failedPublicationLog && runSiteVariant
              ? 'publish'
              : ''
        ) as RecoveryAction;

        return {
          id: run.id,
          dateKey: run.dateKey,
          startedAt: run.startedAt ?? '',
          status: run.status,
          selectedCount: run.selectedCount,
          poolCount: run.poolCount,
          summaryText: run.summaryText ?? '',
          errorMessage: run.errorMessage ?? '',
          failureSummary: run.status === 'failed'
            ? `run failed：${run.errorMessage ?? '无返回摘要'}`
            : failedPublicationLog
              ? summarizeLatestPublicationLog([failedPublicationLog])
              : '',
          recoveryAction,
          recoverySelectedItemId: recoveryAction === 'publish' ? runSiteVariant?.selectedItemId ?? '' : '',
          pushLogs: run.pushLogs,
          publishedSummary: {
            publishedCount: run.contentVariants.filter((variant) => variant.channel === 'site' && variant.status === 'published').length,
            logCount: run.publicationLogs.length,
            latestStatusSummary: summarizeLatestPublicationLog(run.publicationLogs),
          },
          publicationLogs: run.publicationLogs.map((log) => ({
            channel: log.channel,
            action: log.action,
            status: log.status,
            responseSummary: log.responseSummary,
          })),
          artifactGroups: grouped,
        };
      }),
  };
}
