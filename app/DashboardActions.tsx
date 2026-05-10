'use client';

import { useRouter } from 'next/navigation';
import React, { useEffect, useMemo, useState } from 'react';
import { ADMIN_SECRET_STORAGE_KEY, buildAdminHeaders, hasAdminSecret } from './adminSecret';
import {
  applyBulkSelection,
  buildDraftSortOrderUpdates,
  buildRecommendedGenerateSelection,
  canExecuteRecommendedFlow,
  deriveRecommendedCandidateIds,
  formatRecommendedFlowStatus,
  summarizePushExecutionStatus,
  buildRecoveryAction,
  buildSelectedCandidateDraft,
  buildTransientPreviewState,
  filterAndSortCandidates,
  moveSelectedCandidate,
  type CandidateSelectionFilter,
  type CandidateSortMode,
} from './dashboardSelection';

interface CandidateRow {
  id: string;
  title: string;
  source: string;
  summary: string;
  rank: number;
  draftSortOrder?: number;
  selectionState: string;
  tags: string[];
  canonicalUrl: string;
}

interface SelectedRow {
  id: string;
  title: string;
  status: string;
  sitePublicationStatus?: string;
}

interface PushDecisionViewModel {
  shouldPushToday: boolean;
  reasonSummary: string;
  recommendedCandidateIds: string[];
  recommendedChannels: string[];
  candidateDecisions: Array<{
    candidateId: string;
    action: 'push' | 'hold';
    scoreLabel: 'high' | 'medium' | 'low';
    reasons: string[];
    suggestedChannels: string[];
  }>;
  riskFlags: string[];
}

interface PushExecutionViewModel {
  summary: string;
  recommendedChannels: string[];
}

