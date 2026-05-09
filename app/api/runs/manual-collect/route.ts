import { NextResponse } from 'next/server';
import { hasCloudEnv } from '../../../../src/cloud/cloudEnv';
import { handleDailyCollect } from '../../../../src/cloud/routeHandlers/handleDailyCollect';

export async function POST(request: Request) {
  const adminSecret = process.env.ADMIN_SECRET;
  if (adminSecret && request.headers.get('x-admin-secret') !== adminSecret) {
    return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
  }

  if (!hasCloudEnv(process.env)) {
    return NextResponse.json({ ok: false, reason: 'cloud env not configured' }, { status: 503 });
  }

  const result = await handleDailyCollect('manual');
  return NextResponse.json({ ok: true, action: 'manual-collect', ...result });
}
