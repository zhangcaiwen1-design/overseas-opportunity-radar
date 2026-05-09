# 精选稿成品化视觉升级 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为每篇精选稿接入 GPT Image-2 主视觉图，升级首屏与证据区版式，让精选 HTML 更接近可直接发布的高级杂志风成品稿，同时保留失败降级能力。

**Architecture:** 在现有结构化案例分析层之上新增“视觉资产层”，把主视觉图生成、来源截图和文章内容一起交给精选稿 HTML 渲染器。主视觉图在页面渲染前生成并落盘；若生成失败，则自动降级为无主视觉版本，但 daily pipeline 仍然成功产出 HTML、Markdown 和预览图。

**Tech Stack:** TypeScript、Node.js、OpenAI `gpt-image-2`、Vitest、现有 local-first daily pipeline、HTML/CSS 渲染器、Playwright 截图

---

## 文件结构与职责

### 新增文件
- `src/assets/buildFeaturedImageBrief.ts` — 根据精选稿分析结果生成 GPT Image-2 主视觉 brief
- `src/assets/saveGeneratedImage.ts` — 将 OpenAI 图片响应保存到本地文件

### 修改文件
- `src/types.ts` — 为精选稿补充主视觉资产类型
- `src/assets/imageGenerator.ts` — 从基于 title 的简版接口升级为支持自定义 brief 的主视觉生成接口
- `src/orchestrator/runDailyPipeline.ts` — 接入主视觉图生成、保存、降级、路径传递
- `src/render/renderMagazineArticle.ts` — 升级为封面区 + 证据导览区 + 正文主体区 + 收尾区
- `src/render/styles/magazine.css` — 升级为更强首屏、封面图、证据区和正文层次样式
- `src/writer/renderMarkdown.ts` — 让 Markdown 与 HTML 保持内容顺序一致，可选输出主视觉说明
- `README.md` — 补充主视觉资产输出与降级行为说明
- `tests/assets.test.ts` — 覆盖主视觉 brief 生成规则
- `tests/render.test.ts` — 覆盖新首屏、证据区、主视觉缺失时的渲染行为
- `tests/orchestrator.test.ts` — 覆盖主视觉生成成功、失败降级、CLI 产物完整性

### 保持不变
- `src/render/captureSourceMaterial.ts`
- `src/render/renderBriefCard.ts`
- `pool/*.html` 相关链路
- 视频渲染链路

---

### Task 1: 建立精选稿主视觉资产层

**Files:**
- Create: `src/assets/buildFeaturedImageBrief.ts`
- Create: `src/assets/saveGeneratedImage.ts`
- Modify: `src/types.ts:1-120`
- Modify: `src/assets/imageGenerator.ts:1-40`
- Test: `tests/assets.test.ts`

- [ ] **Step 1: 先写失败测试，描述主视觉 brief 的最小契约**

在 `tests/assets.test.ts` 增加一个新测试，直接验证不同项目类型的 brief 差异。示例：

```ts
import { buildFeaturedImageBrief } from '../src/assets/buildFeaturedImageBrief';
import type { SelectedWrittenOpportunity } from '../src/types';

const baseArticle: SelectedWrittenOpportunity = {
  slug: 'agent-operating-framework',
  title: '协作流程机会：m9751/agent-operating-framework',
  sourceLabel: 'GitHub 项目',
  projectType: 'workflow-collaboration',
  oneLiner: '这是一个偏工作流协作型的项目。',
  projectIntro: '它更像流程框架，不是单功能工具。',
  operationModel: ['先给目标。', '再分工执行。'],
  whyItMatters: ['社区里已经出现真实需求。'],
  chinaAdaptation: ['优先接企微和飞书。'],
  monetizationExecution: ['先卖流程代搭建。'],
  contentAngles: [{ channel: 'wechat-article', angle: '从协作模式切入。' }],
};

it('builds a premium magazine-style prompt for selected hero images', () => {
  const brief = buildFeaturedImageBrief(baseArticle);

  expect(brief).toContain('premium commercial magazine cover');
  expect(brief).toContain('workflow collaboration scene');
  expect(brief).toContain('warm, trustworthy, realistic business atmosphere');
  expect(brief).not.toContain('black-gold');
});
```

- [ ] **Step 2: 运行测试确认当前失败**

Run: `npm test -- tests/assets.test.ts`
Expected: FAIL，提示 `Cannot find module '../src/assets/buildFeaturedImageBrief'`

- [ ] **Step 3: 在 `src/types.ts` 添加主视觉资产类型**

在 `SelectedWrittenOpportunity` 旁边新增资产类型：

