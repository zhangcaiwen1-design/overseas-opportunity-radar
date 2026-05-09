# 图文截图素材接入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增真实来源素材截图 `materials/*.png`，并让精选文章消费这些素材生成“顶部拼图总览 + 正文单图来源图”的可发布图文。

**Architecture:** 在 `runDailyPipeline` 中，先确定精选，再按精选条目尝试抓取来源页面截图到 `materials/` 目录；抓取失败不影响主流程。随后把“当前文章来源图 + 本批次可用来源图集合”传给精选文章 HTML/Markdown 渲染器，最后继续生成现有的 `selected/*.png` 成稿截图。机会池模板保持不变。

**Tech Stack:** TypeScript、Vitest、Playwright、现有 orchestrator/render/writer 结构。

---

## 文件职责映射

- `src/render/captureSourceMaterial.ts`
  - 新增：负责把来源 URL 截成素材图。
- `src/types.ts`
  - 新增图文渲染用的图片元数据类型。
- `src/orchestrator/runDailyPipeline.ts`
  - 新增 `materials/` 目录，抓取精选来源素材图，并把图片元数据传给渲染器。
- `src/render/renderMagazineArticle.ts`
  - 渲染顶部拼图与正文来源图区。
- `src/render/styles/magazine.css`
  - 增加拼图和来源图区样式。
- `src/writer/renderMarkdown.ts`
  - Markdown 输出拼图概览和当前案例来源图。
- `tests/orchestrator.test.ts`
  - mock 来源素材抓图 helper，验证集成流程与回归。
- `README.md`
  - 说明 `materials/*.png`、精选文章的新图文结构。

### Task 1: 新增来源素材截图 helper 与图片元数据类型

**Files:**
- Create: `src/render/captureSourceMaterial.ts`
- Modify: `src/types.ts:30-40`
- Modify: `tests/orchestrator.test.ts:1-60`

- [ ] **Step 1: Write the failing test**

```ts
const { captureSourceMaterialMock } = vi.hoisted(() => ({
  captureSourceMaterialMock: vi.fn(),
}));

vi.mock('../src/render/captureSourceMaterial', () => ({
  captureSourceMaterial: captureSourceMaterialMock,
}));
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/orchestrator.test.ts`
Expected: FAIL with a module resolution error because `../src/render/captureSourceMaterial` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
import { chromium } from 'playwright';

export async function captureSourceMaterial(url: string, outputPath: string, width: number, height: number): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 3000 });
    await page.screenshot({ path: outputPath, fullPage: false });
  } finally {
    await browser.close();
  }
}
```

```ts
export interface WrittenOpportunityImage {
  path: string;
  alt: string;
}

