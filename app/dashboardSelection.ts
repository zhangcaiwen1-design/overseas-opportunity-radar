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
  candidateId?: string;
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

export type CandidateSelectionFilter = 'all' | 'pending' | 'selected' | 'discarded';
export type CandidateSortMode = 'rank-asc' | 'rank-desc' | 'title-asc' | 'title-desc' | 'source-asc';

export function buildSelectedCandidateDraft(candidates: CandidateRow[], selectedCandidateIds: string[]) {
  const selectedIds = selectedCandidateIds.length > 0 ? selectedCandidateIds : buildPersistedSelectedOrder(candidates);
  const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));

  return selectedIds
    .map((candidateId) => candidateById.get(candidateId))
    .filter((candidate): candidate is CandidateRow => Boolean(candidate));
}

function buildPersistedSelectedOrder(candidates: CandidateRow[]) {
  return [...candidates]
    .filter((candidate) => candidate.selectionState === 'selected')
    .sort((left, right) => (left.draftSortOrder ?? Number.MAX_SAFE_INTEGER) - (right.draftSortOrder ?? Number.MAX_SAFE_INTEGER))
    .map((candidate) => candidate.id);
}

export function moveSelectedCandidate(selectedCandidateIds: string[], candidateId: string, direction: 'up' | 'down') {
  const index = selectedCandidateIds.indexOf(candidateId);
  if (index === -1) {
    return selectedCandidateIds;
  }

  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= selectedCandidateIds.length) {
    return selectedCandidateIds;
  }

  const next = [...selectedCandidateIds];
  const [moved] = next.splice(index, 1);
  next.splice(targetIndex, 0, moved);
  return next;
}

export function buildDraftSortOrderUpdates(selectedCandidateIds: string[]) {
  return selectedCandidateIds.map((candidateId, draftSortOrder) => ({ candidateId, draftSortOrder }));
}

export function applyRecommendedSelection(input: {
  candidateRows: CandidateRow[];
  recommendedCandidateIds: string[];
}) {
  const candidateById = new Map(input.candidateRows.map((candidate) => [candidate.id, candidate]));
  const seen = new Set<string>();

  return input.recommendedCandidateIds.filter((candidateId) => {
    if (seen.has(candidateId) || !candidateById.has(candidateId)) {
      return false;
    }

    seen.add(candidateId);
    return true;
  });
}

export function deriveRecommendedCandidateIds(input: {
  candidateRows: CandidateRow[];
  pushDecision?: PushDecisionViewModel | null;
  hasPendingSelectionRefresh: boolean;
}) {
  if (input.hasPendingSelectionRefresh) {
    return [];
  }

  return applyRecommendedSelection({
    candidateRows: input.candidateRows,
    recommendedCandidateIds: input.pushDecision?.recommendedCandidateIds ?? [],
  });
}

export function buildRecommendedGenerateSelection(input: {
  selectedCandidateIds: string[];
  recommendedCandidateIds: string[];
}) {
  return input.recommendedCandidateIds.length > 0 ? input.recommendedCandidateIds : input.selectedCandidateIds;
}

export function canExecuteRecommendedFlow(input: {
  shouldPushToday: boolean;
  recommendedCandidateIds: string[];
  selectedCandidateIds: string[];
}) {
  if (!input.shouldPushToday) {
    return false;
  }

  return buildRecommendedGenerateSelection({
    selectedCandidateIds: input.selectedCandidateIds,
    recommendedCandidateIds: input.recommendedCandidateIds,
  }).length > 0;
}

export function formatRecommendedFlowStatus(input:
  | { stage: 'selecting' | 'generating' | 'pushing' | 'completed' }
  | { stage: 'failed'; reason: string }) {
  if (input.stage === 'selecting') {
    return '正在执行推荐链路：应用推荐候选...';
  }

  if (input.stage === 'generating') {
    return '正在执行推荐链路：生成成稿...';
  }

  if (input.stage === 'pushing') {
    return '正在执行推荐链路：推送内容...';
  }

  if (input.stage === 'completed') {
    return '推荐链路已执行，正在刷新结果...';
  }

  if (input.stage === 'failed') {
    return `推荐链路执行失败：${input.reason}`;
  }

  return '';
}

