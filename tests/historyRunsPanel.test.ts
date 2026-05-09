import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { filterHistoryRows, HistoryRunsPanel } from '../app/history/HistoryRunsPanel';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe('HistoryRunsPanel', () => {
  const rows = [
    {
      id: 'run-completed',
      dateKey: '2026-05-08',
      startedAt: '2026-05-08T02:00:00.000Z',
      status: 'completed',
      selectedCount: 4,
      poolCount: 10,
      summaryText: '生成了 4 条成稿',
      errorMessage: '',
      recoveryAction: '',
      recoverySelectedItemId: '',
      pushLogs: [{ channel: 'feishu', status: 'success', responseSummary: 'ok' }],
      publishedSummary: { publishedCount: 1, logCount: 1, latestStatusSummary: 'site publish success：Published to /posts/a' },
      publicationLogs: [{ channel: 'site', action: 'publish', status: 'success', responseSummary: 'Published to /posts/a' }],
      artifactGroups: [{ artifactType: 'push_execution', title: '推送执行结果', links: [{ label: '推送执行结果', href: 'https://cdn.example.com/a' }] }],
    },
    {
      id: 'run-failed',
      dateKey: '2026-05-07',
      startedAt: '2026-05-07T02:00:00.000Z',
      status: 'failed',
      selectedCount: 1,
      poolCount: 8,
      summaryText: '',
      errorMessage: 'timeout',
      recoveryAction: 'collect',
      recoverySelectedItemId: '',
      pushLogs: [],
      publishedSummary: { publishedCount: 0, logCount: 1, latestStatusSummary: 'site retry failed：retry later' },
      publicationLogs: [{ channel: 'site', action: 'retry', status: 'failed', responseSummary: 'retry later' }],
      artifactGroups: [],
    },
    {
      id: 'run-publish-failed',
      dateKey: '2026-05-06',
      startedAt: '2026-05-06T02:00:00.000Z',
      status: 'completed',
      selectedCount: 1,
      poolCount: 6,
      summaryText: '生成了 1 条成稿',
      errorMessage: '',
      recoveryAction: 'publish',
      recoverySelectedItemId: 'selected-2',
      pushLogs: [],
      publishedSummary: { publishedCount: 0, logCount: 1, latestStatusSummary: 'site publish failed：build failed' },
      publicationLogs: [{ channel: 'site', action: 'publish', status: 'failed', responseSummary: 'build failed' }],
      artifactGroups: [],
    },
  ];

  it('renders search and status controls for history filtering', () => {
    const html = renderToStaticMarkup(React.createElement(HistoryRunsPanel, { rows }));

    expect(html).toContain('搜索日期、摘要、错误、推送渠道、发布日志');
    expect(html).toContain('全部状态');
    expect(html).toContain('completed');
    expect(html).toContain('failed');
    expect(html).toContain('重新采集');
    expect(html).toContain('重新发布到网站');
  });

  it('filters rows by publish log text search', () => {
    const filtered = filterHistoryRows(rows, 'retry later', 'all');

    expect(filtered.map((row) => row.id)).toEqual(['run-failed']);
  });

  it('filters rows by completed and failed statuses', () => {
    expect(filterHistoryRows(rows, '', 'completed').map((row) => row.id)).toEqual(['run-completed', 'run-publish-failed']);
    expect(filterHistoryRows(rows, '', 'failed').map((row) => row.id)).toEqual(['run-failed']);
  });
});
