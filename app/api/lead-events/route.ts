import { NextResponse } from 'next/server';
import { createLeadEventRepository } from '../../../src/cloud/repositories/leadEventRepository';
import { createSupabaseServerClient } from '../../../src/cloud/supabase/serverClient';

const allowedSourceChannels = new Set(['site', 'wechat', 'douyin']);
const allowedPageTypes = new Set(['site_index', 'site_article']);
const allowedEventTypes = new Set(['subscribe', 'consult']);

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const sourceChannel = typeof body.sourceChannel === 'string' ? body.sourceChannel.trim() : '';
  const pageType = typeof body.pageType === 'string' ? body.pageType.trim() : '';
  const eventType = typeof body.eventType === 'string' ? body.eventType.trim() : '';
  const contact = typeof body.contact === 'string' ? body.contact.trim() : '';
  const notes = typeof body.notes === 'string' ? body.notes.trim() : '';

  if (!sourceChannel || !pageType || !eventType) {
    return NextResponse.json({ ok: false, reason: 'missing fields' }, { status: 400 });
  }

  if (!allowedEventTypes.has(eventType)) {
    return NextResponse.json({ ok: false, reason: 'invalid eventType' }, { status: 400 });
  }

  if (!allowedPageTypes.has(pageType) || !allowedSourceChannels.has(sourceChannel)) {
    return NextResponse.json({ ok: false, reason: 'invalid payload' }, { status: 400 });
  }

  if (!contact) {
    return NextResponse.json({ ok: false, reason: 'contact required' }, { status: 400 });
  }

  const repository = createLeadEventRepository(createSupabaseServerClient() as never);
  await repository.create({
    sourceChannel: sourceChannel as 'site' | 'wechat' | 'douyin',
    pageType,
    eventType: eventType as 'subscribe' | 'consult',
    contact,
    notes,
  });

  return NextResponse.json({ ok: true });
}
