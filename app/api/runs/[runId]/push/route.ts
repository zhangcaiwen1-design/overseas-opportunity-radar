import { NextResponse } from 'next/server';
import { hasCloudEnv } from '../../../../../src/cloud/cloudEnv';
import { handlePushRun } from '../../../../../src/cloud/routeHandlers/handlePushRun';

export async function POST(request: Request, context: { params: Promise<{ runId: string }> }) {
  const { runId } = await context.params;
  const adminSecret = process.env.ADMIN_SECRET;

  if (adminSecret && request.headers.get('x-admin-secret') !== adminSecret) {
    return NextResponse.json({ ok: false, runId, reason: 'unauthorized' }, { status: 401 });
  }

  if (!hasCloudEnv(process.env)) {
    return NextResponse.json({ ok: false, runId, reason: 'cloud env not configured' }, { status: 503 });
  }

  const result = await handlePushRun(runId);
  if (!result.ok) {
    return NextResponse.json({ ok: false, runId, action: 'push', reason: result.reason, status: result.status }, { status: 409 });
  }

  return NextResponse.json({ ok: true, runId, action: 'push', status: result.status });
}
