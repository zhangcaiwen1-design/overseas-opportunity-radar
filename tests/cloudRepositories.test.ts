import { describe, expect, it, vi } from 'vitest';
import { createAppSettingsRepository } from '../src/cloud/repositories/appSettingsRepository';
import { createArtifactRepository } from '../src/cloud/repositories/artifactRepository';
import { createCandidateRepository } from '../src/cloud/repositories/candidateRepository';
import { createContentVariantRepository } from '../src/cloud/repositories/contentVariantRepository';
import { createLeadEventRepository } from '../src/cloud/repositories/leadEventRepository';
import { createPublicationLogRepository } from '../src/cloud/repositories/publicationLogRepository';
import { createPushConfigRepository } from '../src/cloud/repositories/pushConfigRepository';
import { createPushLogRepository } from '../src/cloud/repositories/pushLogRepository';
import { createRunRepository } from '../src/cloud/repositories/runRepository';
import { createSelectedItemRepository } from '../src/cloud/repositories/selectedItemRepository';

describe('createRunRepository', () => {
  it('creates a run with cron trigger metadata', async () => {
    const insert = vi.fn().mockReturnValue({
      select: () => ({
        single: async () => ({
          data: { id: 'run-1', date_key: '2026-05-08', trigger_type: 'cron', status: 'running' },
          error: null,
        }),
      }),
    });
    const from = vi.fn().mockReturnValue({ insert });
    const repository = createRunRepository({ from } as never);

    const run = await repository.create({ dateKey: '2026-05-08', triggerType: 'cron' });

    expect(from).toHaveBeenCalledWith('runs');
    expect(run.id).toBe('run-1');
    expect(run.triggerType).toBe('cron');
    expect(run.status).toBe('running');
  });

  it('gets a run by id', async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: 'run-1',
        date_key: '2026-05-08',
        trigger_type: 'manual',
        status: 'running',
        started_at: '2026-05-08T01:00:00.000Z',
        summary_text: '',
        error_message: '',
      },
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ single });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const repository = createRunRepository({ from } as never);

    const run = await repository.getById('run-1');

    expect(select).toHaveBeenCalledWith('id,date_key,trigger_type,status,started_at,summary_text,error_message');
    expect(eq).toHaveBeenCalledWith('id', 'run-1');
    expect(run).toEqual({
      id: 'run-1',
      dateKey: '2026-05-08',
      triggerType: 'manual',
      status: 'running',
      startedAt: '2026-05-08T01:00:00.000Z',
      summaryText: '',
      errorMessage: '',
    });
  });

  it('updates run status fields', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ update });
    const repository = createRunRepository({ from } as never);

    await repository.updateStatus('run-1', {
      status: 'completed',
      poolCount: 12,
      selectedCount: 3,
      summaryText: 'done',
      usedFallback: false,
      errorMessage: '',
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'completed',
        pool_count: 12,
        selected_count: 3,
        summary_text: 'done',
        used_fallback: false,
        error_message: '',
      }),
    );
    expect(eq).toHaveBeenCalledWith('id', 'run-1');
  });

  it('lists recent runs with counts', async () => {
    const limit = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'run-2',
          date_key: '2026-05-09',
          trigger_type: 'cron',
          status: 'completed',
          started_at: '2026-05-09T01:00:00.000Z',
          selected_count: 3,
          pool_count: 12,
          summary_text: 'done',
          error_message: '',
        },
      ],
      error: null,
    });
    const order = vi.fn().mockReturnValue({ limit });
    const select = vi.fn().mockReturnValue({ order });
    const from = vi.fn().mockReturnValue({ select });
    const repository = createRunRepository({ from } as never);

    const runs = await repository.listRecent();

    expect(runs).toEqual([
      {
        id: 'run-2',
        dateKey: '2026-05-09',
        triggerType: 'cron',
        status: 'completed',
        startedAt: '2026-05-09T01:00:00.000Z',
        selectedCount: 3,
        poolCount: 12,
        summaryText: 'done',
        errorMessage: '',
      },
    ]);
  });
});

