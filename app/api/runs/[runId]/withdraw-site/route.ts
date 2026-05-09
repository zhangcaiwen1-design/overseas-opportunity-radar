import { NextResponse } from 'next/server';
import { hasCloudEnv } from '../../../../../src/cloud/cloudEnv';
import { handleWithdrawSiteRun } from '../../../../../src/cloud/routeHandlers/handleWithdrawSiteRun';

export async function POST(request: Request, context: { params: Promise<{ runId: string }> }) {
  const { runId } = await context.params;
  const adminSecret = process.env.ADMIN_SECRET;

  if (adminSecret && request.headers.get('x-admin-secret') !== adminSecret) {
    return NextResponse.json({ ok: false, runId, reason: 'unauthorized' }, { status: 401 });
  }

  if (!hasCloudEnv(process.env)) {
    return NextResponse.json({ ok: false, runId, reason: 'cloud env not configured' }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const selectedItemId = typeof body.selectedItemId === 'string' ? body.selectedItemId.trim() : '';

  if (!selectedItemId) {
    return NextResponse.json({ ok: false, runId, reason: 'selected item id required' }, { status: 400 });
  }

  const result = await handleWithdrawSiteRun(runId, selectedItemId, 'admin');
  return NextResponse.json({
    ok: true,
    runId,
    action: 'withdraw-site',
    selectedItemId: result.selectedItemId,
    contentVariantId: result.contentVariantId,
    channel: result.channel,
  });
}
