'use client';

import { useRouter } from 'next/navigation';
import React, { useEffect, useMemo, useState } from 'react';
import { ADMIN_SECRET_STORAGE_KEY, buildAdminHeaders, hasAdminSecret } from '../adminSecret';
import { buildRecoveryAction } from '../dashboardSelection';

export interface HistoryRow {
  id: string;
  dateKey: string;
  startedAt: string;
  status: string;
  selectedCount: number;
  poolCount: number;
  summaryText: string;
  errorMessage: string;
  failureSummary: string;
  recoveryAction: '' | 'collect' | 'generate' | 'push' | 'publish';
  recoverySelectedItemId: string;
  pushLogs: Array<{ channel: string; status: string; responseSummary: string }>;
  publishedSummary: { publishedCount: number; logCount: number; latestStatusSummary: string };
  publicationLogs: Array<{ channel: string; action: string; status: string; responseSummary: string }>;
  artifactGroups: Array<{
    artifactType: string;
    title: string;
    links: Array<{ label: string; href: string; storagePath?: string }>;
  }>;
}

export type HistoryStatusFilter = 'all' | 'completed' | 'failed' | 'running';

export function filterHistoryRows(rows: HistoryRow[], searchQuery: string, statusFilter: HistoryStatusFilter) {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  return rows.filter((row) => {
    if (statusFilter !== 'all' && row.status !== statusFilter) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    const searchableText = [
      row.dateKey,
      row.status,
      row.startedAt,
      row.summaryText,
      row.errorMessage,
      row.failureSummary,
      `${row.publishedSummary.publishedCount} ${row.publishedSummary.logCount} ${row.publishedSummary.latestStatusSummary}`,
      ...row.pushLogs.map((pushLog) => `${pushLog.channel} ${pushLog.status} ${pushLog.responseSummary}`),
      ...row.publicationLogs.map((publicationLog) => `${publicationLog.channel} ${publicationLog.action} ${publicationLog.status} ${publicationLog.responseSummary}`),
      ...row.artifactGroups.map((group) => group.title),
    ]
      .join(' ')
      .toLowerCase();

    return searchableText.includes(normalizedQuery);
  });
}