describe('createCandidateRepository', () => {
  it('persists many candidates under a run', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ insert });
    const repository = createCandidateRepository({ from } as never);

    await repository.createMany('run-1', [
      {
        signalId: 'signal-1',
        source: 'github',
        title: 'Signal One',
        summary: 'summary',
        canonicalUrl: 'https://example.com/1',
        publishedAt: '2026-05-08T00:00:00.000Z',
        tags: ['ops'],
        rawScore: 40,
        rank: 1,
      },
    ]);

    expect(from).toHaveBeenCalledWith('candidates');
    expect(insert).toHaveBeenCalledWith([
      expect.objectContaining({ run_id: 'run-1', signal_id: 'signal-1', rank: 1 }),
    ]);
  });

  it('updates candidate selection state within a run', async () => {
    const secondEq = vi.fn().mockResolvedValue({ error: null });
    const firstEq = vi.fn().mockReturnValue({ eq: secondEq });
    const update = vi.fn().mockReturnValue({ eq: firstEq });
    const from = vi.fn().mockReturnValue({ update });
    const repository = createCandidateRepository({ from } as never);

    await repository.updateSelectionState('run-1', 'candidate-1', 'selected');

    expect(update).toHaveBeenCalledWith({ selection_state: 'selected' });
    expect(firstEq).toHaveBeenCalledWith('run_id', 'run-1');
    expect(secondEq).toHaveBeenCalledWith('id', 'candidate-1');
  });

  it('persists the draft sort order while updating selection state', async () => {
    const secondEq = vi.fn().mockResolvedValue({ error: null });
    const firstEq = vi.fn().mockReturnValue({ eq: secondEq });
    const update = vi.fn().mockReturnValue({ eq: firstEq });
    const from = vi.fn().mockReturnValue({ update });
    const repository = createCandidateRepository({ from } as never);

    await repository.updateSelectionState('run-1', 'candidate-1', 'selected', 2);

    expect(update).toHaveBeenCalledWith({ selection_state: 'selected', draft_sort_order: 2 });
  });
});

describe('createArtifactRepository', () => {
  it('deletes artifacts by run and type', async () => {
    const deleteEqArtifactType = vi.fn().mockResolvedValue({ error: null });
    const deleteEqRunId = vi.fn().mockReturnValue({ eq: deleteEqArtifactType });
    const deleteArtifact = vi.fn().mockReturnValue({ eq: deleteEqRunId });
    const from = vi.fn().mockReturnValue({ delete: deleteArtifact });
    const repository = createArtifactRepository({ from } as never);

    await repository.deleteByRunAndType('run-1', 'push_execution');

    expect(from).toHaveBeenCalledWith('artifacts');
    expect(deleteEqRunId).toHaveBeenCalledWith('run_id', 'run-1');
    expect(deleteEqArtifactType).toHaveBeenCalledWith('artifact_type', 'push_execution');
  });

  it('lists run artifacts ordered as stored', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        {
          selected_item_id: null,
          artifact_type: 'push_digest',
          public_url: 'https://cdn.example.com/push.txt',
          storage_path: 'runs/2026-05-08/push-digest.txt',
        },
      ],
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const repository = createArtifactRepository({ from } as never);

    const artifacts = await repository.listByRun('run-1');

    expect(artifacts[0]).toEqual({
      artifactType: 'push_digest',
      publicUrl: 'https://cdn.example.com/push.txt',
      storagePath: 'runs/2026-05-08/push-digest.txt',
      selectedItemId: undefined,
    });
  });

  it('lists artifacts across multiple runs', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        {
          run_id: 'run-1',
          selected_item_id: 'selected-1',
          artifact_type: 'selected_html',
          public_url: 'https://cdn.example.com/run-1.html',
          storage_path: 'runs/2026-05-08/run-1.html',
        },
        {
          run_id: 'run-2',
          selected_item_id: null,
          artifact_type: 'push_digest',
          public_url: 'https://cdn.example.com/run-2.txt',
          storage_path: 'runs/2026-05-09/push-digest.txt',
        },
      ],
      error: null,
    });
    const inFilter = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ in: inFilter });
    const from = vi.fn().mockReturnValue({ select });
    const repository = createArtifactRepository({ from } as never);

    const artifacts = await repository.listByRunIds(['run-1', 'run-2']);

    expect(artifacts).toEqual([
      {
        runId: 'run-1',
        selectedItemId: 'selected-1',
        artifactType: 'selected_html',
        publicUrl: 'https://cdn.example.com/run-1.html',
        storagePath: 'runs/2026-05-08/run-1.html',
      },
      {
        runId: 'run-2',
        selectedItemId: undefined,
        artifactType: 'push_digest',
        publicUrl: 'https://cdn.example.com/run-2.txt',
        storagePath: 'runs/2026-05-09/push-digest.txt',
      },
    ]);
  });
});

