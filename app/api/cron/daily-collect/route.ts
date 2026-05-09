import { NextResponse } from 'next/server';
import { hasCloudEnv } from '../../../../src/cloud/cloudEnv';
import { loadCloudConfig } from '../../../../src/cloud/loadCloudConfig';
import { handleDailyCollect } from '../../../../src/cloud/routeHandlers/handleDailyCollect';

async function handleCronDailyCollect(request: Request) {
  if (!hasCloudEnv(process.env)) {
    return NextResponse.json({ ok: false, reason: 'cloud env not configured' }, { status: 503 });
  }

  const config = loadCloudConfig(process.env);
  const authorization = request.headers.get('authorization');

  if (authorization !== `Bearer ${config.cronSecret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const result = await handleDailyCollect('cron');
  return NextResponse.json({ ok: true, action: 'daily-collect', ...result });
}

export async function GET(request: Request) {
  return handleCronDailyCollect(request);
}

export async function POST(request: Request) {
  return handleCronDailyCollect(request);
}
