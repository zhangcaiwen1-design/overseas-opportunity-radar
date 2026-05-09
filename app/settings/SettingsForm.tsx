'use client';

import { useRouter } from 'next/navigation';
import React, { useEffect, useMemo, useState } from 'react';
import { toUtcCronExpression } from '../../src/cloud/settings/syncCronSchedule';
import { ADMIN_SECRET_STORAGE_KEY, buildAdminHeaders, hasAdminSecret } from '../adminSecret';

interface PushConfigRow {
  channel: 'feishu' | 'wecom' | 'wxpusher';
  enabled: boolean;
  secretPayload: string;
  hasSavedSecret?: boolean;
}

const channelLabels: Record<PushConfigRow['channel'], string> = {
  feishu: '飞书',
  wecom: '企业微信',
  wxpusher: 'WxPusher',
};

export function validatePushConfigSecretPayload(config: PushConfigRow) {
  if (!config.enabled) {
    return '';
  }

  if (!config.secretPayload.trim()) {
    return config.hasSavedSecret ? '' : '请先填写推送密钥或 Webhook';
  }

  if (config.channel === 'wxpusher') {
    const [appToken, uid] = config.secretPayload.split('|');
    return appToken && uid ? '' : 'WxPusher 配置格式必须是 appToken|uid';
  }

  try {
    const url = new URL(config.secretPayload);
    return url.protocol === 'https:' ? '' : `${channelLabels[config.channel]} Webhook 必须使用 https URL`;
  } catch {
    return `${channelLabels[config.channel]} Webhook 必须使用 https URL`;
  }
}

function validateScheduleSettings(timezone: string, dailyRunTime: string) {
  if (timezone !== 'Asia/Shanghai' && timezone !== 'UTC') {
    return '时区必须是 Asia/Shanghai 或 UTC';
  }

  if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(dailyRunTime)) {
    return '每日执行时间必须是 HH:MM 格式';
  }

  return '';
}

export function formatSaveSuccessStatus(cronExpression: string) {
  return `保存成功，cron 表达式预览为 ${cronExpression}；这是按当前设置计算的结果，正在刷新配置...`;
}