describe('createPushConfigRepository', () => {
  it('returns enabled push configs', async () => {
    const eq = vi.fn().mockResolvedValue({
      data: [{ channel: 'feishu', enabled: true, secret_payload: 'https://example.com/feishu' }],
      error: null,
    });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const repository = createPushConfigRepository({ from } as never);

    const configs = await repository.listEnabled();

    expect(configs).toEqual([{ channel: 'feishu', enabled: true, secretPayload: 'https://example.com/feishu' }]);
  });

  it('lists and saves all push configs', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [{ channel: 'wecom', enabled: false, secret_payload: 'https://example.com/wecom' }],
      error: null,
    });
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const select = vi.fn().mockReturnValue({ order });
    const from = vi.fn().mockReturnValue({ select, upsert });
    const repository = createPushConfigRepository({ from } as never);

    const allConfigs = await repository.listAll();
    await repository.saveMany([{ channel: 'wecom', enabled: true, secretPayload: 'https://example.com/wecom' }]);

    expect(allConfigs).toEqual([{ channel: 'wecom', enabled: false, secretPayload: 'https://example.com/wecom' }]);
    expect(upsert).toHaveBeenCalledWith(
      [{ channel: 'wecom', enabled: true, secret_payload: 'https://example.com/wecom' }],
      { onConflict: 'channel' },
    );
  });

  it('uses channel as the unique upsert key', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ upsert });
    const repository = createPushConfigRepository({ from, select: vi.fn() } as never);

    await repository.saveMany([{ channel: 'feishu', enabled: true, secretPayload: 'https://example.com/feishu' }]);

    expect(upsert).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ onConflict: 'channel' }),
    );
  });
});

describe('createPushLogRepository', () => {
  it('deletes push logs by run id', async () => {
    const deleteEqRunId = vi.fn().mockResolvedValue({ error: null });
    const deletePushLogs = vi.fn().mockReturnValue({ eq: deleteEqRunId });
    const from = vi.fn().mockReturnValue({ delete: deletePushLogs });
    const repository = createPushLogRepository({ from } as never);

    await repository.deleteByRunId('run-1');

    expect(from).toHaveBeenCalledWith('push_logs');
    expect(deleteEqRunId).toHaveBeenCalledWith('run_id', 'run-1');
  });

  it('creates push log rows', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ insert });
    const repository = createPushLogRepository({ from } as never);

    await repository.create({ runId: 'run-1', channel: 'feishu', status: 'success', responseSummary: 'ok' });

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ run_id: 'run-1', channel: 'feishu' }));
  });

  it('lists push logs across multiple runs', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        {
          run_id: 'run-1',
          channel: 'feishu',
          status: 'success',
          response_summary: 'ok',
          pushed_at: '2026-05-09T01:05:00.000Z',
        },
      ],
      error: null,
    });
    const inFilter = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ in: inFilter });
    const from = vi.fn().mockReturnValue({ select });
    const repository = createPushLogRepository({ from } as never);

    const logs = await repository.listByRunIds(['run-1']);

    expect(logs).toEqual([
      {
        runId: 'run-1',
        channel: 'feishu',
        status: 'success',
        responseSummary: 'ok',
        pushedAt: '2026-05-09T01:05:00.000Z',
      },
    ]);
  });
});

