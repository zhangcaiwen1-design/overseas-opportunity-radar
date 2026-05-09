import React from 'react';
import { HistoryRunsPanel } from './HistoryRunsPanel';
import { loadHistoryData } from '../../src/cloud/queries/loadHistoryData';
import { buildHistoryPageViewModel } from '../../src/cloud/viewmodels/buildHistoryPageViewModel';

export const dynamic = 'force-dynamic';

export default async function HistoryPage() {
  const historyRuns = await loadHistoryData();
  const viewModel = buildHistoryPageViewModel(historyRuns);

  return (
    <section className="dashboard-grid">
      <article className="card card--hero">
        <span className="page-kicker">History</span>
        <h1>历史运行记录</h1>
        <p>这里展示已入库的运行记录、产物链接和推送状态。</p>
      </article>
      <article className="card">
        <h2>运行总数</h2>
        <p>{viewModel.summary.totalRuns}</p>
      </article>
      <article className="card">
        <h2>成功运行</h2>
        <p>{viewModel.summary.completedRuns}</p>
      </article>
      <article className="card">
        <h2>失败运行</h2>
        <p>{viewModel.summary.failedRuns}</p>
      </article>
      <article className="card">
        <h2>累计精选</h2>
        <p>{viewModel.summary.totalSelectedCount}</p>
      </article>
      <HistoryRunsPanel rows={viewModel.rows} />
    </section>
  );
}