export function SettingsForm(input: {
  timezone: string;
  dailyRunTime: string;
  openaiBaseUrl: string;
  openaiApiKeyConfigured: boolean;
  cronExpression: string;
  configs: PushConfigRow[];
  cloudReady: boolean;
}) {
  const router = useRouter();
  const [configs, setConfigs] = useState<PushConfigRow[]>(() =>
    ['feishu', 'wecom', 'wxpusher'].map((channel) => {
      const existing = input.configs.find((item) => item.channel === channel);
      return (
        existing ?? {
          channel: channel as PushConfigRow['channel'],
          enabled: false,
          secretPayload: '',
        }
      );
    }),
  );
  const [timezone, setTimezone] = useState(input.timezone);
  const [dailyRunTime, setDailyRunTime] = useState(input.dailyRunTime);
  const [openaiBaseUrl, setOpenaiBaseUrl] = useState(input.openaiBaseUrl);
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [adminSecret, setAdminSecret] = useState('');
  const [status, setStatus] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [adminSecretRemembered, setAdminSecretRemembered] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const savedSecret = window.localStorage.getItem(ADMIN_SECRET_STORAGE_KEY) ?? '';
    setAdminSecret(savedSecret);
    setAdminSecretRemembered(hasAdminSecret(savedSecret));
  }, []);

  const orderedConfigs = useMemo(() => configs, [configs]);
  const initialCronPreview = useMemo(() => toUtcCronExpression(input.dailyRunTime, input.timezone), [input.dailyRunTime, input.timezone]);
  const cronPreview = useMemo(() => toUtcCronExpression(dailyRunTime, timezone), [dailyRunTime, timezone]);
  const displayedCronExpression = cronPreview === initialCronPreview ? input.cronExpression : cronPreview;
  const scheduleValidationError = useMemo(() => validateScheduleSettings(timezone, dailyRunTime), [dailyRunTime, timezone]);
  const validationError = useMemo(
    () => scheduleValidationError || orderedConfigs.map(validatePushConfigSecretPayload).find((message) => message) || '',
    [orderedConfigs, scheduleValidationError],
  );

  async function handleSave() {
    if (validationError) {
      setStatus(validationError);
      return;
    }

    if (!hasAdminSecret(adminSecret)) {
      setStatus('请先输入管理密钥 ADMIN_SECRET');
      return;
    }

    setIsSaving(true);
    setStatus('正在保存配置...');

    try {
      window.localStorage.setItem(ADMIN_SECRET_STORAGE_KEY, adminSecret.trim());
      setAdminSecretRemembered(true);
      const response = await fetch('/api/settings/push-configs', {
        method: 'POST',
        headers: buildAdminHeaders(adminSecret, 'application/json'),
        body: JSON.stringify({ configs, timezone, dailyRunTime, openaiBaseUrl, openaiApiKey }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.reason ?? 'save failed');
      }

      setStatus(formatSaveSuccessStatus(payload.cronExpression ?? cronPreview));
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '保存失败');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="settings-stack">
      <article className="card">
        <h2>当前时区</h2>
        <div className="settings-simple-form">
          <input value={timezone} onChange={(event) => setTimezone(event.target.value)} placeholder="Asia/Shanghai" />
        </div>
        {timezone !== 'Asia/Shanghai' && timezone !== 'UTC' ? <p className="action-status">时区必须是 Asia/Shanghai 或 UTC</p> : null}
      </article>
      <article className="card">
        <h2>每日执行时间</h2>
        <div className="settings-simple-form">
          <input value={dailyRunTime} onChange={(event) => setDailyRunTime(event.target.value)} placeholder="09:00" />
        </div>
        {!/^([01]\d|2[0-3]):([0-5]\d)$/.test(dailyRunTime) ? <p className="action-status">每日执行时间必须是 HH:MM 格式</p> : null}
        <p className="settings-hint">cron 预览：{displayedCronExpression}</p>
        <p className="settings-hint">仅根据当前时区与每日执行时间计算，不表示云端定时任务已同步部署。</p>
      </article>
      <article className="card">
        <div className="settings-section-head">
          <h2>管理密钥</h2>
          <span className={`settings-secret-badge${adminSecretRemembered ? ' settings-secret-badge--ready' : ''}`}>
            {adminSecretRemembered ? '已在当前浏览器记住' : '仅保存在当前浏览器'}
          </span>
        </div>
        <div className="settings-simple-form">
          <input
            value={adminSecret}
            onChange={(event) => setAdminSecret(event.target.value)}
            placeholder="ADMIN_SECRET"
            type="password"
          />
        </div>
        <p className="settings-hint">
          {adminSecretRemembered ? '当前浏览器已记住该密钥，换设备、无痕模式或清理本地数据后需要重新输入。' : '用于调用受保护的管理接口，只保存在当前浏览器本地。'}
        </p>
      </article>
      <article className="card">
        <h2>OpenAI 网关</h2>
        <div className="settings-simple-form">
          <input
            value={openaiBaseUrl}
            onChange={(event) => setOpenaiBaseUrl(event.target.value)}
            placeholder="https://gateway.example.com/v1"
          />
        </div>
        <p className="settings-hint">可留空使用默认官方地址。</p>
      </article>
      <article className="card">
        <h2>OpenAI API Key</h2>
        <div className="settings-simple-form">
          <input
            value={openaiApiKey}
            onChange={(event) => setOpenaiApiKey(event.target.value)}
            placeholder={input.openaiApiKeyConfigured ? 'OpenAI API Key 已配置' : 'sk-...'}
            type="password"
          />
        </div>
        <p className="settings-hint">{input.openaiApiKeyConfigured ? '已配置，留空则保持现有 key。' : '配置后新采集的候选会尽量翻译成中文。'}</p>
      </article>
      <article className="card card--hero">
        <h2>推送渠道配置</h2>
        <p>在这里填写 Webhook 或令牌，并控制是否启用。</p>
        <div className="settings-form">
          {orderedConfigs.map((config) => (
            <div key={config.channel} className="settings-channel-row">
              <div className="settings-channel-head">
                <strong>{channelLabels[config.channel]}</strong>
                <label className="settings-toggle">
                  <input
                    type="checkbox"
                    checked={config.enabled}
                    onChange={(event) =>
                      setConfigs((current) =>
                        current.map((item) =>
                          item.channel === config.channel ? { ...item, enabled: event.target.checked } : item,
                        ),
                      )
                    }
                  />
                  <span>启用</span>
                </label>
              </div>
              <textarea
                value={config.secretPayload}
                placeholder={
                  config.hasSavedSecret
                    ? config.channel === 'wxpusher'
                      ? '已保存，留空则保持现有 appToken|uid'
                      : '已保存，留空则保持现有 Webhook URL'
                    : config.channel === 'wxpusher'
                      ? 'appToken|uid'
                      : 'Webhook URL'
                }
                onChange={(event) =>
                  setConfigs((current) =>
                    current.map((item) =>
                      item.channel === config.channel ? { ...item, secretPayload: event.target.value } : item,
                    ),
                  )
                }
              />
              {validatePushConfigSecretPayload(config) ? (
                <p className="action-status">{validatePushConfigSecretPayload(config)}</p>
              ) : null}
            </div>
          ))}
        </div>
        <div className="settings-actions">
          <button type="button" onClick={handleSave} disabled={!input.cloudReady || isSaving || Boolean(validationError)}>
            {isSaving ? '保存中...' : '保存推送配置'}
          </button>
          {!input.cloudReady ? <p className="action-status">当前未配置云端环境，配置保存已禁用。</p> : null}
          {status ? <p className="action-status">{status}</p> : null}
        </div>
      </article>
    </div>
  );
}
