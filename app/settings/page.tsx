import React from 'react';
import { SettingsForm } from './SettingsForm';
import { loadSettingsPageData } from '../../src/cloud/queries/loadSettingsPageData';
import { buildSettingsPageViewModel } from '../../src/cloud/viewmodels/buildSettingsPageViewModel';

export const dynamic = 'force-dynamic';

function getEnvironmentTargetCopy(environment: 'local' | 'staging' | 'production') {
  if (environment === 'production') {
    return '运行目标：面向正式生产流量，请确认生产环境变量、定时任务与推送配置均已按基线部署。';
  }

  if (environment === 'staging') {
    return '运行目标：用于云端联调与手动 daily run 演练，请避免把 staging 当成正式生产。';
  }

  return '运行目标：用于本地联调，优先补齐环境变量并验证预检结果，不会替代云端部署。';
}

export default async function SettingsPage() {
  const settingsData = await loadSettingsPageData();
  const viewModel = buildSettingsPageViewModel({
    timezone: settingsData.timezone,
    dailyRunTime: settingsData.dailyRunTime,
    openaiBaseUrl: settingsData.openaiBaseUrl,
    openaiApiKeyConfigured: settingsData.openaiApiKeyConfigured,
    configuredChannels: settingsData.configuredChannels,
    allPushConfigs: settingsData.allPushConfigs,
  });

  return (
    <section className="dashboard-grid">
      <article className="card card--hero settings-hero">
        <div className="settings-hero__main">
          <span className="page-kicker">Settings</span>
          <h1>运行与推送配置</h1>
          <p>这里会集中管理时区、执行时间、OpenAI 网关和各推送渠道配置。</p>
          <p>当前环境：{settingsData.preflight.environmentLabel}</p>
          <p>{getEnvironmentTargetCopy(settingsData.preflight.environment)}</p>
          <p>{settingsData.preflight.summary}</p>
          <p>{settingsData.preflight.hint}</p>
          {settingsData.preflight.missingKeys.length > 0 ? (
            <div>
              <strong>部署阻断项</strong>
              <ul>
                {settingsData.preflight.missingKeys.map((key) => (
                  <li key={key}>{key}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {settingsData.cloudReady ? (
            <div>
              <strong>上线检查清单</strong>
              <ul>
                <li>确认 preflight 为 ready</li>
                <li>确认 cron 预览与部署计划一致</li>
                <li>确认至少一个推送渠道已启用</li>
              </ul>
            </div>
          ) : null}
        </div>
        <aside className="settings-hero__rail">
          <span className="settings-hero__eyebrow">配置基线</span>
          <div className="settings-hero__rail-grid">
            <div>
              <span>环境</span>
              <strong>{settingsData.preflight.environmentLabel}</strong>
            </div>
            <div>
              <span>时区</span>
              <strong>{viewModel.timezone}</strong>
            </div>
            <div>
              <span>执行时间</span>
              <strong>{viewModel.dailyRunTime}</strong>
            </div>
            <div>
              <span>cron 预览</span>
              <strong>{viewModel.cronExpression}</strong>
            </div>
          </div>
        </aside>
      </article>
      <SettingsForm
        timezone={viewModel.timezone}
        dailyRunTime={viewModel.dailyRunTime}
        openaiBaseUrl={viewModel.openaiBaseUrl}
        openaiApiKeyConfigured={viewModel.openaiApiKeyConfigured}
        cronExpression={viewModel.cronExpression}
        configs={viewModel.channels.map((channel) => ({
          channel: channel.channel,
          enabled: channel.enabled,
          secretPayload: '',
          hasSavedSecret: channel.hasSavedSecret,
        }))}
        cloudReady={settingsData.cloudReady}
      />
    </section>
  );
}