```ts
export interface SelectedHeroImageAsset {
  prompt: string;
  imagePath?: string;
  status: 'generated' | 'skipped' | 'failed';
}

export interface SelectedWrittenOpportunity {
  slug: string;
  title: string;
  sourceLabel: string;
  projectType: OpportunityProjectType;
  oneLiner: string;
  projectIntro: string;
  operationModel: string[];
  whyItMatters: string[];
  chinaAdaptation: string[];
  monetizationExecution: string[];
  contentAngles: OpportunityContentAngle[];
  validationSteps?: OpportunityValidationStep[];
  heroImage?: SelectedHeroImageAsset;
  materialImage?: WrittenOpportunityImage;
  collageImages?: WrittenOpportunityImage[];
}
```

- [ ] **Step 4: 新建 `src/assets/buildFeaturedImageBrief.ts`**

实现一个只依赖精选稿分析结果的主视觉 brief 生成器。骨架：

```ts
import type { SelectedWrittenOpportunity } from '../types';

function projectSceneCue(projectType: SelectedWrittenOpportunity['projectType']) {
  switch (projectType) {
    case 'tool-enhancement':
      return 'single-operator workspace, focused screen, efficient task flow';
    case 'workflow-collaboration':
      return 'workflow collaboration scene, multiple roles, task handoff, desk materials';
    case 'business-frontend':
      return 'customer-facing business scene, store counter, service handoff, local commerce';
    case 'capability-foundation':
      return 'operations control desk, system orchestration, business infrastructure scene';
  }
}

export function buildFeaturedImageBrief(article: SelectedWrittenOpportunity): string {
  return [
    'premium commercial magazine cover',
    'warm, trustworthy, realistic business atmosphere',
    projectSceneCue(article.projectType),
    `story theme: ${article.oneLiner}`,
    `business opportunity: ${article.title}`,
    'avoid black-gold, cyberpunk, glossy sci-fi, cheap ai aesthetic',
  ].join(', ');
}
```

- [ ] **Step 5: 新建 `src/assets/saveGeneratedImage.ts`**

实现把 OpenAI 图片响应写入本地的最小 helper。骨架：

```ts
import { writeFile } from 'node:fs/promises';

export async function saveGeneratedImage(b64: string, outputPath: string) {
  await writeFile(outputPath, Buffer.from(b64, 'base64'));
}
```

- [ ] **Step 6: 升级 `src/assets/imageGenerator.ts` 支持自定义 brief**

把当前：

```ts
async generate(mode: ImageBriefMode, title: string) {
  return this.client.images.generate({
    model: 'gpt-image-2',
    prompt: buildImageBrief(mode, title),
  });
}
```

改成：

```ts
async generateFeatured(prompt: string) {
  return this.client.images.generate({
    model: 'gpt-image-2',
    prompt,
    size: '1536x1024',
  });
}
```

保留现有 `buildImageBrief()` 仅当项目中其他地方还会用到；如果无人引用，则在本任务中一并删除旧接口。

- [ ] **Step 7: 运行测试确认通过**

Run: `npm test -- tests/assets.test.ts`
Expected: PASS，且新 brief 测试通过

- [ ] **Step 8: Commit**

```bash
git add src/types.ts src/assets/imageGenerator.ts src/assets/buildFeaturedImageBrief.ts src/assets/saveGeneratedImage.ts tests/assets.test.ts
git commit -m "feat: add selected article hero image assets"
```

---

### Task 2: 在 daily pipeline 中接入主视觉图生成与降级

**Files:**
- Modify: `src/orchestrator/runDailyPipeline.ts:1-520`
- Test: `tests/orchestrator.test.ts`

- [ ] **Step 1: 先写失败测试，描述主视觉成功与失败降级**

在 `tests/orchestrator.test.ts` 增加 `ImageGenerator` 和图片保存流程的 mock，并新增两个测试：

```ts
it('writes a hero image for selected articles when image generation succeeds', async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), 'opportunity-radar-hero-success-'));
  const result = await runDailyPipeline(buildConfig(tempDir), new Date('2026-05-07T12:00:00.000Z'));
  const html = await readFile(result.selectedArtifacts[0].htmlPath, 'utf8');

  expect(html).toContain('article-hero-image');
  expect(html).toContain('../visuals/');
});

it('keeps selected article generation working when hero image generation fails', async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), 'opportunity-radar-hero-failed-'));
  heroImageGenerateMock.mockRejectedValue(new Error('image failed'));

  const result = await runDailyPipeline(buildConfig(tempDir), new Date('2026-05-07T12:00:00.000Z'));
  const html = await readFile(result.selectedArtifacts[0].htmlPath, 'utf8');

  expect(result.selectedArtifacts).toHaveLength(3);
  expect(html).not.toContain('article-hero-image');
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- tests/orchestrator.test.ts`
Expected: FAIL，提示没有主视觉逻辑或缺少 mock

