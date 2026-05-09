import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateSelectedArtifacts } from '../src/cloud/services/generateSelectedArtifacts';
import * as generateSelectedArtifactsModule from '../src/cloud/services/generateSelectedArtifacts';
import { generateSelectedArtifactsForDailyRun } from '../src/orchestrator/runDailyPipeline';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('generateSelectedArtifacts', () => {
  it('creates html, markdown, screenshot, and push digest records for selected candidates', async () => {
    const upload = vi
      .fn()
      .mockResolvedValueOnce({
        storagePath: 'runs/2026-05-08/selected/demo.html',
        publicUrl: 'https://cdn.example.com/demo.html',
      })
      .mockResolvedValueOnce({
        storagePath: 'runs/2026-05-08/selected/demo.md',
        publicUrl: 'https://cdn.example.com/demo.md',
      })
      .mockResolvedValueOnce({
        storagePath: 'runs/2026-05-08/selected/demo.png',
        publicUrl: 'https://cdn.example.com/demo.png',
      });
    const saveArtifact = vi.fn().mockResolvedValue(undefined);
    const screenshotBuffer = Buffer.from('png-binary');
    const renderScreenshot = vi.fn().mockResolvedValue(screenshotBuffer);

    const result = await generateSelectedArtifacts({
      runId: 'run-1',
      dateKey: '2026-05-08',
      selectedCandidates: [
        {
          id: 'candidate-1',
          title: 'Demo',
          summary: 'summary',
          canonicalUrl: 'https://example.com',
          source: 'github',
          tags: ['ops'],
          rawScore: 42,
          publishedAt: '2026-05-08T00:00:00.000Z',
          url: 'https://example.com',
        },
      ],
      upload,
      saveArtifact,
      renderScreenshot,
    });

    expect(result.selectedCount).toBe(1);
    expect(renderScreenshot).toHaveBeenCalledWith(expect.any(String), 1080, 1440);
    expect(saveArtifact).toHaveBeenCalledWith(expect.objectContaining({ artifactType: 'selected_html' }));
    expect(saveArtifact).toHaveBeenCalledWith(expect.objectContaining({ artifactType: 'selected_markdown' }));
    expect(saveArtifact).toHaveBeenCalledWith(expect.objectContaining({ artifactType: 'selected_png' }));
    expect(upload).toHaveBeenCalledTimes(3);
    expect(upload).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        storagePath: 'runs/2026-05-08/selected/demo.png',
        contentType: 'image/png',
        body: screenshotBuffer,
      }),
    );
  });
});

