import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { DashboardActions } from '../app/DashboardActions';
import { buildTodayDashboardViewModel } from '../src/cloud/viewmodels/buildTodayDashboardViewModel';
import {
  applyRecommendedSelection,
  buildRecommendedGenerateSelection,
  buildRecoveryAction,
  canExecuteRecommendedFlow,
  formatRecommendedFlowStatus,
  summarizePushExecutionStatus,
  buildTransientPreviewState,
  deriveRecommendedCandidateIds,
} from '../app/dashboardSelection';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe('dashboard actions view model integration', () => {
  it('keeps manual collect available when cloud summary is degraded', () => {
    const html = renderToStaticMarkup(
      createElement(DashboardActions, {
        runId: 'uninitialized',
        candidateRows: [],
        selectedRows: [],
        artifactLinks: [],
        pushDigest: '今日还没有推送文稿。',
        pushDecision: null,
        pushExecution: null,
        pushChannelStatuses: [],
        recoveryAction: '',
        recoverySelectedItemId: '',
        cloudReady: false,
      }),
    );

    expect(html).toContain('手动采集');
    expect(html).toContain('当前无法读取现有云端运行数据');
    expect(html).not.toContain('disabled="">手动采集');
    expect(html).toContain('disabled="">一键执行推荐');
  });

  it('applies recommended candidate ids in stable order', () => {
    expect(
      applyRecommendedSelection({
        candidateRows: [
          {
            id: 'candidate-2',
            title: 'Lead Board',
            source: 'rss',
            summary: 'lead summary',
            rank: 2,
            selectionState: 'pending',
            tags: ['lead', 'crm'],
            canonicalUrl: 'https://example.com/2',
          },
          {
            id: 'candidate-1',
            title: 'Signal One',
            source: 'github',
            summary: 'summary',
            rank: 1,
            selectionState: 'selected',
            tags: ['ops'],
            canonicalUrl: 'https://example.com/1',
          },
          {
            id: 'candidate-3',
            title: 'Ignored',
            source: 'github',
            summary: 'ignored summary',
            rank: 3,
            selectionState: 'pending',
            tags: ['other'],
            canonicalUrl: 'https://example.com/3',
          },
        ],
        recommendedCandidateIds: ['candidate-1', 'candidate-2', 'candidate-missing', 'candidate-1'],
      }),
    ).toEqual(['candidate-1', 'candidate-2']);
  });

  it('prefers recommended selection for direct generate when available', () => {
    expect(
      buildRecommendedGenerateSelection({
        selectedCandidateIds: ['manual-1'],
        recommendedCandidateIds: ['candidate-1', 'candidate-2'],
      }),
    ).toEqual(['candidate-1', 'candidate-2']);

    expect(
      buildRecommendedGenerateSelection({
        selectedCandidateIds: ['manual-1', 'manual-2'],
        recommendedCandidateIds: [],
      }),
    ).toEqual(['manual-1', 'manual-2']);
  });

  it('allows recommended one-click execution only when today should push and candidates exist', () => {
    expect(
      canExecuteRecommendedFlow({
        shouldPushToday: true,
        recommendedCandidateIds: ['candidate-1'],
        selectedCandidateIds: [],
      }),
    ).toBe(true);

    expect(
      canExecuteRecommendedFlow({
        shouldPushToday: false,
        recommendedCandidateIds: ['candidate-1'],
        selectedCandidateIds: [],
      }),
    ).toBe(false);

    expect(
      canExecuteRecommendedFlow({
        shouldPushToday: true,
        recommendedCandidateIds: [],
        selectedCandidateIds: [],
      }),
    ).toBe(false);
  });

  it('formats staged status messages for recommended flow', () => {
    expect(formatRecommendedFlowStatus({ stage: 'selecting' })).toBe('正在执行推荐链路：应用推荐候选...');
    expect(formatRecommendedFlowStatus({ stage: 'generating' })).toBe('正在执行推荐链路：生成成稿...');
    expect(formatRecommendedFlowStatus({ stage: 'pushing' })).toBe('正在执行推荐链路：推送内容...');
    expect(formatRecommendedFlowStatus({ stage: 'completed' })).toBe('推荐链路已执行，正在刷新结果...');
    expect(formatRecommendedFlowStatus({ stage: 'failed', reason: 'push failed' })).toBe('推荐链路执行失败：push failed');
  });

  it('summarizes push execution status for full, partial, and empty success cases', () => {
    expect(summarizePushExecutionStatus({ feishu: true, wecom: true, wxpusher: false })).toBe('推荐链路部分成功：成功通道 feishu、wecom；其余通道未成功。');
    expect(summarizePushExecutionStatus({ feishu: true, wecom: false, wxpusher: false })).toBe('推荐链路部分成功：成功通道 feishu；其余通道未成功。');
    expect(summarizePushExecutionStatus({ feishu: false, wecom: false, wxpusher: false })).toBe('推荐链路未找到成功推送通道。');
  });

  it('hides stale generated and push preview blocks while a selection refresh is pending', () => {
    expect(
      buildTransientPreviewState({
        hasPendingSelectionRefresh: true,
        selectedRows: [{ id: 'selected-1', candidateId: 'candidate-1', title: '精选一', status: 'completed' }],
        artifactLinks: [
          { label: 'selected_html', href: 'https://cdn.example.com/selected.html' },
          { label: 'push_digest', href: 'https://cdn.example.com/push.txt' },
          { label: 'push_execution', href: 'https://cdn.example.com/push-execution.json' },
        ],
        pushDigest: '旧推送文稿',
        pushDecision: {
          shouldPushToday: true,
          reasonSummary: '建议推送',
          recommendedCandidateIds: ['candidate-1'],
          recommendedChannels: ['feishu'],
          candidateDecisions: [],
          riskFlags: [],
        },
        pushExecution: {
          summary: '推荐链路部分成功：成功通道 feishu；其余通道未成功。',
          recommendedChannels: ['feishu'],
        },
        pushChannelStatuses: [{ channel: 'feishu', status: 'success', responseSummary: 'ok' }],
      }),
    ).toEqual({
      selectedRows: [],
      artifactLinks: [],
      pushDigest: '选稿已变更，等待重新生成最新推送文稿。',
      pushDecision: null,
      pushExecution: null,
      pushChannelStatuses: [],
    });

    expect(
      deriveRecommendedCandidateIds({
        candidateRows: [
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
        pushDecision: {
          shouldPushToday: true,
          reasonSummary: '建议推送',
          recommendedCandidateIds: ['candidate-1'],
          recommendedChannels: ['feishu'],
          candidateDecisions: [],
          riskFlags: [],
        },
        hasPendingSelectionRefresh: true,
      }),
    ).toEqual([]);
  });

  it('builds recovery actions for collect and publish failures', () => {
    expect(buildRecoveryAction({ recoveryAction: 'collect', recoverySelectedItemId: '' })).toEqual({
      type: 'collect',
      label: '重新采集',
    });

    expect(buildRecoveryAction({ recoveryAction: 'publish', recoverySelectedItemId: 'selected-1' })).toEqual({
      type: 'publish',
      label: '重新发布到网站',
      selectedItemId: 'selected-1',
    });

    expect(buildRecoveryAction({ recoveryAction: '', recoverySelectedItemId: '' })).toBeNull();
  });

  it('keeps candidate and selected rows available for dashboard actions', () => {
    const viewModel = buildTodayDashboardViewModel({
      run: { id: 'run-1', dateKey: '2026-05-08', status: 'completed', triggerType: 'manual' },
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
        {
          id: 'candidate-2',
          title: 'Lead Board',
          source: 'rss',
          summary: 'lead summary',
          rank: 2,
          selectionState: 'pending',
          tags: ['lead', 'crm'],
          canonicalUrl: 'https://example.com/2',
        },
      ],
      selectedItems: [{ id: 'selected-1', candidateId: 'candidate-1', title: '精选一', status: 'published' }],
      artifacts: [{ artifactType: 'selected_html', publicUrl: 'https://cdn.example.com/selected.html' }],
      pushDigest: '今日海外商业机会雷达｜2026-05-08',
      pushStatus: { feishu: true, wecom: false, wxpusher: false },
      pushLogs: [{ runId: 'run-1', channel: 'feishu', status: 'success', responseSummary: 'ok' }],
    });

    expect(viewModel.statusCard.runId).toBe('run-1');
    expect(viewModel.candidateRows[0].id).toBe('candidate-1');
    expect(viewModel.candidateRows[0].canonicalUrl).toBe('https://example.com/1');
    expect(viewModel.candidateRows[1].tags).toContain('crm');
    expect(viewModel.selectedRows[0].candidateId).toBe('candidate-1');
    expect(viewModel.artifactLinks[0].label).toBe('selected_html');
    expect(viewModel.pushPreview.body).toContain('2026-05-08');
    expect(viewModel.pushPreview.channelStatuses).toEqual([
      { channel: 'feishu', status: 'success', responseSummary: 'ok' },
      { channel: 'wecom', status: 'not_configured', responseSummary: '' },
      { channel: 'wxpusher', status: 'not_configured', responseSummary: '' },
    ]);
  });
});