export interface WrittenOpportunity {
  slug: string;
  title: string;
  overseasSignal: string;
  whyNow: string;
  localizationPath: string;
  monetizationPaths: string[];
  validationPath: string;
  targetProfiles: string[];
  douyinSummary: string;
  materialImage?: WrittenOpportunityImage;
  collageImages?: WrittenOpportunityImage[];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/orchestrator.test.ts`
Expected: PASS past module loading for the new helper; later assertions may still fail until the pipeline starts using it.

- [ ] **Step 5: Commit**

```bash
git add src/render/captureSourceMaterial.ts src/types.ts tests/orchestrator.test.ts
git commit -m "refactor: add source material capture primitives"
```

### Task 2: 在 daily pipeline 中生成 materials/*.png

**Files:**
- Modify: `src/orchestrator/runDailyPipeline.ts:18-53`
- Modify: `src/orchestrator/runDailyPipeline.ts:229-329`
- Modify: `tests/orchestrator.test.ts:184-245`

- [ ] **Step 1: Write the failing test**

```ts
it('skips source material capture for fallback sample signals and keeps the pipeline green', async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), 'opportunity-radar-material-skip-'));
  const result = await runDailyPipeline(buildConfig(tempDir), new Date('2026-05-07T12:00:00.000Z'));

  expect(result.usedFallback).toBe(true);
  expect(captureSourceMaterialMock).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/orchestrator.test.ts -t "skips source material capture for fallback sample signals"`
Expected: FAIL because the pipeline does not yet know about the helper or the `sample` skip rule.

- [ ] **Step 3: Write minimal implementation**

```ts
function canCaptureSourceMaterial(signal: OpportunitySignal) {
  return signal.source !== 'sample' && /^https?:\/\//.test(signal.canonicalUrl);
}
```

```ts
const materialsDir = path.join(outputDir, 'materials');
await Promise.all([ensureDirectory(selectedDir), ensureDirectory(poolDir), ensureDirectory(videoDir), ensureDirectory(materialsDir)]);
```

```ts
export interface DailyArtifact {
  slug: string;
  title: string;
  markdownPath: string;
  htmlPath: string;
  screenshotPath: string;
  materialPath?: string;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/orchestrator.test.ts -t "skips source material capture for fallback sample signals"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/orchestrator/runDailyPipeline.ts tests/orchestrator.test.ts
git commit -m "feat: add materials directory to daily pipeline"
```

### Task 3: 把来源素材图传给精选渲染器并生成 HTML 拼图

**Files:**
- Modify: `src/orchestrator/runDailyPipeline.ts:247-267`
- Modify: `src/render/renderMagazineArticle.ts:1-57`
- Modify: `src/render/styles/magazine.css:1-62`
- Modify: `tests/orchestrator.test.ts:184-245`

- [ ] **Step 1: Write the failing test**

```ts
it('renders featured html with no collage when source material images are unavailable', async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), 'opportunity-radar-no-material-html-'));
  const result = await runDailyPipeline(buildConfig(tempDir), new Date('2026-05-07T12:00:00.000Z'));

  const html = await readFile(result.selectedArtifacts[0].htmlPath, 'utf8');
  expect(html).not.toContain('article-collage');
  expect(html).not.toContain('material-figure');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/orchestrator.test.ts -t "renders featured html with no collage when source material images are unavailable"`
Expected: FAIL after the renderer starts assuming image fields always exist.

- [ ] **Step 3: Write minimal implementation**

```ts
function renderCollage(images: WrittenOpportunityImage[] | undefined): string {
  if (!images || images.length === 0) {
    return '';
  }

  return `<section class="article-collage">${images
    .map((image) => `<img src="${escapeHtml(image.path)}" alt="${escapeHtml(image.alt)}" />`)
    .join('')}</section>`;
}

function renderMaterialFigure(image?: WrittenOpportunityImage): string {
  if (!image) {
    return '';
  }

  return `<figure class="material-figure"><img src="${escapeHtml(image.path)}" alt="${escapeHtml(image.alt)}" /><figcaption>Source material</figcaption></figure>`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/orchestrator.test.ts -t "renders featured html with no collage when source material images are unavailable"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/orchestrator/runDailyPipeline.ts src/render/renderMagazineArticle.ts src/render/styles/magazine.css tests/orchestrator.test.ts
git commit -m "feat: render optional source material sections in featured articles"
```

### Task 4: 让 Markdown 成稿同步消费来源素材图

**Files:**
- Modify: `src/writer/renderMarkdown.ts:1-28`
- Modify: `tests/orchestrator.test.ts:184-245`

- [ ] **Step 1: Write the failing test**

```ts
it('keeps featured markdown text-only when source material images are unavailable', async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), 'opportunity-radar-no-material-markdown-'));
  const result = await runDailyPipeline(buildConfig(tempDir), new Date('2026-05-07T12:00:00.000Z'));

  const markdown = await readFile(result.selectedArtifacts[0].markdownPath, 'utf8');
  expect(markdown).not.toContain('## Source material');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/orchestrator.test.ts -t "keeps featured markdown text-only when source material images are unavailable"`
Expected: FAIL once the Markdown renderer starts emitting image sections unconditionally.

- [ ] **Step 3: Write minimal implementation**

```ts
function renderImageLine(image: WrittenOpportunityImage): string {
  return `![${image.alt}](${image.path.replace(/\\/g, '/')})`;
}