describe('generateSelectedArtifactsForDailyRun', () => {
  it('preserves the manual selection order when generating selected items', async () => {
    vi.spyOn(generateSelectedArtifactsModule, 'generateSelectedArtifacts').mockResolvedValue({
      selectedCount: 2,
      articles: [
        {
          article: {
            slug: 'beta',
            title: 'Beta',
            sourceLabel: 'RSS 项目',
            projectType: 'tool-enhancement',
            oneLiner: 'One liner',
            projectIntro: 'Intro',
            operationModel: ['Step 1'],
            whyItMatters: ['Reason 1'],
            chinaAdaptation: ['Adapt 1'],
            monetizationExecution: ['Monetize 1'],
            contentAngles: [{ channel: 'wechat-article', angle: 'Angle 1' }],
          },
          artifact: {
            slug: 'beta',
            title: 'Beta',
            markdownPath: 'https://cdn.example.com/beta.md',
            htmlPath: 'https://cdn.example.com/beta.html',
            screenshotPath: 'https://cdn.example.com/beta.png',
          },
          selectedItemId: 'candidate-2',
          title: 'Beta',
        },
        {
          article: {
            slug: 'alpha',
            title: 'Alpha',
            sourceLabel: 'GitHub 项目',
            projectType: 'tool-enhancement',
            oneLiner: 'One liner',
            projectIntro: 'Intro',
            operationModel: ['Step 1'],
            whyItMatters: ['Reason 1'],
            chinaAdaptation: ['Adapt 1'],
            monetizationExecution: ['Monetize 1'],
            contentAngles: [{ channel: 'wechat-article', angle: 'Angle 1' }],
          },
          artifact: {
            slug: 'alpha',
            title: 'Alpha',
            markdownPath: 'https://cdn.example.com/alpha.md',
            htmlPath: 'https://cdn.example.com/alpha.html',
            screenshotPath: 'https://cdn.example.com/alpha.png',
          },
          selectedItemId: 'candidate-1',
          title: 'Alpha',
        },
      ],
    });

    const createSelectedItems = vi.fn().mockResolvedValue([
      { id: 'selected-2', candidateId: 'candidate-2', title: 'Beta', status: 'queued' },
      { id: 'selected-1', candidateId: 'candidate-1', title: 'Alpha', status: 'queued' },
    ]);

    await generateSelectedArtifactsForDailyRun({
      runId: 'run-1',
      dateKey: '2026-05-08',
      candidates: [
        {
          id: 'candidate-1',
          title: 'Alpha',
          source: 'github',
          summary: 'summary',
          rank: 1,
          selectionState: 'selected',
          tags: ['ops'],
          canonicalUrl: 'https://example.com/alpha',
        },
        {
          id: 'candidate-2',
          title: 'Beta',
          source: 'rss',
          summary: 'summary',
          rank: 2,
          selectionState: 'selected',
          tags: ['ai'],
          canonicalUrl: 'https://example.com/beta',
        },
      ],
      selectedCandidateIds: ['candidate-2', 'candidate-1'],
      createSelectedItems,
      upload: vi.fn(),
      saveArtifact: vi.fn(),
    });

    expect(createSelectedItems).toHaveBeenCalledWith(
      'run-1',
      [
        expect.objectContaining({ id: 'candidate-2', title: 'Beta' }),
        expect.objectContaining({ id: 'candidate-1', title: 'Alpha' }),
      ],
    );
  });

  it('selects candidates, remaps artifact ownership, and returns push digest plus push decision data', async () => {
    vi.spyOn(generateSelectedArtifactsModule, 'generateSelectedArtifacts').mockResolvedValue({
      selectedCount: 1,
      articles: [
        {
          article: {
            slug: 'alpha',
            title: 'Alpha',
            sourceLabel: 'GitHub 项目',
            projectType: 'tool-enhancement',
            oneLiner: 'One liner',
            projectIntro: 'Intro',
            operationModel: ['Step 1'],
            whyItMatters: ['Reason 1'],
            chinaAdaptation: ['Adapt 1'],
            monetizationExecution: ['Monetize 1'],
            contentAngles: [{ channel: 'wechat-article', angle: 'Angle 1' }],
          },
          artifact: {
            slug: 'alpha',
            title: 'Alpha',
            markdownPath: 'https://cdn.example.com/alpha.md',
            htmlPath: 'https://cdn.example.com/alpha.html',
            screenshotPath: 'https://cdn.example.com/alpha.png',
          },
          selectedItemId: 'candidate-1',
          title: 'Alpha',
        },
      ],
    });

    const createSelectedItems = vi.fn().mockResolvedValue([
      { id: 'selected-1', candidateId: 'candidate-1', title: 'Alpha', status: 'queued' },
    ]);
    const saveArtifact = vi.fn().mockResolvedValue(undefined);
    const upload = vi.fn();

    const result = await generateSelectedArtifactsForDailyRun({
      runId: 'run-1',
      dateKey: '2026-05-08',
      candidates: [
        {
          id: 'candidate-1',
          title: 'Alpha',
          source: 'github',
          summary: 'summary',
          rank: 1,
          selectionState: 'selected',
          tags: ['ops'],
          canonicalUrl: 'https://example.com/alpha',
        },
        {
          id: 'candidate-2',
          title: 'Beta',
          source: 'rss',
          summary: 'summary',
          rank: 2,
          selectionState: 'pending',
          tags: ['ai'],
          canonicalUrl: 'https://example.com/beta',
        },
      ],
      createSelectedItems,
      upload,
      saveArtifact,
    });

    expect(createSelectedItems).toHaveBeenCalledWith(
      'run-1',
      [expect.objectContaining({ id: 'candidate-1', url: 'https://example.com/alpha' })],
    );

    const saveGeneratedArtifact = vi.mocked(generateSelectedArtifactsModule.generateSelectedArtifacts)
      .mock.calls[0]?.[0].saveArtifact;
    expect(saveGeneratedArtifact).toBeTypeOf('function');
    await saveGeneratedArtifact?.({
      runId: 'run-1',
      selectedItemId: 'candidate-1',
      artifactType: 'selected_html',
      storagePath: 'runs/2026-05-08/selected/alpha.html',
      publicUrl: 'https://cdn.example.com/alpha.html',
      mimeType: 'text/html',
    });
    expect(saveArtifact).toHaveBeenCalledWith(
      expect.objectContaining({ selectedItemId: 'selected-1', artifactType: 'selected_html' }),
    );

    expect(result.selectedCount).toBe(1);
    expect(result.selectedItems).toEqual([{ id: 'selected-1', candidateId: 'candidate-1', title: 'Alpha', status: 'queued' }]);
    expect(result.pushDigestArtifact).toEqual({
      storagePath: 'runs/2026-05-08/push-digest.txt',
      contentType: 'text/plain; charset=utf-8',
      mimeType: 'text/plain',
    });
    expect(result.pushDigest).toContain('今日海外商业机会雷达｜2026-05-08');
    expect(result.pushDigest).toContain('精选 1 条｜机会池 2 条');
    expect(result.pushDigest).toContain('今日头条：Alpha');
    expect(result.pushDecisionArtifact).toEqual({
      storagePath: 'runs/2026-05-08/push-decision.json',
      contentType: 'application/json',
      mimeType: 'application/json',
    });
    expect(JSON.parse(result.pushDecision)).toMatchObject({
      runId: 'run-1',
      shouldPushToday: true,
      recommendedCandidateIds: ['candidate-1', 'candidate-2'],
      recommendedChannels: ['feishu', 'wecom', 'wxpusher'],
      candidateDecisions: [
        expect.objectContaining({ candidateId: 'candidate-1', action: 'push' }),
        expect.objectContaining({ candidateId: 'candidate-2', action: 'push' }),
      ],
    });
  });
});
