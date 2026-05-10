import { describe, expect, it } from 'vitest';
import { buildHistoryPageViewModel } from '../src/cloud/viewmodels/buildHistoryPageViewModel';
import { toUtcCronExpression } from '../src/cloud/settings/syncCronSchedule';
import { buildSettingsPageViewModel } from '../src/cloud/viewmodels/buildSettingsPageViewModel';
import { buildTodayDashboardViewModel } from '../src/cloud/viewmodels/buildTodayDashboardViewModel';

describe('buildTodayDashboardViewModel', () => {
  it('shows current run failure in health summary even when history has no failed run', () => {
    const viewModel = buildTodayDashboardViewModel({
      run: {
        id: 'run-1',
        dateKey: '2026-05-08',
        status: 'failed',
        triggerType: 'cron',
        summaryText: '',
        errorMessage: 'generate failed',
        startedAt: '2026-05-08T09:00:00.000Z',
      },
      candidates: [],
      selectedItems: [],
      artifacts: [],
      pushDigest: '今日还没有推送文稿。',
      pushDecision: null,
      pushExecution: null,
      pushStatus: { feishu: false, wecom: false, wxpusher: false },
      pushLogs: [],
      historyRuns: [
        {
          id: 'run-prev',
          dateKey: '2026-05-07',
          status: 'completed',
          triggerType: 'cron',
          startedAt: '2026-05-07T09:00:00.000Z',
          summaryText: 'Generated 3 highlights',
          errorMessage: '',
        },
      ],
    });

    expect(viewModel.overview.healthStatus).toBe('需要关注');
    expect(viewModel.overview.healthSummary).toBe('当前运行失败，请先处理异常后再继续。');
    expect(viewModel.overview.recentFailureStartedAt).toBe('2026-05-08T09:00:00.000Z');
    expect(viewModel.overview.recentFailureMessage).toBe('generate failed');
  });

  it('summarizes site publication results in dashboard overview', () => {
    const viewModel = buildTodayDashboardViewModel({
      run: {
        id: 'run-1',
        dateKey: '2026-05-08',
        status: 'completed',
        triggerType: 'cron',
        summaryText: 'Generated 4 highlights',
        errorMessage: '',
        startedAt: '2026-05-08T09:00:00.000Z',
      },
      candidates: [],
      selectedItems: [],
      artifacts: [],
      pushDigest: '今日海外商业机会雷达｜2026-05-08',
      pushDecision: null,
      pushExecution: null,
      pushStatus: { feishu: false, wecom: false, wxpusher: false },
      pushLogs: [],
      recentLeadEvents: [
        {
          id: 'lead-1',
          sourceChannel: 'site',
          pageType: 'site_index',
          eventType: 'subscribe',
          contact: 'founder@example.com',
          notes: '想看案例',
          createdAt: '2026-05-08T10:00:00.000Z',
        },
        {
          id: 'lead-2',
          sourceChannel: 'site',
          pageType: 'site_article',
          eventType: 'consult',
          contact: 'wechat-radar',
          notes: '',
          createdAt: '2026-05-08T10:05:00.000Z',
        },
      ],
      currentContentVariants: [
        {
          id: 'variant-1',
          runId: 'run-1',
          candidateId: 'candidate-1',
          selectedItemId: 'selected-1',
          channel: 'site',
          title: '站点稿件 A',
          body: 'body-a',
          status: 'published',
          publishedAt: '2026-05-08T09:30:00.000Z',
          reviewNotes: '',
        },
        {
          id: 'variant-2',
          runId: 'run-1',
          candidateId: 'candidate-2',
          selectedItemId: 'selected-2',
          channel: 'site',
          title: '站点稿件 B',
          body: 'body-b',
          status: 'failed',
          reviewNotes: '发布失败',
        },
      ],
      currentPublicationLogs: [
        {
          id: 'publication-log-1',
          contentVariantId: 'variant-1',
          channel: 'site',
          action: 'publish',
          status: 'success',
          responseSummary: 'Published to /posts/a',
          operator: 'system',
          createdAt: '2026-05-08T09:31:00.000Z',
        },
        {
          id: 'publication-log-2',
          contentVariantId: 'variant-2',
          channel: 'site',
          action: 'publish',
          status: 'failed',
          responseSummary: 'Build failed',
          operator: 'system',
          createdAt: '2026-05-08T09:32:00.000Z',
        },
      ],
      historyRuns: [],
    });

    expect(viewModel.overview.publishedSiteVariantCount).toBe(1);
    expect(viewModel.overview.publicationSuccessCount).toBe(1);
    expect(viewModel.overview.publicationFailureCount).toBe(1);
    expect(viewModel.overview.latestPublicationSummary).toBe('网站发布失败：Build failed');
    expect(viewModel.overview.recentLeadEventCount).toBe(2);
    expect(viewModel.overview.recentLeadEventSummary).toBe('subscribe、consult');
  });

  it('marks current publication failure as a dashboard health issue', () => {
    const viewModel = buildTodayDashboardViewModel({
      run: {
        id: 'run-1',
        dateKey: '2026-05-08',
        status: 'completed',
        triggerType: 'cron',
        summaryText: 'Generated 2 highlights',
        errorMessage: '',
        startedAt: '2026-05-08T09:00:00.000Z',
      },
      candidates: [],
      selectedItems: [],
      artifacts: [],
      pushDigest: 'digest',
      pushDecision: null,
      pushExecution: null,
      pushStatus: { feishu: false, wecom: false, wxpusher: false },
      pushLogs: [],
      currentContentVariants: [
        {
          id: 'variant-1',
          runId: 'run-1',
          candidateId: 'candidate-1',
          selectedItemId: 'selected-1',
          channel: 'site',
          title: '站点稿件 A',
          body: 'body-a',
          status: 'failed',
          reviewNotes: '发布失败',
        },
      ],
      currentPublicationLogs: [
        {
          id: 'publication-log-1',
          contentVariantId: 'variant-1',
          channel: 'site',
          action: 'publish',
          status: 'failed',
          responseSummary: 'Build failed',
          operator: 'system',
          createdAt: '2026-05-08T09:32:00.000Z',
        },
      ],
      historyRuns: [],
    });

    expect(viewModel.overview.healthStatus).toBe('需要关注');
    expect(viewModel.overview.healthSummary).toBe('当前发布失败，请先处理发布异常。');
    expect(viewModel.overview.currentFailureStage).toBe('publish');
    expect(viewModel.overview.currentFailureSummary).toBe('网站发布失败：Build failed');
    expect(viewModel.overview.recoveryAction).toBe('publish');
    expect(viewModel.overview.recoverySelectedItemId).toBe('selected-1');
  });

  it('sanitizes raw run failure messages for dashboard display', () => {
    const viewModel = buildTodayDashboardViewModel({
      run: {
        id: 'run-1',
        dateKey: '2026-05-08',
        status: 'failed',
        triggerType: 'cron',
        summaryText: '',
        errorMessage: 'browserType.launch: Host system is missing dependencies\n╔════════════════════════════════╗\nPlease run the following command to install\n  npx playwright install --with-deps',
        startedAt: '2026-05-08T09:00:00.000Z',
      },
      candidates: [],
      selectedItems: [],
      artifacts: [],
      pushDigest: '今日还没有推送文稿。',
      pushDecision: null,
      pushExecution: null,
      pushStatus: { feishu: false, wecom: false, wxpusher: false },
      pushLogs: [],
      historyRuns: [],
    });

    expect(viewModel.overview.errorMessage).toBe('浏览器运行环境缺失，请在服务器安装 Playwright 浏览器及依赖后重试。');
    expect(viewModel.overview.recentFailureMessage).toBe('浏览器运行环境缺失，请在服务器安装 Playwright 浏览器及依赖后重试。');
    expect(viewModel.overview.currentFailureSummary).toBe('运行失败：浏览器运行环境缺失，请在服务器安装 Playwright 浏览器及依赖后重试。');
  });

  it('groups today run data into status, candidate list, selected list, and push preview blocks', () => {
    const viewModel = buildTodayDashboardViewModel({
      run: {
        id: 'run-1',
        dateKey: '2026-05-08',
        status: 'completed',
        triggerType: 'cron',
        summaryText: 'Generated 4 highlights',
        errorMessage: '',
        startedAt: '2026-05-08T09:00:00.000Z',
      },
      candidates: [
        {
          id: 'candidate-1',
          title: 'Signal One',
          source: 'github',
          summary: 'summary',
          rank: 1,
          selectionState: 'pending',
          tags: ['ops'],
          canonicalUrl: 'https://example.com/1',
        },
      ],
      selectedItems: [],
      artifacts: [{ artifactType: 'push_digest', publicUrl: 'https://cdn.example.com/push.txt' }],
      pushDigest: '今日海外商业机会雷达｜2026-05-08',
      pushDecision: {
        runId: 'run-1',
        shouldPushToday: true,
        recommendedCandidateIds: ['candidate-1'],
        recommendedChannels: ['wecom'],
        reasonSummary: '建议推送 candidate-1。',
        candidateDecisions: [
          {
            candidateId: 'candidate-1',
            action: 'push',
            scoreLabel: 'high',
            reasons: ['本地化适配信号较强'],
            suggestedChannels: ['wecom'],
          },
        ],
        riskFlags: [],
      },
      pushExecution: {
        runId: 'run-1',
        status: { feishu: true, wecom: false, wxpusher: false },
        recommendedChannels: ['wecom'],
      },
      pushStatus: { feishu: false, wecom: true, wxpusher: false },
      pushLogs: [
        { runId: 'run-1', channel: 'feishu', status: 'success', responseSummary: 'ok', pushedAt: '2026-05-08T10:00:00.000Z' },
        { runId: 'run-1', channel: 'wecom', status: 'failed', responseSummary: 'timeout', pushedAt: '2026-05-08T10:02:00.000Z' },
      ],
      recentLeadEvents: [
        {
          id: 'lead-1',
          sourceChannel: 'site',
          pageType: 'site_index',
          eventType: 'subscribe',
          contact: 'founder@example.com',
          notes: '想看案例',
          createdAt: '2026-05-08T10:00:00.000Z',
        },
        {
          id: 'lead-2',
          sourceChannel: 'site',
          pageType: 'site_article',
          eventType: 'consult',
          contact: 'wechat-radar',
          notes: '',
          createdAt: '2026-05-08T10:05:00.000Z',
        },
      ],
      currentContentVariants: [],
      currentPublicationLogs: [],
      historyRuns: [
        {
          id: 'run-0',
          dateKey: '2026-05-07',
          status: 'failed',
          triggerType: 'cron',
          startedAt: '2026-05-07T09:00:00.000Z',
          summaryText: '',
          errorMessage: 'timeout',
        },
        {
          id: 'run-prev',
          dateKey: '2026-05-06',
          status: 'completed',
          triggerType: 'cron',
          startedAt: '2026-05-06T09:00:00.000Z',
          summaryText: 'Generated 3 highlights',
          errorMessage: '',
        },
      ],
    });

    expect(viewModel.statusCard.candidateCount).toBe(1);
    expect(viewModel.candidateRows[0].title).toBe('Signal One');
    expect(viewModel.pushPreview.body).toContain('今日海外商业机会雷达');
    expect(viewModel.pushPreview.decision).toEqual({
      shouldPushToday: true,
      reasonSummary: '建议推送 candidate-1。',
      recommendedCandidateIds: ['candidate-1'],
      recommendedChannels: ['wecom'],
      candidateDecisions: [
        {
          candidateId: 'candidate-1',
          action: 'push',
          scoreLabel: 'high',
          reasons: ['本地化适配信号较强'],
          suggestedChannels: ['wecom'],
        },
      ],
      riskFlags: [],
    });
    expect(viewModel.pushPreview.execution).toEqual({
      summary: '推荐链路部分成功：成功通道 feishu；其余通道未成功。',
      recommendedChannels: ['wecom'],
    });
    expect(viewModel.statusCard.runId).toBe('run-1');
    expect(viewModel.artifactLinks[0].label).toBe('push_digest');
    expect(viewModel.overview).toEqual({
      startedAt: '2026-05-08T09:00:00.000Z',
      summaryText: 'Generated 4 highlights',
      errorMessage: '',
      configuredPushChannels: 1,
      successfulPushChannels: 1,
      failedPushChannels: 1,
      lastSuccessfulRunStartedAt: '2026-05-08T09:00:00.000Z',
      recentFailureStartedAt: '2026-05-07T09:00:00.000Z',
      recentFailureMessage: 'timeout',
      artifactReady: false,
      healthStatus: '需要关注',
      healthSummary: '最近一次历史运行失败，请先处理异常。',
      currentFailureStage: 'run',
      currentFailureSummary: '运行失败：timeout',
      recoveryAction: 'collect',
      recoverySelectedItemId: '',
      recoverySuggestion: '可通过重新采集、重新生成或重新推送来补跑失败 run。',
      recentPushExecutionSummary: '推荐链路部分成功：成功通道 feishu；其余通道未成功。',
      recentLeadEventCount: 2,
      recentLeadEventSummary: 'subscribe、consult',
      recentLeadDetails: [
        {
          id: 'lead-1',
          eventType: 'subscribe',
          pageType: 'site_index',
          contact: 'founder@example.com',
          notes: '想看案例',
          createdAt: '2026-05-08T10:00:00.000Z',
        },
        {
          id: 'lead-2',
          eventType: 'consult',
          pageType: 'site_article',
          contact: 'wechat-radar',
          notes: '',
          createdAt: '2026-05-08T10:05:00.000Z',
        },
      ],
      publishedSiteVariantCount: 0,
      publicationSuccessCount: 0,
      publicationFailureCount: 0,
      latestPublicationSummary: '',
    });
    expect(viewModel.pushPreview.channelStatuses).toEqual([
      { channel: 'feishu', status: 'success', responseSummary: 'ok' },
      { channel: 'wecom', status: 'failed', responseSummary: 'timeout' },
      { channel: 'wxpusher', status: 'not_configured', responseSummary: '' },
    ]);
  });
});

