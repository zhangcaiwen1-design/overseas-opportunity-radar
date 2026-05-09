import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const loadHistoryData = vi.fn();
const loadDashboardData = vi.fn();

vi.mock('../src/cloud/queries/loadHistoryData', () => ({
  loadHistoryData,
}));

vi.mock('../src/cloud/queries/loadDashboardData', () => ({
  loadDashboardData,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe('HistoryPage', () => {
  it('renders overview cards, filters, and each run start time from history data query', async () => {
    loadHistoryData.mockResolvedValue([
      {
        id: 'run-2',
        dateKey: '2026-05-08',
        status: 'completed',
        startedAt: '2026-05-08T02:00:00.000Z',
        selectedCount: 4,
        poolCount: 10,
        summaryText: '生成了 4 条成稿',
        errorMessage: '',
        artifacts: [
          {
            artifactType: 'push_execution',
            publicUrl: 'https://cdn.example.com/push-execution.json',
            storagePath: 'runs/2026-05-08/push-execution.json',
          },
        ],
        pushLogs: [],
        contentVariants: [
          {
            id: 'variant-1',
            runId: 'run-2',
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
        id: 'run-1',
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
      {
        id: 'run-generate-failed',
        dateKey: '2026-05-06',
        status: 'failed',
        startedAt: '2026-05-06T04:00:00.000Z',
        selectedCount: 2,
        poolCount: 9,
        summaryText: '',
        errorMessage: 'generate timeout',
        artifacts: [],
        pushLogs: [],
        contentVariants: [],
        publicationLogs: [],
      },
      {
        id: 'run-push-failed',
        dateKey: '2026-05-06',
        status: 'failed',
        startedAt: '2026-05-06T03:00:00.000Z',
        selectedCount: 2,
        poolCount: 7,
        summaryText: '生成了 2 条成稿',
        errorMessage: 'push timeout',
        artifacts: [
          {
            artifactType: 'selected_html',
            publicUrl: 'https://cdn.example.com/selected-html.html',
            storagePath: 'runs/2026-05-06/selected-html.html',
          },
        ],
        pushLogs: [
          {
            runId: 'run-push-failed',
            channel: 'feishu',
            status: 'failed',
            responseSummary: 'timeout',
          },
        ],
        contentVariants: [],
        publicationLogs: [],
      },
      {
        id: 'run-0',
        dateKey: '2026-05-06',
        status: 'completed',
        startedAt: '2026-05-06T02:00:00.000Z',
        selectedCount: 1,
        poolCount: 6,
        summaryText: '生成了 1 条成稿',
        errorMessage: '',
        artifacts: [],
        pushLogs: [],
        contentVariants: [
          {
            id: 'variant-2',
            runId: 'run-0',
            candidateId: 'candidate-2',
            selectedItemId: 'selected-2',
            channel: 'site',
            title: '站点稿件 B',
            body: 'body-b',
            status: 'failed',
            reviewNotes: '发布失败',
          },
        ],
        publicationLogs: [
          {
            id: 'publication-log-2',
            contentVariantId: 'variant-2',
            channel: 'site',
            action: 'publish',
            status: 'failed',
            responseSummary: 'Build failed',
            operator: 'system',
            createdAt: '2026-05-06T02:16:00.000Z',
          },
        ],
      },
    ]);

    const { default: HistoryPage } = await import('../app/history/page');
    const html = renderToStaticMarkup(await HistoryPage());

    expect(loadHistoryData).toHaveBeenCalledTimes(1);
    expect(loadDashboardData).not.toHaveBeenCalled();
    expect(html).toContain('运行总数');
    expect(html).toContain('成功运行');
    expect(html).toContain('失败运行');
    expect(html).toContain('筛选结果：5 条');
    expect(html).toContain('搜索日期、摘要、错误、推送渠道');
    expect(html).toContain('开始时间：2026-05-08T02:00:00.000Z');
    expect(html).toContain('推送执行结果');
    expect(html).toContain('发布结果');
    expect(html).toContain('已发布站点稿件 1 篇');
    expect(html).toContain('site｜publish｜success');
    expect(html).toContain('Published to /posts/a');
    expect(html).toContain('失败定位：run failed：timeout');
    expect(html).toContain('generate timeout');
    expect(html).toContain('重新生成');
    expect(html).toContain('重新采集');
    expect((html.match(/重新生成/g) ?? []).length).toBeGreaterThanOrEqual(1);
    expect((html.match(/重新采集/g) ?? []).length).toBeGreaterThanOrEqual(1);
    expect(html).toContain('推送 feishu｜failed');
    expect(html).toContain('重新推送');
    expect(html).toContain('site publish failed：Build failed');
    expect(html).toContain('重新发布到网站');
    expect(html).toContain('当前没有发布记录。');
  });
});