export function HistoryRunsPanel(input: { rows: HistoryRow[] }) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<HistoryStatusFilter>('all');
  const [adminSecret, setAdminSecret] = useState('');
  const [actionStatus, setActionStatus] = useState('');
  const [pendingRecoveryRunId, setPendingRecoveryRunId] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    setAdminSecret(window.localStorage.getItem(ADMIN_SECRET_STORAGE_KEY) ?? '');
  }, []);

  const filteredRows = useMemo(() => filterHistoryRows(input.rows, searchQuery, statusFilter), [input.rows, searchQuery, statusFilter]);

  function ensureAdminSecret() {
    if (!hasAdminSecret(adminSecret)) {
      setActionStatus('请先输入管理密钥 ADMIN_SECRET');
      return false;
    }

    window.localStorage.setItem(ADMIN_SECRET_STORAGE_KEY, adminSecret.trim());
    return true;
  }

  async function handleRecovery(row: HistoryRow) {
    const recovery = buildRecoveryAction({ recoveryAction: row.recoveryAction, recoverySelectedItemId: row.recoverySelectedItemId });

    if (!recovery) {
      return;
    }

    if (!ensureAdminSecret()) {
      return;
    }

    setPendingRecoveryRunId(row.id);
    setActionStatus(`正在执行${recovery.label}...`);

    try {
      if (recovery.type === 'collect') {
        const response = await fetch('/api/runs/manual-collect', { method: 'POST', headers: buildAdminHeaders(adminSecret) });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.reason ?? 'collect failed');
        }

        setActionStatus(`采集完成，候选 ${payload.poolCount} 条，正在刷新结果...`);
        router.refresh();
        return;
      }

      if (recovery.type === 'generate') {
        const response = await fetch(`/api/runs/${row.id}/generate`, {
          method: 'POST',
          headers: buildAdminHeaders(adminSecret, 'application/json'),
          body: JSON.stringify({ selectedCandidateIds: [] }),
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.reason ?? 'generate failed');
        }

        setActionStatus(`已重新生成 ${payload.selectedCount} 条成稿，正在刷新结果...`);
        router.refresh();
        return;
      }

      if (recovery.type === 'push') {
        const response = await fetch(`/api/runs/${row.id}/push`, { method: 'POST', headers: buildAdminHeaders(adminSecret) });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.reason ?? 'push failed');
        }

        setActionStatus('已重新推送，正在刷新结果...');
        router.refresh();
        return;
      }

      const response = await fetch(`/api/runs/${row.id}/publish-site`, {
        method: 'POST',
        headers: buildAdminHeaders(adminSecret, 'application/json'),
        body: JSON.stringify({ selectedItemId: recovery.selectedItemId }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.reason ?? 'publish site failed');
      }

      setActionStatus('已重新发布到网站，正在刷新结果...');
      router.refresh();
    } catch (error) {
      setActionStatus(error instanceof Error ? error.message : `${recovery.label}失败`);
    } finally {
      setPendingRecoveryRunId('');
    }
  }

  return (
    <article className="card card--hero">
      <div className="history-panel__header">
        <div>
          <h2>运行详情</h2>
          <p>按状态、关键词快速筛选历史运行、推送结果和产物链接。</p>
        </div>
        <span className="history-panel__count">筛选结果：{filteredRows.length} 条</span>
      </div>
      <div className="history-toolbar">
        <input value={adminSecret} onChange={(event) => setAdminSecret(event.target.value)} placeholder="管理密钥 ADMIN_SECRET" type="password" />
        <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="搜索日期、摘要、错误、推送渠道、发布日志" />
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | 'completed' | 'failed' | 'running')}>
          <option value="all">全部状态</option>
          <option value="completed">completed</option>
          <option value="failed">failed</option>
          <option value="running">running</option>
        </select>
      </div>
      {actionStatus ? <p className="action-status">{actionStatus}</p> : null}
      {filteredRows.length > 0 ? (
        <div className="history-runs">
          {filteredRows.map((row) => (
            <section key={row.id} className="history-run">
              <div className="history-run__meta">
                <div className="history-run__headline">
                  <strong>{row.dateKey}</strong>
                  <span className={`history-status-chip history-status-chip--${row.status}`}>{row.status}</span>
                </div>
                <span>
                  开始时间：{row.startedAt || '未知'}｜精选 {row.selectedCount}｜候选 {row.poolCount}
                </span>
                {row.summaryText ? <span>摘要：{row.summaryText}</span> : null}
                {row.errorMessage ? <span>失败原因：{row.errorMessage}</span> : null}
                {row.failureSummary ? <span>失败定位：{row.failureSummary}</span> : null}
                {buildRecoveryAction({ recoveryAction: row.recoveryAction, recoverySelectedItemId: row.recoverySelectedItemId }) ? (
                  <button
                    type="button"
                    onClick={() => handleRecovery(row)}
                    disabled={pendingRecoveryRunId === row.id}
                  >
                    {pendingRecoveryRunId === row.id
                      ? '处理中...'
                      : buildRecoveryAction({ recoveryAction: row.recoveryAction, recoverySelectedItemId: row.recoverySelectedItemId })?.label}
                  </button>
                ) : null}
                <span>发布结果：已发布站点稿件 {row.publishedSummary.publishedCount} 篇｜发布日志 {row.publishedSummary.logCount} 条</span>
                {row.publishedSummary.latestStatusSummary ? <span>最近发布摘要：{row.publishedSummary.latestStatusSummary}</span> : null}
              </div>
              {row.publicationLogs.length > 0 ? (
                <div className="history-push-logs">
                  <strong>发布结果</strong>
                  {row.publicationLogs.map((publicationLog, index) => (
                    <div key={`${row.id}-publication-${publicationLog.channel}-${index}`} className="history-push-log">
                      <strong>
                        {publicationLog.channel}｜{publicationLog.action}｜{publicationLog.status}
                      </strong>
                      <span>{publicationLog.responseSummary || '无返回摘要'}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p>当前没有发布记录。</p>
              )}
              {row.pushLogs.length > 0 ? (
                <div className="history-push-logs">
                  {row.pushLogs.map((pushLog, index) => (
                    <div key={`${row.id}-${pushLog.channel}-${index}`} className="history-push-log">
                      <strong>
                        推送 {pushLog.channel}｜{pushLog.status}
                      </strong>
                      <span>{pushLog.responseSummary || '无返回摘要'}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p>当前没有推送记录。</p>
              )}
              <div className="history-artifact-groups">
                {row.artifactGroups.length > 0 ? (
                  row.artifactGroups.map((group) => (
                    <div key={`${row.id}-${group.artifactType}`} className="history-artifact-group">
                      <strong>{group.title}</strong>
                      <div className="history-artifacts">
                        {group.links.map((link) => (
                          <a
                            key={`${row.id}-${group.artifactType}-${link.href}`}
                            className="history-artifact-link"
                            href={link.href}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {group.title}
                          </a>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <p>当前没有产物链接。</p>
                )}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <p>没有符合筛选条件的历史记录。</p>
      )}
    </article>
  );
}