describe('createSelectedItemRepository', () => {
  it('deletes selected items by run id', async () => {
    const deleteEqRunId = vi.fn().mockResolvedValue({ error: null });
    const deleteSelectedItems = vi.fn().mockReturnValue({ eq: deleteEqRunId });
    const from = vi.fn().mockReturnValue({ delete: deleteSelectedItems });
    const repository = createSelectedItemRepository({ from } as never);

    await repository.deleteByRunId('run-1');

    expect(from).toHaveBeenCalledWith('selected_items');
    expect(deleteEqRunId).toHaveBeenCalledWith('run_id', 'run-1');
  });

  it('lists selected items for a run', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [{ id: 'selected-1', candidate_id: 'candidate-1', slug: 'alpha', title: '精选一', status: 'completed' }],
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const repository = createSelectedItemRepository({ from } as never);

    const rows = await repository.listByRun('run-1');

    expect(rows).toEqual([{ id: 'selected-1', candidateId: 'candidate-1', slug: 'alpha', title: '精选一', status: 'completed' }]);
  });
});

describe('createContentVariantRepository', () => {
  it('creates a content variant under a run', async () => {
    const insert = vi.fn().mockReturnValue({
      select: () => ({
        single: async () => ({
          data: {
            id: 'variant-1',
            run_id: 'run-1',
            candidate_id: 'candidate-1',
            selected_item_id: null,
            channel: 'wechat',
            title: '公众号标题',
            body: '正文内容',
            status: 'draft',
            published_at: null,
            review_notes: '待审核',
          },
          error: null,
        }),
      }),
    });
    const from = vi.fn().mockReturnValue({ insert });
    const repository = createContentVariantRepository({ from } as never);

    const variant = await repository.create({
      runId: 'run-1',
      candidateId: 'candidate-1',
      channel: 'wechat',
      title: '公众号标题',
      body: '正文内容',
      reviewNotes: '待审核',
    });

    expect(from).toHaveBeenCalledWith('content_variants');
    expect(insert).toHaveBeenCalledWith({
      run_id: 'run-1',
      candidate_id: 'candidate-1',
      channel: 'wechat',
      title: '公众号标题',
      body: '正文内容',
      status: 'draft',
      review_notes: '待审核',
    });
    expect(variant).toEqual({
      id: 'variant-1',
      runId: 'run-1',
      candidateId: 'candidate-1',
      selectedItemId: undefined,
      channel: 'wechat',
      title: '公众号标题',
      body: '正文内容',
      status: 'draft',
      publishedAt: undefined,
      reviewNotes: '待审核',
    });
  });

  it('creates a content variant without optional fields by omitting those payload keys', async () => {
    const insert = vi.fn().mockReturnValue({
      select: () => ({
        single: async () => ({
          data: {
            id: 'variant-2',
            run_id: 'run-1',
            candidate_id: null,
            selected_item_id: null,
            channel: 'site',
            title: '站点标题',
            body: '站点正文',
            status: 'draft',
            published_at: null,
            review_notes: '',
          },
          error: null,
        }),
      }),
    });
    const from = vi.fn().mockReturnValue({ insert });
    const repository = createContentVariantRepository({ from } as never);

    await repository.create({
      runId: 'run-1',
      channel: 'site',
      title: '站点标题',
      body: '站点正文',
    });

    expect(insert).toHaveBeenCalledWith({
      run_id: 'run-1',
      channel: 'site',
      title: '站点标题',
      body: '站点正文',
      status: 'draft',
    });
  });

  it('lists content variants by run', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'variant-1',
          run_id: 'run-1',
          candidate_id: null,
          selected_item_id: 'selected-1',
          channel: 'site',
          title: '站点标题',
          body: '站点正文',
          status: 'published',
          published_at: '2026-05-09T02:00:00.000Z',
          review_notes: null,
        },
      ],
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const repository = createContentVariantRepository({ from } as never);

    const variants = await repository.listByRun('run-1');

    expect(select).toHaveBeenCalledWith(
      'id,run_id,candidate_id,selected_item_id,channel,title,body,status,published_at,review_notes',
    );
    expect(eq).toHaveBeenCalledWith('run_id', 'run-1');
    expect(variants).toEqual([
      {
        id: 'variant-1',
        runId: 'run-1',
        candidateId: undefined,
        selectedItemId: 'selected-1',
        channel: 'site',
        title: '站点标题',
        body: '站点正文',
        status: 'published',
        publishedAt: '2026-05-09T02:00:00.000Z',
        reviewNotes: '',
      },
    ]);
  });

  it('lists published content variants by channel in published order', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'variant-2',
          run_id: 'run-2',
          candidate_id: 'candidate-2',
          selected_item_id: 'selected-2',
          channel: 'site',
          title: '站点标题二',
          body: '站点摘要二',
          status: 'published',
          published_at: '2026-05-09T03:00:00.000Z',
          review_notes: null,
        },
      ],
      error: null,
    });
    const statusEq = vi.fn().mockReturnValue({ order });
    const channelEq = vi.fn().mockReturnValue({ eq: statusEq });
    const select = vi.fn().mockReturnValue({ eq: channelEq });
    const from = vi.fn().mockReturnValue({ select });
    const repository = createContentVariantRepository({ from } as never);

    const variants = await repository.listPublishedByChannel('site');

    expect(channelEq).toHaveBeenCalledWith('channel', 'site');
    expect(statusEq).toHaveBeenCalledWith('status', 'published');
    expect(order).toHaveBeenCalledWith('published_at', { ascending: false });
    expect(variants).toEqual([
      {
        id: 'variant-2',
        runId: 'run-2',
        candidateId: 'candidate-2',
        selectedItemId: 'selected-2',
        channel: 'site',
        title: '站点标题二',
        body: '站点摘要二',
        status: 'published',
        publishedAt: '2026-05-09T03:00:00.000Z',
        reviewNotes: '',
      },
    ]);
  });

  it('lists content variants across multiple runs in one query', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'variant-2',
          run_id: 'run-2',
          candidate_id: 'candidate-2',
          selected_item_id: 'selected-2',
          channel: 'site',
          title: '站点标题二',
          body: '站点摘要二',
          status: 'published',
          published_at: '2026-05-09T03:00:00.000Z',
          review_notes: null,
        },
        {
          id: 'variant-1',
          run_id: 'run-1',
          candidate_id: null,
          selected_item_id: 'selected-1',
          channel: 'wechat',
          title: '公众号标题一',
          body: '公众号正文一',
          status: 'draft',
          published_at: null,
          review_notes: '待审核',
        },
      ],
      error: null,
    });
    const inFilter = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ in: inFilter });
    const from = vi.fn().mockReturnValue({ select });
    const repository = createContentVariantRepository({ from } as never);

    const variants = await repository.listByRunIds(['run-1', 'run-2']);

    expect(select).toHaveBeenCalledWith(
      'id,run_id,candidate_id,selected_item_id,channel,title,body,status,published_at,review_notes',
    );
    expect(inFilter).toHaveBeenCalledWith('run_id', ['run-1', 'run-2']);
    expect(order).toHaveBeenCalledWith('published_at', { ascending: false });
    expect(variants).toEqual([
      {
        id: 'variant-2',
        runId: 'run-2',
        candidateId: 'candidate-2',
        selectedItemId: 'selected-2',
        channel: 'site',
        title: '站点标题二',
        body: '站点摘要二',
        status: 'published',
        publishedAt: '2026-05-09T03:00:00.000Z',
        reviewNotes: '',
      },
      {
        id: 'variant-1',
        runId: 'run-1',
        candidateId: undefined,
        selectedItemId: 'selected-1',
        channel: 'wechat',
        title: '公众号标题一',
        body: '公众号正文一',
        status: 'draft',
        publishedAt: undefined,
        reviewNotes: '待审核',
      },
    ]);
  });

  it('updates an existing content variant to published', async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: 'variant-1',
        run_id: 'run-1',
        candidate_id: 'candidate-1',
        selected_item_id: 'selected-1',
        channel: 'site',
        title: 'Alpha',
        body: 'Alpha summary',
        status: 'published',
        published_at: '2026-05-09T03:30:00.000Z',
        review_notes: null,
      },
      error: null,
    });
    const selectAfterUpdate = vi.fn().mockReturnValue({ single });
    const eq = vi.fn().mockReturnValue({ select: selectAfterUpdate });
    const update = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ update });
    const repository = createContentVariantRepository({ from } as never);

    const variant = await repository.updateById('variant-1', {
      candidateId: 'candidate-1',
      title: 'Alpha',
      body: 'Alpha summary',
      status: 'published',
      publishedAt: '2026-05-09T03:30:00.000Z',
    });

    expect(update).toHaveBeenCalledWith({
      candidate_id: 'candidate-1',
      title: 'Alpha',
      body: 'Alpha summary',
      status: 'published',
      published_at: '2026-05-09T03:30:00.000Z',
    });
    expect(eq).toHaveBeenCalledWith('id', 'variant-1');
    expect(variant).toEqual({
      id: 'variant-1',
      runId: 'run-1',
      candidateId: 'candidate-1',
      selectedItemId: 'selected-1',
      channel: 'site',
      title: 'Alpha',
      body: 'Alpha summary',
      status: 'published',
      publishedAt: '2026-05-09T03:30:00.000Z',
      reviewNotes: '',
    });
  });
});

