import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const loadDashboardData = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock('../src/cloud/queries/loadDashboardData', () => ({
  loadDashboardData,
}));

describe('HomePage', () => {
  it('renders current publication failure as an explicit failure point', async () => {
    loadDashboardData.mockResolvedValue({
      cloudReady: true,
      preflight: {
        status: 'ready',
        summary: 'Cloud ready.',
        hint: 'Continue.',
        missingKeys: [],
      },
      run: {
        id: 'run-1',
        dateKey: '2026-05-08',
        status: 'completed',
        triggerType: 'manual',
        startedAt: '2026-05-08T09:00:00.000Z',
        summaryText: 'Generated 2 highlights',
        errorMessage: '',
      },
      candidates: [],
      selectedItems: [{ id: 'selected-1', candidateId: 'candidate-1', title: '站点稿件 A', status: 'completed' }],
      pushDigest: 'Digest',
      pushDecision: null,
      pushExecution: null,
      pushStatus: { feishu: false, wecom: false, wxpusher: false },
      currentPushLogs: [],
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
      recentLeadEvents: [],
      configuredChannels: [],
      allPushConfigs: [],
      timezone: 'Asia/Shanghai',
      dailyRunTime: '09:00',
      openaiBaseUrl: '',
      openaiApiKeyConfigured: false,
      historyRuns: [],
      artifacts: [],
    });

    const { default: HomePage } = await import('../app/page');
    const html = renderToStaticMarkup(await HomePage());

    expect(html).toContain('当前失败环节');
    expect(html).toContain('publish');
    expect(html).toContain('当前失败说明：网站发布失败：Build failed');
    expect(html).toContain('打开客户站');
    expect(html).toContain('异常恢复');
    expect(html).toContain('可在下方已生成条目中重新点击“发布到网站”。');
    expect(html).toContain('重新发布到网站');
  });

  it('renders launch readiness summary for cloud deployment', async () => {
    loadDashboardData.mockResolvedValue({
      cloudReady: true,
      preflight: {
        status: 'ready',
        environment: 'production',
        environmentLabel: '生产环境',
        summary: '云端环境已就绪，可直接连接数据库与对象存储。',
        hint: '可以开始执行上线前核对。',
        missingKeys: [],
      },
      run: {
        id: 'run-1',
        dateKey: '2026-05-08',
        status: 'completed',
        triggerType: 'manual',
        startedAt: '2026-05-08T09:00:00.000Z',
        summaryText: 'Generated 4 highlights',
        errorMessage: '',
      },
      candidates: [],
      selectedItems: [{ id: 'selected-1', candidateId: 'candidate-1', title: '站点稿件 A', status: 'completed' }],
      pushDigest: 'Digest',
      pushDecision: {
        runId: 'run-1',
        shouldPushToday: true,
        recommendedCandidateIds: ['candidate-strong', 'candidate-medium'],
        recommendedChannels: ['feishu', 'wecom'],
        reasonSummary: '建议推送 candidate-strong、candidate-medium，这些候选在规则评分下更适合今日分发。',
        candidateDecisions: [
          {
            candidateId: 'candidate-strong',
            action: 'push',
            scoreLabel: 'high',
            reasons: ['本地化适配信号较强'],
            suggestedChannels: ['feishu', 'wecom'],
          },
          {
            candidateId: 'candidate-low',
            action: 'hold',
            scoreLabel: 'low',
            reasons: ['综合得分 9，暂不具备明显优势'],
            suggestedChannels: [],
          },
        ],
        riskFlags: [],
      },
      pushExecution: {
        runId: 'run-1',
        status: { feishu: true, wecom: false, wxpusher: false },
        recommendedChannels: ['feishu', 'wecom'],
      },
      pushStatus: { feishu: true, wecom: false, wxpusher: false },
      currentPushLogs: [{ runId: 'run-1', channel: 'feishu', status: 'success', responseSummary: 'ok' }],
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
          publishedAt: '2026-05-08T09:31:00.000Z',
          reviewNotes: '',
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
          createdAt: '2026-05-08T09:32:00.000Z',
        },
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
      configuredChannels: ['feishu'],
      allPushConfigs: [{ channel: 'feishu', enabled: true, secretPayload: 'https://example.com/hook' }],
      timezone: 'Asia/Shanghai',
      dailyRunTime: '09:00',
      openaiBaseUrl: 'https://gateway.example.com/v1',
      openaiApiKeyConfigured: true,
      historyRuns: [
        {
          id: 'run-older-success',
          dateKey: '2026-05-07',
          status: 'completed',
          triggerType: 'cron',
          startedAt: '2026-05-07T09:00:00.000Z',
          selectedCount: 3,
          poolCount: 10,
          summaryText: 'Generated 3 highlights',
          errorMessage: '',
          artifacts: [],
          pushLogs: [],
          contentVariants: [],
          publicationLogs: [],
        },
        {
          id: 'run-older-failure',
          dateKey: '2026-05-06',
          status: 'failed',
          triggerType: 'cron',
          startedAt: '2026-05-06T09:00:00.000Z',
          selectedCount: 0,
          poolCount: 8,
          summaryText: '',
          errorMessage: 'timeout',
          artifacts: [],
          pushLogs: [],
          contentVariants: [],
          publicationLogs: [],
        },
      ],
      artifacts: [
        {
          artifactType: 'push_decision',
          publicUrl: 'https://cdn.example.com/push-decision.json',
          storagePath: 'runs/run-1/push-decision.json',
        },
        {
          artifactType: 'push_execution',
          publicUrl: 'https://cdn.example.com/push-execution.json',
          storagePath: 'runs/run-1/push-execution.json',
        },
      ],
    });

    const { default: HomePage } = await import('../app/page');
    const html = renderToStaticMarkup(await HomePage());

    expect(html).toContain('上线前检查');
    expect(html).toContain('当前环境：生产环境');
    expect(html).toContain('环境预检：云端环境已就绪，可直接连接数据库与对象存储。');
    expect(html).toContain('定时执行：Asia/Shanghai 09:00（cron 预览：0 1 * * *）');
    expect(html).toContain('推送渠道：已启用 1 个');
    expect(html).toContain('OpenAI 网关：https://gateway.example.com/v1');
    expect(html).toContain('上线判断：可以进入云端部署核对');
    expect(html).toContain('运行概览');
    expect(html).toContain('最近启动时间');
    expect(html).toContain('2026-05-08T09:00:00.000Z');
    expect(html).toContain('已配置推送通道');
    expect(html).toContain('最近摘要：Generated 4 highlights');
    expect(html).toContain('系统状态');
    expect(html).toContain('需要关注');
    expect((html.match(/最近一次历史运行失败，请先处理异常。/g) ?? [])).toHaveLength(1);
    expect(html).toContain('最近成功运行');
    expect(html).toContain('2026-05-08T09:00:00.000Z');
    expect(html).toContain('最近失败运行');
    expect(html).toContain('2026-05-06T09:00:00.000Z');
    expect(html).toContain('失败原因：timeout');
    expect(html).toContain('成稿产物');
    expect(html).toContain('待生成');
    expect(html).toContain('网站发布结果');
    expect(html).toContain('已发布站点稿件');
    expect(html).toContain('1 篇');
    expect(html).toContain('发布成功日志');
    expect(html).toContain('最近发布摘要：网站发布成功：Published to /posts/a');
    expect(html).toContain('最近转化事件');
    expect(html).toContain('2 条');
    expect(html).toContain('事件类型摘要');
    expect(html).toContain('subscribe、consult');
    expect(html).toContain('最近线索');
    expect(html).toContain('founder@example.com');
    expect(html).toContain('想看案例');
    expect(html).toContain('wechat-radar');
    expect(html).toContain('推送决策建议');
    expect(html).toContain('建议推送 candidate-strong、candidate-medium，这些候选在规则评分下更适合今日分发。');
    expect(html).toContain('推荐候选：candidate-strong、candidate-medium');
    expect(html).toContain('推荐渠道：feishu、wecom');
    expect(html).toContain('最近执行摘要');
    expect(html).toContain('feishu');
    expect(html).toContain('推荐执行结果');
    expect(html).toContain('执行摘要：推荐链路部分成功：成功通道 feishu；其余通道未成功。');
    expect(html).toContain('本次推荐渠道：feishu、wecom');
    expect(html).toContain('push_decision');
    expect(html).toContain('https://cdn.example.com/push-decision.json');
    expect(html).toContain('push_execution');
    expect(html).toContain('https://cdn.example.com/push-execution.json');
    expect(html).toContain('一键执行推荐');
    expect(html).toContain('采用推荐候选');
    expect(html).toContain('按推荐直接生成');
    expect(html).toContain('candidate-strong');
    expect(html).toContain('push / high');
    expect(html).toContain('candidate-low');
    expect(html).toContain('hold / low');
    expect(html).toContain('管理密钥');
    expect(html).toContain('打开客户站');
    expect(html).toContain('从网站下线');
  });
});