export function buildRecoveryAction(input: {
  recoveryAction: '' | 'collect' | 'generate' | 'push' | 'publish';
  recoverySelectedItemId: string;
}) {
  if (input.recoveryAction === 'collect') {
    return { type: 'collect' as const, label: '重新采集' };
  }

  if (input.recoveryAction === 'generate') {
    return { type: 'generate' as const, label: '重新生成' };
  }

  if (input.recoveryAction === 'push') {
    return { type: 'push' as const, label: '重新推送' };
  }

  if (input.recoveryAction === 'publish' && input.recoverySelectedItemId) {
    return { type: 'publish' as const, label: '重新发布到网站', selectedItemId: input.recoverySelectedItemId };
  }

  return null;
}

export function summarizePushExecutionStatus(status: { feishu: boolean; wecom: boolean; wxpusher: boolean }) {
  const successfulChannels = Object.entries(status)
    .filter(([, ok]) => ok)
    .map(([channel]) => channel);

  if (successfulChannels.length === 0) {
    return '推荐链路未找到成功推送通道。';
  }

  if (successfulChannels.length === Object.keys(status).length) {
    return `推荐链路推送完成：成功通道 ${successfulChannels.join('、')}。`;
  }

  if (successfulChannels.length > 0) {
    return `推荐链路部分成功：成功通道 ${successfulChannels.join('、')}；其余通道未成功。`;
  }

  return '推荐链路未找到成功推送通道。';
}

export function applyBulkSelection(input: {
  selectedCandidateIds: string[];
  visibleCandidateIds: string[];
  action: 'select' | 'clear' | 'discard';
}) {
  if (input.action === 'clear' || input.action === 'discard') {
    const visibleIdSet = new Set(input.visibleCandidateIds);
    return input.selectedCandidateIds.filter((candidateId) => !visibleIdSet.has(candidateId));
  }

  const existingIdSet = new Set(input.selectedCandidateIds);
  const appended = input.visibleCandidateIds.filter((candidateId) => !existingIdSet.has(candidateId));
  return [...input.selectedCandidateIds, ...appended];
}

export function buildTransientPreviewState(input: {
  hasPendingSelectionRefresh: boolean;
  selectedRows: SelectedRow[];
  artifactLinks: Array<{ label: string; href: string }>;
  pushDigest: string;
  pushDecision?: PushDecisionViewModel | null;
  pushExecution?: PushExecutionViewModel | null;
  pushChannelStatuses?: Array<{ channel: string; status: string; responseSummary: string }>;
}) {
  if (!input.hasPendingSelectionRefresh) {
    return {
      selectedRows: input.selectedRows,
      artifactLinks: input.artifactLinks,
      pushDigest: input.pushDigest,
      pushDecision: input.pushDecision ?? null,
      pushExecution: input.pushExecution ?? null,
      pushChannelStatuses: input.pushChannelStatuses ?? [],
    };
  }

  return {
    selectedRows: [],
    artifactLinks: [],
    pushDigest: '选稿已变更，等待重新生成最新推送文稿。',
    pushDecision: null,
    pushExecution: null,
    pushChannelStatuses: [],
  };
}

export function filterAndSortCandidates(input: {
  candidates: CandidateRow[];
  searchQuery: string;
  selectionFilter: CandidateSelectionFilter;
  sortMode: CandidateSortMode;
}) {
  const query = input.searchQuery.trim().toLowerCase();
  const filtered = input.candidates.filter((candidate) => {
    if (input.selectionFilter !== 'all' && candidate.selectionState !== input.selectionFilter) {
      return false;
    }

    if (!query) {
      return true;
    }

    const haystack = [candidate.title, candidate.summary, candidate.source, ...candidate.tags].join(' ').toLowerCase();
    return haystack.includes(query);
  });

  return [...filtered].sort((left, right) => {
    if (input.sortMode === 'rank-asc') {
      return left.rank - right.rank;
    }
    if (input.sortMode === 'rank-desc') {
      return right.rank - left.rank;
    }
    if (input.sortMode === 'title-desc') {
      return right.title.localeCompare(left.title, 'zh-CN');
    }
    if (input.sortMode === 'source-asc') {
      return left.source.localeCompare(right.source, 'zh-CN') || left.rank - right.rank;
    }
    return left.title.localeCompare(right.title, 'zh-CN');
  });
}
