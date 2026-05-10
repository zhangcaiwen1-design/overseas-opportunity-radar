import React from 'react';
import { DashboardActions } from './DashboardActions';
import { loadDashboardData } from '../src/cloud/queries/loadDashboardData';
import { buildSettingsPageViewModel } from '../src/cloud/viewmodels/buildSettingsPageViewModel';
import { buildTodayDashboardViewModel } from '../src/cloud/viewmodels/buildTodayDashboardViewModel';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const dashboardData = await loadDashboardData();
  const viewModel = buildTodayDashboardViewModel({
    run: dashboardData.run,
    candidates: dashboardData.candidates,
    selectedItems: dashboardData.selectedItems,
    artifacts: dashboardData.artifacts,
    pushDigest: dashboardData.pushDigest,
    pushDecision: dashboardData.pushDecision,
    pushExecution: dashboardData.pushExecution,
    pushStatus: dashboardData.pushStatus,
    pushLogs: dashboardData.currentPushLogs,
    currentContentVariants: dashboardData.currentContentVariants,
    currentPublicationLogs: dashboardData.currentPublicationLogs,
    recentLeadEvents: dashboardData.recentLeadEvents,
    historyRuns: dashboardData.historyRuns,
  });
  const settingsViewModel = buildSettingsPageViewModel({
    timezone: dashboardData.timezone,
    dailyRunTime: dashboardData.dailyRunTime,
    openaiBaseUrl: dashboardData.openaiBaseUrl,
    openaiApiKeyConfigured: dashboardData.openaiApiKeyConfigured,
    configuredChannels: dashboardData.configuredChannels,
    allPushConfigs: dashboardData.allPushConfigs,
  });

  return (
    <section className="dashboard-grid">
      <article className="card card--hero dashboard-hero">
        <div className="dashboard-hero__main">
          <span className="page-kicker">Today Dashboard</span>
          <h1>海外商业机会雷达</h1>
          <p>今日运行状态、候选池、精选区和推送预览都会集中显示在这里。</p>
          <div className="hero-stats">
            <div>
              <strong>{viewModel.statusCard.candidateCount}</strong>
              <span>候选数</span>
            </div>
            <div>
              <strong>{viewModel.statusCard.selectedCount}</strong>
              <span>已精选</span>
            </div>
            <div>
              <strong>{viewModel.statusCard.status}</strong>
              <span>运行状态</span>
            </div>
          </div>
        </div>
        <aside className="dashboard-hero__rail">
          <span className="dashboard-hero__eyebrow">内容运营控制台</span>
          <strong>{dashboardData.preflight.environmentLabel}</strong>
          <p>{dashboardData.preflight.summary}</p>
          <p>
            客户端预览：<a href="/site" target="_blank" rel="noreferrer">打开客户站</a>
          </p>
          <div className="dashboard-hero__rail-grid">
            <div>
              <span>建议动作</span>
              <strong>{dashboardData.cloudReady ? '继续推进生成与发布' : '先处理部署阻断项'}</strong>
            </div>
            <div>
              <span>当前定时</span>
              <strong>{settingsViewModel.dailyRunTime}</strong>
            </div>
            <div>
              <span>已启用推送</span>
              <strong>{dashboardData.configuredChannels.length} 个</strong>
            </div>
          </div>
        </aside>
      </article>

      <article className="card dashboard-overview-card">
        <div className="section-heading">
          <div>
            <span className="page-kicker">Launch Readiness</span>
            <h2>上线前检查</h2>
          </div>
          <p>把环境、时区、推送和网关放在一个地方看清楚。</p>
        </div>
        <p>当前环境：{dashboardData.preflight.environmentLabel}</p>
        <p>环境预检：{dashboardData.preflight.summary}</p>
        <p>
          定时执行：{settingsViewModel.timezone} {settingsViewModel.dailyRunTime}（cron 预览：{settingsViewModel.cronExpression}）
        </p>
        <p>推送渠道：已启用 {dashboardData.configuredChannels.length} 个</p>
        <p>OpenAI 网关：{settingsViewModel.openaiBaseUrl || '未配置'}</p>
        <p>上线判断：{dashboardData.cloudReady ? '可以进入云端部署核对' : '先处理部署阻断项'}</p>
      </article>

      <article className="card dashboard-overview-card">
        <div className="section-heading">
          <div>
            <span className="page-kicker">Operations Snapshot</span>
            <h2>运行概览</h2>
          </div>
          <p>把最近一轮内容生产、推送和转化状态压缩成一个视图。</p>
        </div>
        <div className="dashboard-overview-grid">
          <div>
            <strong>最近启动时间</strong>
            <span>{viewModel.overview.startedAt || '尚未运行'}</span>
          </div>
          <div>
            <strong>已配置推送通道</strong>
            <span>{viewModel.overview.configuredPushChannels} 个</span>
          </div>
          <div>
            <strong>本次推送成功</strong>
            <span>{viewModel.overview.successfulPushChannels} 个</span>
          </div>
          <div>
            <strong>本次推送失败</strong>
            <span>{viewModel.overview.failedPushChannels} 个</span>
          </div>
          <div>
            <strong>系统状态</strong>
            <span>{viewModel.overview.healthStatus}</span>
          </div>
          <div>
            <strong>状态说明</strong>
            <span>{viewModel.overview.healthSummary}</span>
          </div>
          <div>
            <strong>当前失败环节</strong>
            <span>{viewModel.overview.currentFailureStage || '暂无'}</span>
          </div>
          <div>
            <strong>最近成功运行</strong>
            <span>{viewModel.overview.lastSuccessfulRunStartedAt || '暂无'}</span>
          </div>
          <div>
            <strong>最近失败运行</strong>
            <span>{viewModel.overview.recentFailureStartedAt || '暂无'}</span>
          </div>
          <div>
            <strong>成稿产物</strong>
            <span>{viewModel.overview.artifactReady ? '已生成' : '待生成'}</span>
          </div>
          <div>
            <strong>已发布站点稿件</strong>
            <span>{viewModel.overview.publishedSiteVariantCount} 篇</span>
          </div>
          <div>
            <strong>发布成功日志</strong>
            <span>{viewModel.overview.publicationSuccessCount} 条</span>
          </div>
          <div>
            <strong>最近转化事件</strong>
            <span>{viewModel.overview.recentLeadEventCount} 条</span>
          </div>
          <div>
            <strong>事件类型摘要</strong>
            <span>{viewModel.overview.recentLeadEventSummary || '暂无'}</span>
          </div>
        </div>
        {viewModel.overview.summaryText ? <p>最近摘要：{viewModel.overview.summaryText}</p> : null}
        <p>
          网站发布结果：已发布站点稿件 {viewModel.overview.publishedSiteVariantCount} 篇，发布成功日志 {viewModel.overview.publicationSuccessCount} 条
          {viewModel.overview.publicationFailureCount > 0 ? `，发布失败日志 ${viewModel.overview.publicationFailureCount} 条` : ''}。
        </p>
        {viewModel.overview.latestPublicationSummary ? <p>最近发布摘要：{viewModel.overview.latestPublicationSummary}</p> : null}
        {viewModel.overview.currentFailureSummary ? <p>当前失败说明：{viewModel.overview.currentFailureSummary}</p> : null}
        {viewModel.overview.recoverySuggestion ? <p>异常恢复：{viewModel.overview.recoverySuggestion}</p> : null}
        {viewModel.overview.recentPushExecutionSummary ? <p>最近执行摘要：{viewModel.overview.recentPushExecutionSummary}</p> : null}
        {viewModel.overview.errorMessage ? <p>最近失败原因：{viewModel.overview.errorMessage}</p> : null}
        {viewModel.overview.recentFailureMessage ? <p>失败原因：{viewModel.overview.recentFailureMessage}</p> : null}
        {viewModel.overview.recentLeadDetails.length > 0 ? (
          <div>
            <strong>最近线索</strong>
            <ul>
              {viewModel.overview.recentLeadDetails.map((lead) => (
                <li key={lead.id}>
                  {lead.eventType}｜{lead.pageType}｜{lead.contact}
                  {lead.notes ? `｜${lead.notes}` : ''}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </article>

      <DashboardActions
        runId={viewModel.statusCard.runId}
        candidateRows={viewModel.candidateRows}
        selectedRows={viewModel.selectedRows}
        artifactLinks={viewModel.artifactLinks}
        pushDigest={viewModel.pushPreview.body}
        pushDecision={viewModel.pushPreview.decision}
        pushExecution={viewModel.pushPreview.execution}
        pushChannelStatuses={viewModel.pushPreview.channelStatuses}
        recoveryAction={viewModel.overview.recoveryAction}
        recoverySelectedItemId={viewModel.overview.recoverySelectedItemId}
        cloudReady={dashboardData.cloudReady}
      />
    </section>
  );
}
