import { beforeEach, describe, expect, it, vi } from 'vitest';

const createSupabaseServerClient = vi.fn();
const createContentVariantRepository = vi.fn();
const createCandidateRepository = vi.fn();
const createSelectedItemRepository = vi.fn();
const createArtifactRepository = vi.fn();
const downloadArtifactText = vi.fn();

const listPublishedByChannel = vi.fn();
const listCandidatesByRun = vi.fn();
const listSelectedItemsByRun = vi.fn();
const listArtifactsByRun = vi.fn();

vi.mock('../src/cloud/supabase/serverClient', () => ({
  createSupabaseServerClient,
}));

vi.mock('../src/cloud/repositories/contentVariantRepository', () => ({
  createContentVariantRepository,
}));

vi.mock('../src/cloud/repositories/candidateRepository', () => ({
  createCandidateRepository,
}));

vi.mock('../src/cloud/repositories/selectedItemRepository', () => ({
  createSelectedItemRepository,
}));

vi.mock('../src/cloud/repositories/artifactRepository', () => ({
  createArtifactRepository,
}));

vi.mock('../src/cloud/storage/uploadArtifact', () => ({
  downloadArtifactText,
}));

describe('site loaders', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();

    createSupabaseServerClient.mockReturnValue({});
    createContentVariantRepository.mockReturnValue({ listPublishedByChannel });
    createCandidateRepository.mockReturnValue({ listByRun: listCandidatesByRun });
    createSelectedItemRepository.mockReturnValue({ listByRun: listSelectedItemsByRun });
    createArtifactRepository.mockReturnValue({ listByRun: listArtifactsByRun });
  });

  it('builds a public site index only from published site variants', { timeout: 15000 }, async () => {
    listPublishedByChannel.mockResolvedValue([
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
    listCandidatesByRun.mockResolvedValue([
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
    listSelectedItemsByRun.mockResolvedValue([
      {
        id: 'selected-1',
        candidateId: 'candidate-1',
        slug: 'alpha',
        title: 'Alpha',
        status: 'completed',
      },
    ]);
    listArtifactsByRun.mockResolvedValue([
      {
        selectedItemId: 'selected-1',
        artifactType: 'selected_png',
        publicUrl: 'https://cdn.example.com/alpha.png',
        storagePath: 'runs/2026-05-09/selected/alpha.png',
      },
      {
        selectedItemId: 'selected-1',
        artifactType: 'selected_markdown',
        publicUrl: 'https://cdn.example.com/alpha.md',
        storagePath: 'runs/2026-05-09/selected/alpha.md',
      },
      {
        selectedItemId: 'selected-1',
        artifactType: 'selected_html',
        publicUrl: 'https://cdn.example.com/alpha.html',
        storagePath: 'runs/2026-05-09/selected/alpha.html',
      },
    ]);

    const { loadSiteContentIndex } = await import('../src/site/loadSiteContentIndex');
    const result = await loadSiteContentIndex();

    expect(listPublishedByChannel).toHaveBeenCalledWith('site');
    expect(result).toEqual({
      generatedAt: '2026-05-09T03:30:00.000Z',
      dateKey: '',
      items: [
        {
          id: 'selected-1',
          slug: 'alpha',
          title: 'Alpha',
          summary: 'Alpha summary',
          coverImageUrl: 'https://cdn.example.com/alpha.png',
          articleUrl: '/site/alpha',
          markdownUrl: 'https://cdn.example.com/alpha.md',
          canonicalSourceUrl: 'https://example.com/alpha',
          publishedAt: '2026-05-09T03:30:00.000Z',
          bodyHtmlStoragePath: 'runs/2026-05-09/selected/alpha.html',
        },
      ],
    });
  });

  it('returns an empty site index when no published site variant exists', async () => {
    listPublishedByChannel.mockResolvedValue([]);

    const { loadSiteContentIndex } = await import('../src/site/loadSiteContentIndex');
    const result = await loadSiteContentIndex();

    expect(result).toEqual({
      generatedAt: '',
      dateKey: '',
      items: [],
    });
    expect(listCandidatesByRun).not.toHaveBeenCalled();
    expect(listSelectedItemsByRun).not.toHaveBeenCalled();
    expect(listArtifactsByRun).not.toHaveBeenCalled();
  });

  it('returns an empty site index when content_variants is missing from the cloud schema', async () => {
    listPublishedByChannel.mockRejectedValue({
      code: 'PGRST205',
      message: "Could not find the table 'public.content_variants' in the schema cache",
    });

    const { loadSiteContentIndex } = await import('../src/site/loadSiteContentIndex');
    const result = await loadSiteContentIndex();

    expect(result).toEqual({
      generatedAt: '',
      dateKey: '',
      items: [],
    });
    expect(listCandidatesByRun).not.toHaveBeenCalled();
    expect(listSelectedItemsByRun).not.toHaveBeenCalled();
    expect(listArtifactsByRun).not.toHaveBeenCalled();
  });

  it('excludes withdrawn site variants from the public site index', async () => {
    listPublishedByChannel.mockResolvedValue([
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

    const { loadSiteContentIndex } = await import('../src/site/loadSiteContentIndex');
    const result = await loadSiteContentIndex();

    expect(result.items).toEqual([]);
    expect(listCandidatesByRun).not.toHaveBeenCalled();
  });

  it('loads article html by slug from the published site variant artifact path', async () => {
    listPublishedByChannel.mockResolvedValue([
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
    listCandidatesByRun.mockResolvedValue([
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
    listSelectedItemsByRun.mockResolvedValue([
      {
        id: 'selected-1',
        candidateId: 'candidate-1',
        slug: 'alpha',
        title: 'Alpha',
        status: 'completed',
      },
    ]);
    listArtifactsByRun.mockResolvedValue([
      {
        selectedItemId: 'selected-1',
        artifactType: 'selected_png',
        publicUrl: 'https://cdn.example.com/alpha.png',
        storagePath: 'runs/2026-05-09/selected/alpha.png',
      },
      {
        selectedItemId: 'selected-1',
        artifactType: 'selected_markdown',
        publicUrl: 'https://cdn.example.com/alpha.md',
        storagePath: 'runs/2026-05-09/selected/alpha.md',
      },
      {
        selectedItemId: 'selected-1',
        artifactType: 'selected_html',
        publicUrl: 'https://cdn.example.com/alpha.html',
        storagePath: 'runs/2026-05-09/selected/alpha.html',
      },
    ]);
    downloadArtifactText.mockResolvedValue('<article><p>Alpha body</p></article>');

    const { loadSiteArticleBySlug } = await import('../src/site/loadSiteArticleBySlug');
    const result = await loadSiteArticleBySlug('alpha');

    expect(downloadArtifactText).toHaveBeenCalledWith('runs/2026-05-09/selected/alpha.html');
    expect(result).toEqual({
      slug: 'alpha',
      title: 'Alpha',
      bodyHtml: '<article><p>Alpha body</p></article>',
      coverImageUrl: 'https://cdn.example.com/alpha.png',
      markdownUrl: 'https://cdn.example.com/alpha.md',
      canonicalSourceUrl: 'https://example.com/alpha',
      publishedAt: '2026-05-09T03:30:00.000Z',
    });
  });

  it('sanitizes article html loaded from storage before returning it', async () => {
    listPublishedByChannel.mockResolvedValue([
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
    listCandidatesByRun.mockResolvedValue([
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
    listSelectedItemsByRun.mockResolvedValue([
      {
        id: 'selected-1',
        candidateId: 'candidate-1',
        slug: 'alpha',
        title: 'Alpha',
        status: 'completed',
      },
    ]);
    listArtifactsByRun.mockResolvedValue([
      {
        selectedItemId: 'selected-1',
        artifactType: 'selected_png',
        publicUrl: 'https://cdn.example.com/alpha.png',
        storagePath: 'runs/2026-05-09/selected/alpha.png',
      },
      {
        selectedItemId: 'selected-1',
        artifactType: 'selected_markdown',
        publicUrl: 'https://cdn.example.com/alpha.md',
        storagePath: 'runs/2026-05-09/selected/alpha.md',
      },
      {
        selectedItemId: 'selected-1',
        artifactType: 'selected_html',
        publicUrl: 'https://cdn.example.com/alpha.html',
        storagePath: 'runs/2026-05-09/selected/alpha.html',
      },
    ]);
    downloadArtifactText.mockResolvedValue(
      '<article><script>alert(1)</script><p onclick="alert(2)">Alpha body</p><img src="x" onerror="alert(3)"><a href="javascript:alert(4)">Read</a></article>',
    );

    const { loadSiteArticleBySlug } = await import('../src/site/loadSiteArticleBySlug');
    const result = await loadSiteArticleBySlug('alpha');

    expect(result?.bodyHtml).toBe('<article><p>Alpha body</p><img src="x"><a>Read</a></article>');
  });

  it('returns null when the slug has no published site variant', async () => {
    listPublishedByChannel.mockResolvedValue([]);

    const { loadSiteArticleBySlug } = await import('../src/site/loadSiteArticleBySlug');

    await expect(loadSiteArticleBySlug('alpha')).resolves.toBeNull();
    expect(downloadArtifactText).not.toHaveBeenCalled();
  });
});
