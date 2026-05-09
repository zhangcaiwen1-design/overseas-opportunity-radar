import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

describe('submitLeadCapture', () => {
  it('posts contact payload and returns success copy', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    const { submitLeadCapture } = await import('../app/site/LeadCaptureButton');

    const result = await submitLeadCapture(
      {
        sourceChannel: 'site',
        pageType: 'site_index',
        eventType: 'subscribe',
        contact: 'wechat-radar',
        notes: '想了解今天的机会摘要',
      },
      fetchMock as never,
    );

    expect(fetchMock).toHaveBeenCalledWith('/api/lead-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceChannel: 'site',
        pageType: 'site_index',
        eventType: 'subscribe',
        contact: 'wechat-radar',
        notes: '想了解今天的机会摘要',
      }),
    });
    expect(result).toBe('已收到，稍后联系你。');
  });

  it('returns fallback copy when lead event request fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false });
    const { submitLeadCapture } = await import('../app/site/LeadCaptureButton');

    const result = await submitLeadCapture(
      {
        sourceChannel: 'site',
        pageType: 'site_article',
        eventType: 'consult',
        contact: 'wechat-radar',
        notes: '',
      },
      fetchMock as never,
    );

    expect(result).toBe('提交失败，请稍后再试。');
  });

  it('renders contact fields for public lead capture', async () => {
    const { LeadCaptureButton } = await import('../app/site/LeadCaptureButton');

    const html = renderToStaticMarkup(
      React.createElement(LeadCaptureButton, {
        pageType: 'site_index',
        eventType: 'subscribe',
        label: '订阅',
      }),
    );

    expect(html).toContain('联系方式（微信 / 邮箱）');
    expect(html).toContain('补充说明（选填）');
    expect(html).toContain('订阅');
  });
});