describe('buildHistoryPageViewModel', () => {
  it('sorts runs by startedAt desc and exposes publication logs', () => {
    const viewModel = buildHistoryPageViewModel([
      {
        id: 'run-earlier',
        dateKey: '2026-05-08',
        status: 'completed',
        startedAt: '2026-05-08T01:00:00.000Z',
        selectedCount: 3,
        poolCount: 12,
        summaryText: '较早的一次运行',
        errorMessage: '',
        artifacts: [],
        pushLogs: [],
        contentVariants: [],
        publicationLogs: [],
      },
      {
        id: 'run-later',
        dateKey: '2026-05-08',
        status: 'completed',
        startedAt: '2026-05-08T02:00:00.000Z',
        selectedCount: 4,
        poolCount: 10,
        summaryText: '生成了 4 条成稿',
        errorMessage: '',
        artifacts: [
          {
            artifactType: 'push_digest',
            publicUrl: 'https://cdn.example.com/push.txt',
            storagePath: 'runs/2026-05-08/push-digest.txt',
          },
          {
            artifactType: 'push_decision',
            publicUrl: 'https://cdn.example.com/push-decision.json',
            storagePath: 'runs/2026-05-08/push-decision.json',
          },
          {
            artifactType: 'push_execution',
            publicUrl: 'https://cdn.example.com/push-execution.json',
            storagePath: 'runs/2026-05-08/push-execution.json',
          },
        ],
        pushLogs: [{ channel: 'feishu', status: 'success', responseSummary: 'ok', pushedAt: '2026-05-08T02:20:00.000Z' }],
        contentVariants: [
          {
            id: 'variant-1',
            runId: 'run-later',
            candidateId: 'candidate-1',
            selectedItemId: 'selected-1',
            channel: 'site',
            title: '站点稿件 A',
            body: 'body-a',
            status: 'published',
            publishedAt: '2026-05-08T02:15:00.000Z',
            reviewNotes: '',
          },
        ],
        publicationLogs: [
          {
            id: 'publication-log-1',
            contentVariantId: 'variant-1',
            channel: 'site',
            action: 'publish',
            status: 'success',
            responseSummary: 'Published to /posts/a',
            operator: 'system',
            createdAt: '2026-05-08T02:16:00.000Z',
          },
        ],
      },
      {
        id: 'run-failed',
        dateKey: '2026-05-07',
        status: 'failed',
        startedAt: '2026-05-07T02:00:00.000Z',
        selectedCount: 0,
        poolCount: 8,
        summaryText: '',
        errorMessage: 'timeout',
        artifacts: [],
        pushLogs: [],
        contentVariants: [],
        publicationLogs: [],
      },
    ]);

    expect(viewModel.summary).toEqual({
      totalRuns: 3,
      completedRuns: 2,
      failedRuns: 1,
      totalSelectedCount: 7,
    });
    expect(viewModel.rows[0].id).toBe('run-later');
    expect(viewModel.rows[0].artifactGroups).toEqual([
      {
        artifactType: 'push_digest',
        title: '推送文稿',
        links: [
          {
            label: 'push_digest',
            href: 'https://cdn.example.com/push.txt',
            storagePath: 'runs/2026-05-08/push-digest.txt',
          },
        ],
      },
      {
        artifactType: 'push_decision',
        title: '推送决策建议',
        links: [
          {
            label: 'push_decision',
            href: 'https://cdn.example.com/push-decision.json',
            storagePath: 'runs/2026-05-08/push-decision.json',
          },
        ],
      },
      {
        artifactType: 'push_execution',
        title: '推送执行结果',
        links: [
          {
            label: 'push_execution',
            href: 'https://cdn.example.com/push-execution.json',
            storagePath: 'runs/2026-05-08/push-execution.json',
          },
        ],
      },
    ]);
    expect(viewModel.rows[0].summaryText).toBe('生成了 4 条成稿');
    expect(viewModel.rows[0].pushLogs[0].channel).toBe('feishu');
    expect(viewModel.rows[0].publishedSummary).toEqual({
      publishedCount: 1,
      logCount: 1,
      latestStatusSummary: 'site publish success：Published to /posts/a',
    });
    expect(viewModel.rows[0].publicationLogs[0]).toEqual({
      channel: 'site',
      action: 'publish',
      status: 'success',
      responseSummary: 'Published to /posts/a',
    });
  });
});

