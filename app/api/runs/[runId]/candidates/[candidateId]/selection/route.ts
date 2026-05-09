import { NextResponse } from 'next/server';
import { hasCloudEnv } from '../../../../../../../src/cloud/cloudEnv';
import { handleCandidateSelection } from '../../../../../../../src/cloud/routeHandlers/handleCandidateSelection';
import type { SelectionState } from '../../../../../../../src/cloud/types';

const allowedSelectionStates: SelectionState[] = ['pending', 'selected', 'discarded'];

function isValidDraftSortOrder(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

export async function POST(request: Request, context: { params: Promise<{ runId: string; candidateId: string }> }) {
  const { runId, candidateId } = await context.params;
  const adminSecret = process.env.ADMIN_SECRET;

  if (adminSecret && request.headers.get('x-admin-secret') !== adminSecret) {
    return NextResponse.json({ ok: false, runId, candidateId, reason: 'unauthorized' }, { status: 401 });
  }

  if (!hasCloudEnv(process.env)) {
    return NextResponse.json({ ok: false, runId, candidateId, reason: 'cloud env not configured' }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const selectionState = body.selectionState;
  const hasDraftSortOrder = Object.prototype.hasOwnProperty.call(body, 'draftSortOrder');
  const draftSortOrder = hasDraftSortOrder && isValidDraftSortOrder(body.draftSortOrder) ? body.draftSortOrder : undefined;

  if (!allowedSelectionStates.includes(selectionState)) {
    return NextResponse.json({ ok: false, runId, candidateId, reason: 'invalid selection state' }, { status: 400 });
  }

  if (hasDraftSortOrder && !isValidDraftSortOrder(body.draftSortOrder)) {
    return NextResponse.json({ ok: false, runId, candidateId, reason: 'invalid draft sort order' }, { status: 400 });
  }

  if (hasDraftSortOrder && selectionState !== 'selected') {
    return NextResponse.json({ ok: false, runId, candidateId, reason: 'invalid draft sort order' }, { status: 400 });
  }

  const result = await handleCandidateSelection(runId, candidateId, selectionState, draftSortOrder);
  return NextResponse.json({ ok: true, action: 'candidate-selection', ...result });
}