describe('createPublicationLogRepository', () => {
  it('creates a publication log row', async () => {
    const insert = vi.fn().mockReturnValue({
      select: () => ({
        single: async () => ({
          data: {
            id: 'log-1',
            content_variant_id: 'variant-1',
            channel: 'wechat',
            action: 'publish',
            status: 'success',
            response_summary: 'ok',
            operator: 'system',
            created_at: '2026-05-09T03:00:00.000Z',
          },
          error: null,
        }),
      }),
    });
    const from = vi.fn().mockReturnValue({ insert });
    const repository = createPublicationLogRepository({ from } as never);

    const log = await repository.create({
      contentVariantId: 'variant-1',
      channel: 'wechat',
      action: 'publish',
      status: 'success',
      responseSummary: 'ok',
      operator: 'system',
    });

    expect(from).toHaveBeenCalledWith('publication_logs');
    expect(insert).toHaveBeenCalledWith({
      content_variant_id: 'variant-1',
      channel: 'wechat',
      action: 'publish',
      status: 'success',
      response_summary: 'ok',
      operator: 'system',
    });
    expect(log).toEqual({
      id: 'log-1',
      contentVariantId: 'variant-1',
      channel: 'wechat',
      action: 'publish',
      status: 'success',
      responseSummary: 'ok',
      operator: 'system',
      createdAt: '2026-05-09T03:00:00.000Z',
    });
  });

  it('returns an empty list when publication log query ids are empty', async () => {
    const from = vi.fn();
    const repository = createPublicationLogRepository({ from } as never);

    const logs = await repository.listByContentVariantIds([]);

    expect(logs).toEqual([]);
    expect(from).not.toHaveBeenCalled();
  });

  it('lists publication logs by content variant ids', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'log-1',
          content_variant_id: 'variant-1',
          channel: 'site',
          action: 'retry',
          status: 'failed',
          response_summary: 'timeout',
          operator: 'editor',
          created_at: '2026-05-09T03:10:00.000Z',
        },
      ],
      error: null,
    });
    const inFilter = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ in: inFilter });
    const from = vi.fn().mockReturnValue({ select });
    const repository = createPublicationLogRepository({ from } as never);

    const logs = await repository.listByContentVariantIds(['variant-1']);

    expect(select).toHaveBeenCalledWith(
      'id,content_variant_id,channel,action,status,response_summary,operator,created_at',
    );
    expect(inFilter).toHaveBeenCalledWith('content_variant_id', ['variant-1']);
    expect(logs).toEqual([
      {
        id: 'log-1',
        contentVariantId: 'variant-1',
        channel: 'site',
        action: 'retry',
        status: 'failed',
        responseSummary: 'timeout',
        operator: 'editor',
        createdAt: '2026-05-09T03:10:00.000Z',
      },
    ]);
  });
});