export function DashboardActions(input: {
  runId: string;
  candidateRows: CandidateRow[];
  selectedRows: SelectedRow[];
  artifactLinks: Array<{ label: string; href: string }>;
  pushDigest: string;
  pushDecision?: PushDecisionViewModel | null;
  pushExecution?: PushExecutionViewModel | null;
  pushChannelStatuses?: Array<{ channel: string; status: string; responseSummary: string }>;
  recoveryAction?: '' | 'collect' | 'generate' | 'push' | 'publish';
  recoverySelectedItemId?: string;
  cloudReady: boolean;
}) {
  const router = useRouter();
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>(
    input.candidateRows.filter((candidate) => candidate.selectionState === 'selected').map((candidate) => candidate.id),
  );
  const [adminSecret, setAdminSecret] = useState('');
  const [generateStatus, setGenerateStatus] = useState('');
  const [pushStatus, setPushStatus] = useState('');
  const [publishSiteStatus, setPublishSiteStatus] = useState('');
  const [collectStatus, setCollectStatus] = useState('');
  const [selectionStatus, setSelectionStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectionFilter, setSelectionFilter] = useState<CandidateSelectionFilter>('all');
  const [sortMode, setSortMode] = useState<CandidateSortMode>('rank-asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [isPublishingSite, setIsPublishingSite] = useState(false);
  const [isCollecting, setIsCollecting] = useState(false);
  const [pendingSelectionId, setPendingSelectionId] = useState('');
  const [hasPendingSelectionRefresh, setHasPendingSelectionRefresh] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    setAdminSecret(window.localStorage.getItem(ADMIN_SECRET_STORAGE_KEY) ?? '');
  }, []);

  useEffect(() => {
    setHasPendingSelectionRefresh(false);
  }, [input.selectedRows, input.artifactLinks, input.pushDigest, input.pushDecision, input.pushExecution, input.pushChannelStatuses]);

  const filteredCandidates = useMemo(
    () =>
      filterAndSortCandidates({
        candidates: input.candidateRows,
        searchQuery,
        selectionFilter,
        sortMode,
      }),
    [input.candidateRows, searchQuery, selectionFilter, sortMode],
  );
  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(filteredCandidates.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pagedCandidates = useMemo(
    () => filteredCandidates.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filteredCandidates, safePage],
  );
  const visibleCandidateIds = useMemo(() => pagedCandidates.map((candidate) => candidate.id), [pagedCandidates]);

  const selectedDraft = useMemo(
    () => buildSelectedCandidateDraft(input.candidateRows, selectedCandidateIds),
    [input.candidateRows, selectedCandidateIds],
  );
  const transientPreviewState = useMemo(
    () =>
      buildTransientPreviewState({
        hasPendingSelectionRefresh,
        selectedRows: input.selectedRows,
        artifactLinks: input.artifactLinks,
        pushDigest: input.pushDigest,
        pushDecision: input.pushDecision,
        pushExecution: input.pushExecution,
        pushChannelStatuses: input.pushChannelStatuses,
      }),
    [hasPendingSelectionRefresh, input.selectedRows, input.artifactLinks, input.pushDigest, input.pushDecision, input.pushExecution, input.pushChannelStatuses],
  );
  const recommendedCandidateIds = useMemo(
    () =>
      deriveRecommendedCandidateIds({
        candidateRows: input.candidateRows,
        pushDecision: input.pushDecision,
        hasPendingSelectionRefresh,
      }),
    [input.candidateRows, input.pushDecision, hasPendingSelectionRefresh],
  );
  const recommendedGenerateSelection = useMemo(
    () => buildRecommendedGenerateSelection({ selectedCandidateIds, recommendedCandidateIds }),
    [selectedCandidateIds, recommendedCandidateIds],
  );
  const canCollect = !isCollecting;
  const canGenerate = input.cloudReady && input.runId !== 'uninitialized' && selectedCandidateIds.length > 0 && !isGenerating;
  const canGenerateRecommended = input.cloudReady && input.runId !== 'uninitialized' && recommendedGenerateSelection.length > 0 && !isGenerating;
  const canExecuteRecommendation =
    input.cloudReady &&
    input.runId !== 'uninitialized' &&
    !isGenerating &&
    !isPushing &&
    canExecuteRecommendedFlow({
      shouldPushToday: transientPreviewState.pushDecision?.shouldPushToday ?? false,
      recommendedCandidateIds,
      selectedCandidateIds,
    });
  const canPush = input.cloudReady && input.runId !== 'uninitialized' && transientPreviewState.selectedRows.length > 0 && !isPushing;
  const recoveryAction = useMemo(
    () => buildRecoveryAction({ recoveryAction: input.recoveryAction ?? '', recoverySelectedItemId: input.recoverySelectedItemId ?? '' }),
    [input.recoveryAction, input.recoverySelectedItemId],
  );

  function ensureAdminSecret() {
    if (!hasAdminSecret(adminSecret)) {
      const message = '请先输入管理密钥 ADMIN_SECRET';
      setCollectStatus(message);
      setSelectionStatus(message);
      setGenerateStatus(message);
      setPushStatus(message);
      setPublishSiteStatus(message);
      return false;
    }

    window.localStorage.setItem(ADMIN_SECRET_STORAGE_KEY, adminSecret.trim());
    return true;
  }
  const selectedCountLabel = useMemo(() => `${selectedCandidateIds.length} 条`, [selectedCandidateIds]);

  async function updateCandidateSelection(candidateId: string, selectionState: 'pending' | 'selected' | 'discarded') {
    if (!ensureAdminSecret()) {
      return;
    }

    setPendingSelectionId(candidateId);
    setSelectionStatus('正在保存筛选状态...');

    try {
      const nextSelectedIds =
        selectionState === 'selected'
          ? selectedCandidateIds.includes(candidateId)
            ? selectedCandidateIds
            : [...selectedCandidateIds, candidateId]
          : selectedCandidateIds.filter((id) => id !== candidateId);
      const draftSortOrder =
        selectionState === 'selected' ? Math.max(0, nextSelectedIds.indexOf(candidateId)) : undefined;
      const response = await fetch(`/api/runs/${input.runId}/candidates/${candidateId}/selection`, {
        method: 'POST',
        headers: buildAdminHeaders(adminSecret, 'application/json'),
        body: JSON.stringify({ selectionState, draftSortOrder }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.reason ?? 'selection update failed');
      }

      setSelectedCandidateIds(nextSelectedIds);
      setHasPendingSelectionRefresh(true);
      setSelectionStatus(
        selectionState === 'selected'
          ? '已加入精选，正在刷新结果...'
          : selectionState === 'discarded'
            ? '已标记为丢弃，正在刷新结果...'
            : '已恢复为待定，正在刷新结果...',
      );
      router.refresh();
    } catch (error) {
      setSelectionStatus(error instanceof Error ? error.message : '筛选状态保存失败');
    } finally {
      setPendingSelectionId('');
    }
  }

  async function persistDraftSortOrder(nextSelectedIds: string[]) {
    if (!ensureAdminSecret()) {
      throw new Error('请先输入管理密钥 ADMIN_SECRET');
    }

    for (const update of buildDraftSortOrderUpdates(nextSelectedIds)) {
      const response = await fetch(`/api/runs/${input.runId}/candidates/${update.candidateId}/selection`, {
        method: 'POST',
        headers: buildAdminHeaders(adminSecret, 'application/json'),
        body: JSON.stringify({ selectionState: 'selected', draftSortOrder: update.draftSortOrder }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.reason ?? 'persist draft order failed');
      }
    }
  }

  async function handleApplyRecommendation() {
    if (!ensureAdminSecret()) {
      return;
    }

    if (recommendedCandidateIds.length === 0) {
      setSelectionStatus('当前没有可直接采用的推荐候选。');
      return;
    }

    setSelectionStatus('正在采用推荐候选...');

    try {
      for (const [draftSortOrder, candidateId] of recommendedCandidateIds.entries()) {
        const response = await fetch(`/api/runs/${input.runId}/candidates/${candidateId}/selection`, {
          method: 'POST',
          headers: buildAdminHeaders(adminSecret, 'application/json'),
          body: JSON.stringify({ selectionState: 'selected', draftSortOrder }),
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.reason ?? 'apply recommendation failed');
        }
      }

      setSelectedCandidateIds(recommendedCandidateIds);
      setSelectionStatus(`已采用推荐候选 ${recommendedCandidateIds.length} 条，正在刷新结果...`);
      router.refresh();
    } catch (error) {
      setSelectionStatus(error instanceof Error ? error.message : '采用推荐候选失败');
    }
  }

  async function handleBulkDiscard() {
    if (!ensureAdminSecret()) {
      return;
    }

    setSelectionStatus('正在批量标记丢弃...');

    try {
      for (const candidateId of visibleCandidateIds) {
        const response = await fetch(`/api/runs/${input.runId}/candidates/${candidateId}/selection`, {
          method: 'POST',
          headers: buildAdminHeaders(adminSecret, 'application/json'),
          body: JSON.stringify({ selectionState: 'discarded' }),
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.reason ?? 'bulk discard failed');
        }
      }

      const nextSelectedIds = applyBulkSelection({ selectedCandidateIds, visibleCandidateIds, action: 'discard' });
      setSelectedCandidateIds(nextSelectedIds);
      setHasPendingSelectionRefresh(true);
      await persistDraftSortOrder(nextSelectedIds);
      setSelectionStatus(`已批量丢弃本页 ${visibleCandidateIds.length} 条，正在刷新结果...`);
      router.refresh();
    } catch (error) {
      setSelectionStatus(error instanceof Error ? error.message : '批量丢弃失败');
    }
  }

  async function handleGenerate(selectedCandidateIdsForGenerate = selectedCandidateIds) {
    if (!ensureAdminSecret()) {
      return;
    }

    setIsGenerating(true);
    setGenerateStatus('正在生成成稿...');

    try {
      const response = await fetch(`/api/runs/${input.runId}/generate`, {
        method: 'POST',
        headers: buildAdminHeaders(adminSecret, 'application/json'),
        body: JSON.stringify({ selectedCandidateIds: selectedCandidateIdsForGenerate }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.reason ?? 'generate failed');
      }

      setGenerateStatus(`已生成 ${payload.selectedCount} 条成稿，正在刷新结果...`);
      setSelectedCandidateIds([]);
      router.refresh();
    } catch (error) {
      setGenerateStatus(error instanceof Error ? error.message : '生成失败');
    } finally {
      setIsGenerating(false);
    }
  }

  async function handlePush() {
    if (!ensureAdminSecret()) {
      return;
    }

    setIsPushing(true);
    setPushStatus('正在推送...');

    try {
      const response = await fetch(`/api/runs/${input.runId}/push`, { method: 'POST', headers: buildAdminHeaders(adminSecret) });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.reason ?? 'push failed');
      }

      const channels = Object.entries(payload.status ?? {})
        .filter(([, ok]) => Boolean(ok))
        .map(([channel]) => channel)
        .join('、');
      setPushStatus(channels ? `推送成功：${channels}，正在刷新结果...` : '没有可用推送通道。');
      router.refresh();
      return payload.status as { feishu: boolean; wecom: boolean; wxpusher: boolean };
    } catch (error) {
      setPushStatus(error instanceof Error ? error.message : '推送失败');
      throw error;
    } finally {
      setIsPushing(false);
    }
  }

  async function handleExecuteRecommendation() {
    if (!ensureAdminSecret()) {
      return;
    }

    setSelectionStatus(formatRecommendedFlowStatus({ stage: 'selecting' }));

    try {
      if (recommendedCandidateIds.length > 0) {
        for (const [draftSortOrder, candidateId] of recommendedCandidateIds.entries()) {
          const response = await fetch(`/api/runs/${input.runId}/candidates/${candidateId}/selection`, {
            method: 'POST',
            headers: buildAdminHeaders(adminSecret, 'application/json'),
            body: JSON.stringify({ selectionState: 'selected', draftSortOrder }),
          });
          const payload = await response.json();

          if (!response.ok) {
            throw new Error(payload.reason ?? 'apply recommendation failed');
          }
        }

        setSelectedCandidateIds(recommendedCandidateIds);
      }

      setGenerateStatus(formatRecommendedFlowStatus({ stage: 'generating' }));
      await handleGenerate(recommendedGenerateSelection);
      setPushStatus(formatRecommendedFlowStatus({ stage: 'pushing' }));
      const pushStatus = await handlePush();
      setSelectionStatus(pushStatus ? summarizePushExecutionStatus(pushStatus) : formatRecommendedFlowStatus({ stage: 'completed' }));
    } catch (error) {
      setSelectionStatus(
        formatRecommendedFlowStatus({ stage: 'failed', reason: error instanceof Error ? error.message : '执行推荐链路失败' }),
      );
    }
  }

  async function handleCollect() {
    if (!ensureAdminSecret()) {
      return;
    }

    setIsCollecting(true);
    setCollectStatus('正在采集...');

    try {
      const response = await fetch('/api/runs/manual-collect', { method: 'POST', headers: buildAdminHeaders(adminSecret) });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.reason ?? 'collect failed');
      }

      setCollectStatus(`采集完成，候选 ${payload.poolCount} 条，正在刷新结果...`);
      router.refresh();
    } catch (error) {
      setCollectStatus(error instanceof Error ? error.message : '采集失败');
    } finally {
      setIsCollecting(false);
    }
  }

  async function handleRecoveryAction() {
    if (!recoveryAction) {
      return;
    }

    if (recoveryAction.type === 'collect') {
      await handleCollect();
      return;
    }

    if (recoveryAction.type === 'generate') {
      await handleGenerate();
      return;
    }

    if (recoveryAction.type === 'push') {
      await handlePush();
      return;
    }

    if (recoveryAction.type === 'publish') {
      await handlePublishSite(recoveryAction.selectedItemId);
    }
  }

  async function handlePublishSite(selectedItemId: string) {
    if (!ensureAdminSecret()) {
      return;
    }

    setIsPublishingSite(true);
    setPublishSiteStatus('正在发布到网站...');

    try {
      const response = await fetch(`/api/runs/${input.runId}/publish-site`, {
        method: 'POST',
        headers: buildAdminHeaders(adminSecret, 'application/json'),
        body: JSON.stringify({ selectedItemId }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.reason ?? 'publish site failed');
      }

      setPublishSiteStatus('已发布到网站，正在刷新结果...');
      router.refresh();
    } catch (error) {
      setPublishSiteStatus(error instanceof Error ? error.message : '网站发布失败');
    } finally {
      setIsPublishingSite(false);
    }
  }

  async function handleWithdrawSite(selectedItemId: string) {
    if (!ensureAdminSecret()) {
      return;
    }

    setIsPublishingSite(true);
    setPublishSiteStatus('正在从网站下线...');

    try {
      const response = await fetch(`/api/runs/${input.runId}/withdraw-site`, {
        method: 'POST',
        headers: buildAdminHeaders(adminSecret, 'application/json'),
        body: JSON.stringify({ selectedItemId }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.reason ?? 'withdraw site failed');
      }

      setPublishSiteStatus('已从网站下线，正在刷新结果...');
      router.refresh();
    } catch (error) {
      setPublishSiteStatus(error instanceof Error ? error.message : '网站下线失败');
    } finally {
      setIsPublishingSite(false);
    }
  }

  return (
    <div className="dashboard-actions">
      <div className="dashboard-toolbar">
        <input
          value={adminSecret}
          onChange={(event) => setAdminSecret(event.target.value)}
          placeholder="管理密钥 ADMIN_SECRET"
          type="password"
        />
        <button type="button" onClick={handleCollect} disabled={!canCollect}>
          {isCollecting ? '采集中...' : '手动采集'}
        </button>
        <button
          type="button"
          onClick={handleExecuteRecommendation}
          disabled={!canExecuteRecommendation}
        >
          一键执行推荐
        </button>
        <button
          type="button"
          onClick={handleApplyRecommendation}
          disabled={!input.cloudReady || input.runId === 'uninitialized' || recommendedCandidateIds.length === 0}
        >
          采用推荐候选
        </button>
        <button
          type="button"
          onClick={() => handleGenerate(recommendedGenerateSelection)}
          disabled={!canGenerateRecommended}
        >
          {isGenerating ? '生成中...' : '按推荐直接生成'}
        </button>
        <button type="button" onClick={() => handleGenerate()} disabled={!canGenerate}>
          {isGenerating ? '生成中...' : `生成成稿（${selectedCountLabel}）`}
        </button>
        <button type="button" onClick={handlePush} disabled={!canPush}>
          {isPushing ? '推送中...' : '手动推送'}
        </button>
        {recoveryAction ? (
          <button type="button" onClick={handleRecoveryAction} disabled={!input.cloudReady || input.runId === 'uninitialized'}>
            {recoveryAction.label}
          </button>
        ) : null}
      </div>

      <div className="action-status-group">
        {!input.cloudReady ? <p className="action-status">当前无法读取现有云端运行数据。你仍可手动采集重新建立一轮数据，但生成、推送、发布会继续禁用，直到云端预检恢复正常。</p> : null}
        {collectStatus ? <p className="action-status">{collectStatus}</p> : null}
        {selectionStatus ? <p className="action-status">{selectionStatus}</p> : null}
        {generateStatus ? <p className="action-status">{generateStatus}</p> : null}
        {pushStatus ? <p className="action-status">{pushStatus}</p> : null}
        {publishSiteStatus ? <p className="action-status">{publishSiteStatus}</p> : null}
      </div>

      <article className="card card--hero">
        <h2>候选池手动选稿</h2>
        <p>勾选想做成成稿的候选，再直接触发生成。</p>
        <div className="candidate-toolbar">
          <input
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setCurrentPage(1);
            }}
            placeholder="搜索标题、摘要、来源、标签"
          />
          <button
            type="button"
            onClick={() => setSelectedCandidateIds((current) => applyBulkSelection({ selectedCandidateIds: current, visibleCandidateIds, action: 'select' }))}
            disabled={visibleCandidateIds.length === 0 || !input.cloudReady || input.runId === 'uninitialized'}
          >
            本页全选
          </button>
          <button
            type="button"
            onClick={() => setSelectedCandidateIds((current) => applyBulkSelection({ selectedCandidateIds: current, visibleCandidateIds, action: 'clear' }))}
            disabled={visibleCandidateIds.length === 0 || !input.cloudReady || input.runId === 'uninitialized'}
          >
            本页清空
          </button>
          <button
            type="button"
            onClick={handleBulkDiscard}
            disabled={visibleCandidateIds.length === 0 || !input.cloudReady || input.runId === 'uninitialized'}
          >
            本页丢弃
          </button>
          <select
            value={selectionFilter}
            onChange={(event) => {
              setSelectionFilter(event.target.value as CandidateSelectionFilter);
              setCurrentPage(1);
            }}
          >
            <option value="all">全部状态</option>
            <option value="pending">待定</option>
            <option value="selected">已精选</option>
            <option value="discarded">已丢弃</option>
          </select>
          <select
            value={sortMode}
            onChange={(event) => {
              setSortMode(event.target.value as CandidateSortMode);
              setCurrentPage(1);
            }}
          >
            <option value="rank-asc">分数顺序：高优先</option>
            <option value="rank-desc">分数顺序：低优先</option>
            <option value="title-asc">标题 A-Z</option>
            <option value="title-desc">标题 Z-A</option>
            <option value="source-asc">按来源分组</option>
          </select>
          <span>
            共 {filteredCandidates.length} 条，当前第 {safePage}/{totalPages} 页，本页 {visibleCandidateIds.length} 条
          </span>
        </div>
        <div className="candidate-list">
          {pagedCandidates.length > 0 ? (
            pagedCandidates.map((candidate) => {
              const checked = selectedCandidateIds.includes(candidate.id);
              const selectionBusy = pendingSelectionId === candidate.id;

              return (
                <label key={candidate.id} className="candidate-row">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!input.cloudReady || input.runId === 'uninitialized' || selectionBusy}
                    onChange={() => updateCandidateSelection(candidate.id, checked ? 'pending' : 'selected')}
                  />
                  <div>
                    <strong>
                      #{candidate.rank} {candidate.title}
                    </strong>
                    <span>
                      {candidate.source}｜当前状态：{candidate.selectionState}
                    </span>
                    <p>{candidate.summary}</p>
                    <div className="candidate-tags">
                      {candidate.tags.map((tag) => (
                        <small key={`${candidate.id}-${tag}`}>{tag}</small>
                      ))}
                    </div>
                    <div className="candidate-links">
                      <a href={candidate.canonicalUrl} target="_blank" rel="noreferrer">
                        查看来源
                      </a>
                      <button
                        type="button"
                        onClick={() => updateCandidateSelection(candidate.id, 'selected')}
                        disabled={!input.cloudReady || input.runId === 'uninitialized' || selectionBusy}
                      >
                        设为精选
                      </button>
                      <button
                        type="button"
                        onClick={() => updateCandidateSelection(candidate.id, 'discarded')}
                        disabled={!input.cloudReady || input.runId === 'uninitialized' || selectionBusy}
                      >
                        丢弃
                      </button>
                      <button
                        type="button"
                        onClick={() => updateCandidateSelection(candidate.id, 'pending')}
                        disabled={!input.cloudReady || input.runId === 'uninitialized' || selectionBusy}
                      >
                        恢复待定
                      </button>
                    </div>
                  </div>
                </label>
              );
            })
          ) : (
            <p>当前还没有候选数据。</p>
          )}
        </div>
        <div className="candidate-pagination">
          <button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={safePage <= 1}>
            上一页
          </button>
          <button type="button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={safePage >= totalPages}>
            下一页
          </button>
        </div>
      </article>

      <article className="card">
        <h2>已精选</h2>
        <div className="selected-list">
          {selectedDraft.length > 0 ? (
            selectedDraft.map((candidate, index) => (
              <div key={candidate.id} className="selected-row">
                <div>
                  <strong>
                    #{index + 1} {candidate.title}
                  </strong>
                  <span>{candidate.source}</span>
                </div>
                <div className="candidate-links">
                  <button
                    type="button"
                    onClick={async () => {
                      const nextSelectedIds = moveSelectedCandidate(selectedCandidateIds, candidate.id, 'up');
                      setSelectedCandidateIds(nextSelectedIds);
                      try {
                        await persistDraftSortOrder(nextSelectedIds);
                        router.refresh();
                      } catch (error) {
                        setSelectionStatus(error instanceof Error ? error.message : '顺序保存失败');
                      }
                    }}
                    disabled={index === 0 || isGenerating}
                  >
                    上移
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const nextSelectedIds = moveSelectedCandidate(selectedCandidateIds, candidate.id, 'down');
                      setSelectedCandidateIds(nextSelectedIds);
                      try {
                        await persistDraftSortOrder(nextSelectedIds);
                        router.refresh();
                      } catch (error) {
                        setSelectionStatus(error instanceof Error ? error.message : '顺序保存失败');
                      }
                    }}
                    disabled={index === selectedDraft.length - 1 || isGenerating}
                  >
                    下移
                  </button>
                  <button
                    type="button"
                    onClick={() => updateCandidateSelection(candidate.id, 'pending')}
                    disabled={!input.cloudReady || input.runId === 'uninitialized' || pendingSelectionId === candidate.id}
                  >
                    移出精选
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p>先从候选池勾选 3-5 条进入待生成精选区。</p>
          )}
        </div>
        <h3>已生成条目</h3>
        <div className="selected-list">
          {transientPreviewState.selectedRows.length > 0 ? (
            transientPreviewState.selectedRows.map((item) => {
              const isPublished = item.sitePublicationStatus === 'published';

              return (
                <div key={item.id} className="selected-row">
                  <strong>{item.title}</strong>
                  <span>{item.status}</span>
                  <button
                    type="button"
                    onClick={() => (isPublished ? handleWithdrawSite(item.id) : handlePublishSite(item.id))}
                    disabled={!input.cloudReady || input.runId === 'uninitialized' || isPublishingSite}
                  >
                    {isPublishingSite ? (isPublished ? '下线中...' : '发布中...') : isPublished ? '从网站下线' : '发布到网站'}
                  </button>
                </div>
              );
            })
          ) : (
            <p>当前还没有已生成条目。</p>
          )}
        </div>
        <div className="artifact-shortcuts">
          {transientPreviewState.artifactLinks
            .filter((link) => ['selected_html', 'selected_markdown', 'selected_png'].includes(link.label))
            .map((link) => (
              <a key={`${link.label}-${link.href}`} className="history-artifact-link" href={link.href} target="_blank" rel="noreferrer">
                {link.label}
              </a>
            ))}
        </div>
      </article>

      <article className="card">
        <h2>推送预览</h2>
        <pre>{transientPreviewState.pushDigest}</pre>
        {transientPreviewState.pushDecision ? (
          <div className="selected-list">
            <div className="selected-row">
              <strong>推送决策建议</strong>
              <span>{transientPreviewState.pushDecision.shouldPushToday ? '建议推送' : '建议暂缓'}</span>
            </div>
            <p>{transientPreviewState.pushDecision.reasonSummary}</p>
            <p>推荐候选：{transientPreviewState.pushDecision.recommendedCandidateIds.join('、') || '暂无'}</p>
            <p>推荐渠道：{transientPreviewState.pushDecision.recommendedChannels.join('、') || '暂无'}</p>
            {transientPreviewState.pushDecision.riskFlags.length > 0 ? <p>风险标记：{transientPreviewState.pushDecision.riskFlags.join('、')}</p> : null}
            {transientPreviewState.pushDecision.candidateDecisions.map((decision) => (
              <div key={decision.candidateId} className="selected-row">
                <strong>{decision.candidateId}</strong>
                <span>{decision.action} / {decision.scoreLabel}</span>
              </div>
            ))}
          </div>
        ) : null}
        {transientPreviewState.pushExecution ? (
          <div className="selected-list">
            <div className="selected-row">
              <strong>推荐执行结果</strong>
              <span>{transientPreviewState.pushExecution.recommendedChannels.length > 0 ? '已记录' : '无推荐渠道'}</span>
            </div>
            <p>执行摘要：{transientPreviewState.pushExecution.summary}</p>
            <p>本次推荐渠道：{transientPreviewState.pushExecution.recommendedChannels.join('、') || '暂无'}</p>
          </div>
        ) : null}
        {transientPreviewState.pushChannelStatuses && transientPreviewState.pushChannelStatuses.length > 0 ? (
          <div className="selected-list">
            {transientPreviewState.pushChannelStatuses.map((channelStatus) => (
              <div key={channelStatus.channel} className="selected-row">
                <strong>{channelStatus.channel}</strong>
                <span>
                  {channelStatus.status}
                  {channelStatus.responseSummary ? `｜${channelStatus.responseSummary}` : ''}
                </span>
              </div>
            ))}
          </div>
        ) : null}
        <div className="artifact-shortcuts">
          {transientPreviewState.artifactLinks
            .filter((link) => ['push_digest', 'push_decision', 'push_execution'].includes(link.label))
            .map((link) => (
              <a key={`${link.label}-${link.href}`} className="history-artifact-link" href={link.href} target="_blank" rel="noreferrer">
                {link.label}
              </a>
            ))}
        </div>
      </article>
    </div>
  );
}