- [ ] **Step 3: 在 `runDailyPipeline.ts` 新增 `visuals` 目录**

在现有目录旁新增：

```ts
const visualsDir = path.join(outputDir, 'visuals');

await Promise.all([
  ensureDirectory(selectedDir),
  ensureDirectory(poolDir),
  ensureDirectory(videoDir),
  ensureDirectory(materialsDir),
  ensureDirectory(visualsDir),
]);
```

- [ ] **Step 4: 在精选稿循环前生成主视觉资产**

在 `selectedArticles` 建立后，为每篇文章生成主视觉 prompt，并尝试出图。结构建议：

```ts
const imageGenerator = config.openaiApiKey ? new ImageGenerator(config) : undefined;

for (const entry of selectedArticles) {
  const prompt = buildFeaturedImageBrief(entry.article);
  entry.article.heroImage = { prompt, status: 'skipped' };

  if (!imageGenerator) {
    continue;
  }

  try {
    const response = await imageGenerator.generateFeatured(prompt);
    const b64 = response.data?.[0]?.b64_json;
    if (!b64) {
      entry.article.heroImage = { prompt, status: 'failed' };
      continue;
    }

    const imagePath = path.join(visualsDir, `${entry.article.slug}-hero.png`);
    await saveGeneratedImage(b64, imagePath);
    entry.article.heroImage = { prompt, imagePath, status: 'generated' };
  } catch {
    entry.article.heroImage = { prompt, status: 'failed' };
  }
}
```

- [ ] **Step 5: 在渲染前把主视觉路径改成相对路径**

在 `selectedDir` 渲染 HTML 前，生成相对路径：

```ts
const relativeHeroPath =
  article.heroImage?.imagePath ? path.relative(selectedDir, article.heroImage.imagePath).replace(/\\/g, '/') : undefined;
```

然后把 `articleForHtml.heroImage` 覆盖成：

```ts
heroImage:
  article.heroImage && article.heroImage.status === 'generated' && relativeHeroPath
    ? { ...article.heroImage, imagePath: relativeHeroPath }
    : article.heroImage,
```

- [ ] **Step 6: 运行测试确认 pipeline 新逻辑通过**

Run: `npm test -- tests/orchestrator.test.ts`
Expected: PASS，主视觉成功与失败降级测试通过

- [ ] **Step 7: Commit**

```bash
git add src/orchestrator/runDailyPipeline.ts tests/orchestrator.test.ts
git commit -m "feat: generate selected article hero visuals"
```

---

### Task 3: 升级 HTML 首屏、证据区与专题排版

**Files:**
- Modify: `src/render/renderMagazineArticle.ts:1-220`
- Modify: `src/render/styles/magazine.css:1-320`
- Test: `tests/render.test.ts`

- [ ] **Step 1: 先写失败测试，锁定新首屏和证据区结构**

在 `tests/render.test.ts` 中新增断言：

```ts
it('renders a hero cover section and evidence guide for selected articles', () => {
  const html = renderMagazineArticleHtml({
    ...selectedArticle,
    heroImage: {
      prompt: 'premium commercial magazine cover',
      imagePath: '../visuals/demo-hero.png',
      status: 'generated',
    },
    collageImages: [{ path: '../materials/demo.png', alt: 'demo material' }],
  });

  expect(html).toContain('article-cover');
  expect(html).toContain('article-hero-image');
  expect(html).toContain('证据导览');
  expect(html).toContain('../visuals/demo-hero.png');
});

it('omits the hero image block when no generated hero visual is available', () => {
  const html = renderMagazineArticleHtml({
    ...selectedArticle,
    heroImage: { prompt: 'x', status: 'failed' },
  });

  expect(html).not.toContain('article-hero-image');
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- tests/render.test.ts`
Expected: FAIL，当前 HTML 还没有这些区块

- [ ] **Step 3: 在 `renderMagazineArticle.ts` 增加封面区与证据区 helper**

新增 helper：

```ts
function renderHeroImage(heroImage: SelectedHeroImageAsset | undefined): string {
  if (!heroImage?.imagePath || heroImage.status !== 'generated') {
    return '';
  }

  return `<div class="article-hero-image"><img src="${escapeHtml(heroImage.imagePath)}" alt="${escapeHtml('精选稿主视觉图')}" /></div>`;
}

function renderEvidenceGuide(images: WrittenOpportunityImage[] | undefined): string {
  if (!images || images.length === 0) {
    return '';
  }

  return `<section class="evidence-guide"><div class="evidence-guide__intro"><p class="evidence-guide__label">证据导览</p><p>本篇拆解基于真实海外项目页面与公开信号。</p></div>${renderArticleCollage(images)}</section>`;
}
```