describe('buildSettingsPageViewModel', () => {
  it('derives cron preview from the shared UTC cron expression helper and hides secret payloads', () => {
    const viewModel = buildSettingsPageViewModel({
      timezone: 'UTC',
      dailyRunTime: '09:15',
      openaiBaseUrl: 'https://gateway.example.com/v1',
      openaiApiKeyConfigured: true,
      configuredChannels: ['feishu'],
      allPushConfigs: [
        { channel: 'feishu', enabled: true, secretPayload: 'https://example.com/feishu' },
        { channel: 'wecom', enabled: false, secretPayload: 'https://example.com/wecom' },
      ],
    });

    expect(viewModel.timezone).toBe('UTC');
    expect(viewModel.dailyRunTime).toBe('09:15');
    expect(viewModel.cronExpression).toBe(toUtcCronExpression('09:15', 'UTC'));
    expect(viewModel.openaiBaseUrl).toBe('https://gateway.example.com/v1');
    expect(viewModel.openaiApiKeyConfigured).toBe(true);
    expect(viewModel.channels.find((item) => item.channel === 'feishu')).toEqual(
      expect.objectContaining({ configured: true }),
    );
    expect(viewModel.channels.find((item) => item.channel === 'feishu')).not.toHaveProperty('secretPayload');
    expect(viewModel.channels.find((item) => item.channel === 'wxpusher')).toEqual(
      expect.objectContaining({ configured: false }),
    );
    expect(viewModel.channels.find((item) => item.channel === 'wxpusher')).not.toHaveProperty('secretPayload');
  });
});
