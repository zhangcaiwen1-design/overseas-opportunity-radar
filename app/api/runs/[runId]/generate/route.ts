import { NextResponse } from 'next/server';
import { hasCloudEnv } from '../../../../../src/cloud/cloudEnv';
import { handleGenerateRun } from '../../../../../src/cloud/routeHandlers/handleGenerateRun';

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
  const result = await handleGenerateRun(runId, body.selectedCandidateIds);
  return NextResponse.json({ ok: true, runId, action: 'generate', ...result });
}