- [ ] **Step 4: 重组页面结构**

把当前结构改成：

```ts
<header class="hero article-cover">
  <p class="kicker">${escapeHtml(article.sourceLabel)}</p>
  <h1>${escapeHtml(article.title)}</h1>
  <p class="hero__dek">${escapeHtml(article.oneLiner)}</p>
  ${renderHeroImage(article.heroImage)}
</header>

${renderEvidenceGuide(article.collageImages)}
```

并保留正文主体与可选验证步骤。

- [ ] **Step 5: 升级 `magazine.css` 到专题稿布局**

至少增加这些样式：

```css
.article-cover {
  display: grid;
  gap: 24px;
}

.article-hero-image img {
  display: block;
  width: 100%;
  aspect-ratio: 3 / 2;
  object-fit: cover;
  border: 1px solid #d8cdbd;
  box-shadow: 0 22px 48px rgba(52, 38, 20, 0.14);
}

.evidence-guide {
  margin-top: 36px;
  padding-top: 24px;
  border-top: 1px solid rgba(160, 109, 59, 0.24);
}

.evidence-guide__label {
  margin: 0 0 8px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: #a06d3b;
  font-size: 12px;
}
```

同时进一步放大标题区层次、增强留白，不引入炫技动效。

- [ ] **Step 6: 运行测试确认通过**

Run: `npm test -- tests/render.test.ts`
Expected: PASS，新首屏与证据区测试通过

- [ ] **Step 7: Commit**

```bash
git add src/render/renderMagazineArticle.ts src/render/styles/magazine.css tests/render.test.ts
git commit -m "feat: upgrade selected article cover layout"
```

---

### Task 4: 对齐 Markdown、README 和成品降级说明

**Files:**
- Modify: `src/writer/renderMarkdown.ts:1-120`
- Modify: `README.md`
- Modify: `tests/orchestrator.test.ts`

- [ ] **Step 1: 先写失败测试，锁定 README 与成品产物说明**

在 `tests/orchestrator.test.ts` 的 README smoke checklist 中补充断言：

```ts
expect(readme).toContain('visuals/*.png');
expect(readme).toContain('GPT Image-2');
expect(readme).toContain('主视觉');
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- tests/orchestrator.test.ts`
Expected: FAIL，README 还未描述主视觉层

- [ ] **Step 3: 调整 `renderMarkdown.ts` 让 Markdown 顺序与 HTML 保持一致**

在标题与正文之间增加主视觉说明占位文字（仅当有主视觉图时），并把“素材总览”放到主视觉说明之后。建议骨架：

```ts
...(article.heroImage?.imagePath && article.heroImage.status === 'generated'
  ? ['## 主视觉', '', `![${article.title} 主视觉](${article.heroImage.imagePath})`, '']
  : []),
```

这样 Markdown 也具备主视觉锚点，便于非 HTML 渠道复用。

- [ ] **Step 4: 更新 README**

在 `README.md` 的输出物说明中新增：

```md
- `visuals/*.png` — 精选稿 GPT Image-2 主视觉图，用于首屏成品化展示与后续封面复用
```

并在行为说明中补充：

```md
- When OpenAI image generation succeeds, selected articles embed a GPT Image-2 hero visual.
- When hero image generation fails, the article still renders with source evidence and text content.
```

- [ ] **Step 5: 跑完整回归**

Run: `npm test`
Expected: PASS（当前全量测试通过）

Run: `npm exec tsc --noEmit`
Expected: PASS（无类型错误）

Run: `npm run daily`
Expected: PASS，且 `output/YYYY-MM-DD/selected/*.html` 在 OpenAI 配置可用时包含主视觉块；若不可用，则正常降级但流程成功

- [ ] **Step 6: Commit**

```bash
git add src/writer/renderMarkdown.ts README.md tests/orchestrator.test.ts
git commit -m "docs: describe selected article hero visuals"
```

---

## 计划自检清单

### Spec coverage
- 主视觉层：Task 1、Task 2
- 证据素材层：Task 2、Task 3
- 页面结构升级：Task 3
- 数据流与顺序原则：Task 2
- 降级策略：Task 2、Task 4
- 第一版最小可用范围：Task 1、Task 2、Task 3、Task 4

### Placeholder scan
- 计划中未保留 TBD / TODO / “后续实现” 之类占位词
- 每个任务都给出了明确文件、命令、预期结果和代码骨架

### Type consistency
- 主视觉资产统一使用 `SelectedHeroImageAsset`
- 精选稿主视觉 prompt 统一由 `buildFeaturedImageBrief()` 生成
- 主视觉生成接口统一使用 `ImageGenerator.generateFeatured()`