describe('createLeadEventRepository', () => {
  it('creates a lead event row', async () => {
    const insert = vi.fn().mockReturnValue({
      select: () => ({
        single: async () => ({
          data: {
            id: 'lead-1',
            source_channel: 'wechat',
            page_type: 'site_article',
            event_type: 'subscribe',
            created_at: '2026-05-09T04:00:00.000Z',
          },
          error: null,
        }),
      }),
    });
    const from = vi.fn().mockReturnValue({ insert });
    const repository = createLeadEventRepository({ from } as never);

    const event = await repository.create({
      sourceChannel: 'wechat',
      pageType: 'site_article',
      eventType: 'subscribe',
      contact: 'founder@example.com',
      notes: '想看案例',
    });

    expect(from).toHaveBeenCalledWith('lead_events');
    expect(insert).toHaveBeenCalledWith({
      source_channel: 'wechat',
      page_type: 'site_article',
      event_type: 'subscribe',
      contact: 'founder@example.com',
      notes: '想看案例',
    });
    expect(event).toEqual({
      id: 'lead-1',
      sourceChannel: 'wechat',
      pageType: 'site_article',
      eventType: 'subscribe',
      contact: '',
      notes: '',
      createdAt: '2026-05-09T04:00:00.000Z',
    });
  });

  it('lists recent lead events with the default limit', async () => {
    const limit = vi.fn().mockResolvedValue({ data: [], error: null });
    const order = vi.fn().mockReturnValue({ limit });
    const select = vi.fn().mockReturnValue({ order });
    const from = vi.fn().mockReturnValue({ select });
    const repository = createLeadEventRepository({ from } as never);

    await repository.listRecent();

    expect(limit).toHaveBeenCalledWith(20);
  });

  it('returns mapped lead events in created_at descending order', async () => {
    const limit = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'lead-2',
          source_channel: 'site',
          page_type: 'site_article',
          event_type: 'consult',
          contact: 'wechat-radar',
          notes: '',
          created_at: '2026-05-09T04:06:00.000Z',
        },
        {
          id: 'lead-1',
          source_channel: 'site',
          page_type: 'site_index',
          event_type: 'subscribe',
          contact: 'founder@example.com',
          notes: '想看案例',
          created_at: '2026-05-09T04:05:00.000Z',
        },
      ],
      error: null,
    });
    const order = vi.fn().mockReturnValue({ limit });
    const select = vi.fn().mockReturnValue({ order });
    const from = vi.fn().mockReturnValue({ select });
    const repository = createLeadEventRepository({ from } as never);

    const events = await repository.listRecent(2);

    expect(events).toEqual([
      {
        id: 'lead-2',
        sourceChannel: 'site',
        pageType: 'site_article',
        eventType: 'consult',
        contact: 'wechat-radar',
        notes: '',
        createdAt: '2026-05-09T04:06:00.000Z',
      },
      {
        id: 'lead-1',
        sourceChannel: 'site',
        pageType: 'site_index',
        eventType: 'subscribe',
        contact: 'founder@example.com',
        notes: '想看案例',
        createdAt: '2026-05-09T04:05:00.000Z',
      },
    ]);
  });

  it('lists recent lead events with a custom limit', async () => {
    const limit = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'lead-1',
          source_channel: 'douyin',
          page_type: 'site_article',
          event_type: 'consult',
          contact: 'wechat-radar',
          notes: '',
          created_at: '2026-05-09T04:05:00.000Z',
        },
      ],
      error: null,
    });
    const order = vi.fn().mockReturnValue({ limit });
    const select = vi.fn().mockReturnValue({ order });
    const from = vi.fn().mockReturnValue({ select });
    const repository = createLeadEventRepository({ from } as never);

    const events = await repository.listRecent(5);

    expect(select).toHaveBeenCalledWith('id,source_channel,page_type,event_type,contact,notes,created_at');
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(limit).toHaveBeenCalledWith(5);
    expect(events).toEqual([
      {
        id: 'lead-1',
        sourceChannel: 'douyin',
        pageType: 'site_article',
        eventType: 'consult',
        contact: 'wechat-radar',
        notes: '',
        createdAt: '2026-05-09T04:05:00.000Z',
      },
    ]);
  });
});

describe('createAppSettingsRepository', () => {
  it('lists and saves app settings', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [{ key: 'timezone', value: 'Asia/Shanghai' }],
      error: null,
    });
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const select = vi.fn().mockReturnValue({ order });
    const from = vi.fn().mockReturnValue({ select, upsert });
    const repository = createAppSettingsRepository({ from } as never);

    const entries = await repository.listAll();
    await repository.saveMany([{ key: 'dailyRunTime', value: '09:00' }]);

    expect(entries).toEqual([{ key: 'timezone', value: 'Asia/Shanghai' }]);
    expect(upsert).toHaveBeenCalledWith([{ key: 'dailyRunTime', value: '09:00' }], { onConflict: 'key' });
  });
});