export function renderArticleMarkdown(article: WrittenOpportunity): string {
  return [
    `# ${article.title}`,
    '',
    ...(article.collageImages && article.collageImages.length > 0
      ? ['## Collage overview', ...article.collageImages.map(renderImageLine), '']
      : []),
    '## Overseas signal',
    article.overseasSignal,
    '',
    ...(article.materialImage ? ['## Source material', renderImageLine(article.materialImage), ''] : []),
    '## Why now',
    article.whyNow,
  ].join('\n');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/orchestrator.test.ts -t "keeps featured markdown text-only when source material images are unavailable"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/writer/renderMarkdown.ts tests/orchestrator.test.ts
git commit -m "feat: render optional source material sections in markdown"
```

### Task 5: 补一个有真实来源图的集成用例

**Files:**
- Modify: `tests/orchestrator.test.ts:1-367`

- [ ] **Step 1: Write the failing test**

```ts
it('renders collage and source material blocks when a real-source signal is available', async () => {
  const realSignal = {
    id: 'github-real-signal',
    source: 'github' as const,
    title: 'Realtime dashboard template for repair shops',
    summary: 'A real-source signal used to verify material capture wiring.',
    url: 'https://example.com/project',
    canonicalUrl: 'https://example.com/project',
    publishedAt: '2026-05-07T08:00:00.000Z',
    tags: ['repair', 'dashboard'],
    rawScore: 50,
  };

  captureSourceMaterialMock.mockImplementation(async (_url, outputPath) => {
    await writeFile(outputPath, 'stub-image', 'utf8');
  });

  vi.doMock('../src/sources', () => ({
    createGithubSource: () => ({ fetchSignals: async () => [realSignal] }),
    createHackerNewsSource: () => ({ fetchSignals: async () => [] }),
    createRedditSource: () => ({ fetchSignals: async () => [] }),
    createRssSource: () => ({ fetchSignals: async () => [] }),
  }));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/orchestrator.test.ts -t "renders collage and source material blocks when a real-source signal is available"`
Expected: FAIL until the pipeline writes `materials/*.png` and passes those paths into the renderers.

- [ ] **Step 3: Write minimal implementation**

```ts
const collageImages = selectedArtifacts
  .filter((artifact) => artifact.materialPath)
  .map((artifact) => ({
    path: path.relative(selectedDir, artifact.materialPath!).replace(/\\/g, '/'),
    alt: `${artifact.title} 来源截图`,
  }));
```

```ts
const articleWithImages: WrittenOpportunity = {
  ...article,
  materialImage: materialPath
    ? { path: path.relative(selectedDir, materialPath).replace(/\\/g, '/'), alt: `${article.title} 来源截图` }
    : undefined,
  collageImages,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/orchestrator.test.ts -t "renders collage and source material blocks when a real-source signal is available"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/orchestrator/runDailyPipeline.ts tests/orchestrator.test.ts
git commit -m "test: cover source material integration for featured articles"
```

### Task 6: 保持机会池不变并更新 README

**Files:**
- Modify: `README.md:14-33`
- Modify: `tests/orchestrator.test.ts:356-366`

- [ ] **Step 1: Write the failing test**

```ts
it('documents materials output and keeps pool artifacts as brief pages', async () => {
  const readme = await readFile(path.join(process.cwd(), 'README.md'), 'utf8');

  expect(readme).toContain('materials/*.png');
  expect(readme).toContain('来源素材截图');
  expect(readme).toContain('selected/*.png');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/orchestrator.test.ts -t "documents materials output and keeps pool artifacts as brief pages"`
Expected: FAIL because README does not yet mention `materials/*.png`.

- [ ] **Step 3: Write minimal implementation**

```md
- `materials/*.png` — 精选案例对应的来源素材截图，供图文拼图与后续视频素材复用
- `selected/*.png` — 精选文章页面截图，用于成稿预览与素材回看
- `pool/*.png` — 机会池简报截图，用于素材回看
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/orchestrator.test.ts -t "documents materials output and keeps pool artifacts as brief pages"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add README.md tests/orchestrator.test.ts
git commit -m "docs: describe source material screenshots"
```

### Task 7: 运行完整回归

**Files:**
- Modify: `src/render/captureSourceMaterial.ts`
- Modify: `src/types.ts:30-40`
- Modify: `src/orchestrator/runDailyPipeline.ts:18-53`
- Modify: `src/orchestrator/runDailyPipeline.ts:229-329`
- Modify: `src/render/renderMagazineArticle.ts:1-57`
- Modify: `src/render/styles/magazine.css:1-62`
- Modify: `src/writer/renderMarkdown.ts:1-28`
- Modify: `tests/orchestrator.test.ts:1-367`
- Modify: `README.md:14-33`

- [ ] **Step 1: Run the orchestrator test file**

Run: `npm test -- tests/orchestrator.test.ts`
Expected: PASS.

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 3: Run TypeScript type-checking**

Run: `npm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Run a manual daily build**

Run: `npm run daily`
Expected: exit code 0; sample-only runs complete without source material capture, while real-source runs populate `output/YYYY-MM-DD/materials/`.

- [ ] **Step 5: Commit**

```bash
git add src/render/captureSourceMaterial.ts src/types.ts src/orchestrator/runDailyPipeline.ts src/render/renderMagazineArticle.ts src/render/styles/magazine.css src/writer/renderMarkdown.ts tests/orchestrator.test.ts README.md
git commit -m "feat: integrate source material screenshots into featured articles"
```
