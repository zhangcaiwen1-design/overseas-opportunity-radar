import { beforeEach, describe, expect, it, vi } from 'vitest';

const createSupabaseServerClient = vi.fn();
const createContentVariantRepository = vi.fn();
const createSelectedItemRepository = vi.fn();
const createCandidateRepository = vi.fn();
const createArtifactRepository = vi.fn();
const createPublicationLogRepository = vi.fn();

vi.mock('../src/cloud/supabase/serverClient', () => ({
  createSupabaseServerClient,
}));

vi.mock('../src/cloud/repositories/contentVariantRepository', () => ({
  createContentVariantRepository,
}));

vi.mock('../src/cloud/repositories/selectedItemRepository', () => ({
  createSelectedItemRepository,
}));

vi.mock('../src/cloud/repositories/candidateRepository', () => ({
  createCandidateRepository,
}));

vi.mock('../src/cloud/repositories/artifactRepository', () => ({
  createArtifactRepository,
}));

vi.mock('../src/cloud/repositories/publicationLogRepository', () => ({
  createPublicationLogRepository,
}));

describe('handlePublishSiteRun', () => {
  const contentVariantRepository = {
    listByRun: vi.fn(),
    create: vi.fn(),
    updateById: vi.fn(),
  };
  const selectedItemRepository = {
    listByRun: vi.fn(),
    updateById: vi.fn(),
  };
  const candidateRepository = {
    listByRun: vi.fn(),
  };
  const artifactRepository = {
    listByRun: vi.fn(),
  };
  const publicationLogRepository = {
    create: vi.fn(),
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-09T03:30:00.000Z'));
    vi.resetAllMocks();
    createSupabaseServerClient.mockReturnValue({});
    createContentVariantRepository.mockReturnValue(contentVariantRepository);
    createSelectedItemRepository.mockReturnValue(selectedItemRepository);
    createCandidateRepository.mockReturnValue(candidateRepository);
    createArtifactRepository.mockReturnValue(artifactRepository);
    createPublicationLogRepository.mockReturnValue(publicationLogRepository);

    selectedItemRepository.listByRun.mockResolvedValue([
      { id: 'selected-1', candidateId: 'candidate-1', slug: 'alpha', title: 'Alpha', status: 'completed' },
    ]);
    candidateRepository.listByRun.mockResolvedValue([
      {
        id: 'candidate-1',
        title: 'Alpha',
        source: 'github',
        summary: 'Alpha summary',
        rank: 1,
        selectionState: 'selected',
        tags: ['ops'],
        canonicalUrl: 'https://example.com/alpha',
      },
    ]);
    artifactRepository.listByRun.mockResolvedValue([
      { selectedItemId: 'selected-1', artifactType: 'selected_html', publicUrl: 'https://cdn.example.com/alpha.html', storagePath: 'runs/2026-05-09/selected/alpha.html' },
      { selectedItemId: 'selected-1', artifactType: 'selected_markdown', publicUrl: 'https://cdn.example.com/alpha.md', storagePath: 'runs/2026-05-09/selected/alpha.md' },
      { selectedItemId: 'selected-1', artifactType: 'selected_png', publicUrl: 'https://cdn.example.com/alpha.png', storagePath: 'runs/2026-05-09/selected/alpha.png' },
    ]);
    publicationLogRepository.create.mockResolvedValue({
      id: 'log-1',
      contentVariantId: 'variant-1',
      channel: 'site',
      action: 'publish',
      status: 'success',
      responseSummary: 'published to site',
      operator: 'admin',
      createdAt: '2026-05-09T03:30:00.000Z',
    });
    selectedItemRepository.updateById.mockResolvedValue({
      id: 'selected-1',
      candidateId: 'candidate-1',
      slug: 'alpha',
      title: 'Alpha',
      status: 'published',
    });
  });

  it('creates a published site variant and publication log when no site variant exists yet', async () => {
    contentVariantRepository.listByRun.mockResolvedValue([]);
    contentVariantRepository.create.mockResolvedValue({
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

    const { handlePublishSiteRun } = await import('../src/cloud/routeHandlers/handlePublishSiteRun');
    const result = await handlePublishSiteRun('run-1', 'selected-1', 'admin');

    expect(contentVariantRepository.create).toHaveBeenCalledWith({
      runId: 'run-1',
      candidateId: 'candidate-1',
      selectedItemId: 'selected-1',
      channel: 'site',
      title: 'Alpha',
      body: 'Alpha summary',
      status: 'published',
      publishedAt: '2026-05-09T03:30:00.000Z',
    });
    expect(publicationLogRepository.create).toHaveBeenCalledWith({
      contentVariantId: 'variant-1',
      channel: 'site',
      action: 'publish',
      status: 'success',
      responseSummary: 'published to site',
      operator: 'admin',
    });
    expect(selectedItemRepository.updateById).toHaveBeenCalledWith('selected-1', { status: 'published' });
    expect(result).toEqual({
      runId: 'run-1',
      selectedItemId: 'selected-1',
      contentVariantId: 'variant-1',
      action: 'publish',
      channel: 'site',
      publishedAt: '2026-05-09T03:30:00.000Z',
    });
  });

  it('updates the existing site variant to published instead of creating a duplicate', async () => {
    contentVariantRepository.listByRun.mockResolvedValue([
      {
        id: 'variant-1',
        runId: 'run-1',
        candidateId: 'candidate-1',
        selectedItemId: 'selected-1',
        channel: 'site',
        title: 'Old title',
        body: 'Old body',
        status: 'draft',
        publishedAt: undefined,
        reviewNotes: '',
      },
    ]);
    contentVariantRepository.updateById.mockResolvedValue({
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

    const { handlePublishSiteRun } = await import('../src/cloud/routeHandlers/handlePublishSiteRun');
    await handlePublishSiteRun('run-1', 'selected-1', 'admin');

    expect(contentVariantRepository.create).not.toHaveBeenCalled();
    expect(contentVariantRepository.updateById).toHaveBeenCalledWith('variant-1', {
      candidateId: 'candidate-1',
      title: 'Alpha',
      body: 'Alpha summary',
      status: 'published',
      publishedAt: '2026-05-09T03:30:00.000Z',
    });
  });

  it('throws when the selected item has no required site artifacts', async () => {
    contentVariantRepository.listByRun.mockResolvedValue([]);
    artifactRepository.listByRun.mockResolvedValue([
      { selectedItemId: 'selected-1', artifactType: 'selected_markdown', publicUrl: 'https://cdn.example.com/alpha.md', storagePath: 'runs/2026-05-09/selected/alpha.md' },
    ]);

    const { handlePublishSiteRun } = await import('../src/cloud/routeHandlers/handlePublishSiteRun');

    await expect(handlePublishSiteRun('run-1', 'selected-1', 'admin')).rejects.toThrow('site artifacts unavailable');
    expect(contentVariantRepository.create).not.toHaveBeenCalled();
    expect(publicationLogRepository.create).not.toHaveBeenCalled();
  });

  it('falls back to selected item publish state when content_variants is missing', async () => {
    contentVariantRepository.listByRun.mockRejectedValue({
      code: 'PGRST205',
      message: "Could not find the table 'public.content_variants' in the schema cache",
    });

    const { handlePublishSiteRun } = await import('../src/cloud/routeHandlers/handlePublishSiteRun');
    const result = await handlePublishSiteRun('run-1', 'selected-1', 'admin');

    expect(contentVariantRepository.create).not.toHaveBeenCalled();
    expect(contentVariantRepository.updateById).not.toHaveBeenCalled();
    expect(publicationLogRepository.create).not.toHaveBeenCalled();
    expect(selectedItemRepository.updateById).toHaveBeenCalledWith('selected-1', { status: 'published' });
    expect(result).toEqual({
      runId: 'run-1',
      selectedItemId: 'selected-1',
      contentVariantId: 'selected-1',
      action: 'publish',
      channel: 'site',
      publishedAt: '2026-05-09T03:30:00.000Z',
    });
  });

  it('withdraws an existing published site variant and records a withdraw log', async () => {
    contentVariantRepository.listByRun.mockResolvedValue([
      {
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
      },
    ]);
    contentVariantRepository.updateById.mockResolvedValue({
      id: 'variant-1',
      runId: 'run-1',
      candidateId: 'candidate-1',
      selectedItemId: 'selected-1',
      channel: 'site',
      title: 'Alpha',
      body: 'Alpha summary',
      status: 'reviewed',
      publishedAt: '2026-05-09T03:30:00.000Z',
      reviewNotes: '',
    });

    const { handleWithdrawSiteRun } = await import('../src/cloud/routeHandlers/handleWithdrawSiteRun');
    const result = await handleWithdrawSiteRun('run-1', 'selected-1', 'admin');

    expect(contentVariantRepository.updateById).toHaveBeenCalledWith('variant-1', {
      candidateId: 'candidate-1',
      title: 'Alpha',
      body: 'Alpha summary',
      status: 'reviewed',
      publishedAt: '2026-05-09T03:30:00.000Z',
    });
    expect(publicationLogRepository.create).toHaveBeenCalledWith({
      contentVariantId: 'variant-1',
      channel: 'site',
      action: 'withdraw',
      status: 'success',
      responseSummary: 'withdrawn from site',
      operator: 'admin',
    });
    expect(result).toEqual({
      runId: 'run-1',
      selectedItemId: 'selected-1',
      contentVariantId: 'variant-1',
      action: 'withdraw',
      channel: 'site',
    });
  });

  it('falls back to selected item state when withdrawing while content_variants is missing', async () => {
    selectedItemRepository.listByRun.mockResolvedValue([
      { id: 'selected-1', candidateId: 'candidate-1', slug: 'alpha', title: 'Alpha', status: 'published' },
    ]);
    selectedItemRepository.updateById.mockResolvedValue({
      id: 'selected-1',
      candidateId: 'candidate-1',
      slug: 'alpha',
      title: 'Alpha',
      status: 'completed',
    });
    contentVariantRepository.listByRun.mockRejectedValue({
      code: 'PGRST205',
      message: "Could not find the table 'public.content_variants' in the schema cache",
    });

    const { handleWithdrawSiteRun } = await import('../src/cloud/routeHandlers/handleWithdrawSiteRun');
    const result = await handleWithdrawSiteRun('run-1', 'selected-1', 'admin');

    expect(contentVariantRepository.updateById).not.toHaveBeenCalled();
    expect(publicationLogRepository.create).not.toHaveBeenCalled();
    expect(selectedItemRepository.updateById).toHaveBeenCalledWith('selected-1', { status: 'completed' });
    expect(result).toEqual({
      runId: 'run-1',
      selectedItemId: 'selected-1',
      contentVariantId: 'selected-1',
      action: 'withdraw',
      channel: 'site',
    });
  });

  it('throws when trying to withdraw a site variant that is not currently published', async () => {
    contentVariantRepository.listByRun.mockResolvedValue([
      {
        id: 'variant-1',
        runId: 'run-1',
        candidateId: 'candidate-1',
        selectedItemId: 'selected-1',
        channel: 'site',
        title: 'Alpha',
        body: 'Alpha summary',
        status: 'reviewed',
        publishedAt: '2026-05-09T03:30:00.000Z',
        reviewNotes: '',
      },
    ]);

    const { handleWithdrawSiteRun } = await import('../src/cloud/routeHandlers/handleWithdrawSiteRun');

    await expect(handleWithdrawSiteRun('run-1', 'selected-1', 'admin')).rejects.toThrow('published site variant not found');
    expect(publicationLogRepository.create).not.toHaveBeenCalled();
  });
});
