'use client';

import React, { useState } from 'react';

interface LeadCapturePayload {
  sourceChannel: 'site';
  pageType: 'site_index' | 'site_article';
  eventType: 'subscribe' | 'consult';
  contact: string;
  notes: string;
}

export async function submitLeadCapture(
  payload: LeadCapturePayload,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  try {
    const response = await fetchImpl('/api/lead-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return response.ok ? '已收到，稍后联系你。' : '提交失败，请稍后再试。';
  } catch {
    return '提交失败，请稍后再试。';
  }
}

export function LeadCaptureButton(input: { pageType: 'site_index' | 'site_article'; eventType: 'subscribe' | 'consult'; label: '订阅' | '咨询' }) {
  const [contact, setContact] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleClick() {
    if (submitting) {
      return;
    }

    if (!contact.trim()) {
      setStatus('请先填写联系方式。');
      return;
    }

    setSubmitting(true);
    const nextStatus = await submitLeadCapture({
      sourceChannel: 'site',
      pageType: input.pageType,
      eventType: input.eventType,
      contact: contact.trim(),
      notes: notes.trim(),
    });
    setStatus(nextStatus);
    setSubmitting(false);
  }

  return (
    <div className="site-lead-capture">
      <input
        type="text"
        placeholder="联系方式（微信 / 邮箱）"
        value={contact}
        onChange={(event) => setContact(event.target.value)}
      />
      <input
        type="text"
        placeholder="补充说明（选填）"
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
      />
      <button type="button" onClick={handleClick} disabled={submitting}>
        {input.label}
      </button>
      {status ? <span>{status}</span> : null}
    </div>
  );
}
