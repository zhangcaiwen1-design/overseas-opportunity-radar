# 精选成稿结构重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把精选成稿从统一模板摘要升级为按项目类型输出的案例拆解稿，补齐项目介绍、运作模式、国产化路径与变现实操等定制内容。

**Architecture:** 保留现有 `OpportunitySignal` 作为原始输入，在 `runDailyPipeline` 里新增“项目分析层”产出结构化分析结果，再由 Markdown/HTML 渲染层按新章节结构输出。项目分型和字段生成集中在分析层，渲染器只负责排版，避免再次扩散模板文案。

**Tech Stack:** TypeScript、Node.js、Vitest、现有本地优先 daily pipeline、Markdown/HTML 渲染器

---

## 文件结构与职责

### 新增文件
- `src/writer/analyzeOpportunity.ts` — 根据 `OpportunitySignal` 产出项目分型与精选稿分析结果

### 修改文件
- `src/types.ts` — 扩展精选稿分析结果类型、项目分型类型、可选验证步骤字段
- `src/orchestrator/runDailyPipeline.ts` — 由 `toWrittenOpportunity()` 切换为“先分析再渲染”的精选成稿链路
- `src/writer/renderMarkdown.ts` — 按新章节结构渲染 Markdown，可选输出验证步骤
- `src/render/renderMagazineArticle.ts` — 按新章节结构渲染 HTML
- `src/render/styles/magazine.css` — 适配副标题、章节分组和更长的“运作模式 / 变现实操”正文
- `tests/orchestrator.test.ts` — 增加项目分型与差异化内容回归测试，覆盖可选验证板块逻辑
- `README.md` — 更新精选成稿说明，明确内容从模板摘要升级为项目拆解稿

### 不修改文件
- `src/render/captureSourceMaterial.ts`
- `pool/*.html` 对应逻辑
- 视频渲染与 push 逻辑

---

### Task 1: 建立项目分析结果模型

**Files:**
- Create: `src/writer/analyzeOpportunity.ts`
- Modify: `src/types.ts:1-80`
- Test: `tests/orchestrator.test.ts`

- [ ] **Step 1: 在测试中先描述新模型最小契约**

在 `tests/orchestrator.test.ts` 新增一个只验证分析结果结构的单测，直接导入将要新增的分析函数。测试示例：

```ts
import { analyzeOpportunity } from '../src/writer/analyzeOpportunity';

it('builds a structured article analysis for a tool-style project', () => {
  const analysis = analyzeOpportunity({
    id: 'tool-1',
    source: 'github',
    title: 'AndreyMalyar/SubPlayer',
    summary: 'Local YouTube video player with AI subtitles and TTS',
    url: 'https://github.com/AndreyMalyar/SubPlayer',
    canonicalUrl: 'https://github.com/AndreyMalyar/SubPlayer',
    publishedAt: '2026-05-07T08:00:00.000Z',
    tags: ['video', 'subtitle', 'tts'],
    rawScore: 50,
  });

  expect(analysis.projectType).toBe('tool-enhancement');
  expect(analysis.oneLiner).toContain('字幕');
  expect(analysis.projectIntro.length).toBeGreaterThan(20);
  expect(analysis.operationModel.join(' ').length).toBeGreaterThan(20);
  expect(analysis.chinaAdaptation.join(' ').length).toBeGreaterThan(20);
  expect(analysis.monetizationExecution.join(' ').length).toBeGreaterThan(20);
});
```

- [ ] **Step 2: 运行单测确认当前失败**

Run: `npm test -- tests/orchestrator.test.ts`
Expected: FAIL，提示 `Cannot find module '../src/writer/analyzeOpportunity'` 或 `analyzeOpportunity is not exported`

- [ ] **Step 3: 在 `src/types.ts` 添加分析模型类型**

把现有 `WrittenOpportunity` 从“模板字段集合”升级为“精选成稿渲染结果”，并新增项目分型与分析结果类型：

```ts
export type OpportunityProjectType =
  | 'tool-enhancement'
  | 'workflow-collaboration'
  | 'business-frontend'
  | 'capability-foundation';

export interface OpportunityValidationStep {
  title: string;
  detail: string;
}

export interface OpportunityContentAngle {
  channel: 'wechat-article' | 'douyin';
  angle: string;
}

export interface WrittenOpportunity {
  slug: string;
  title: string;
  sourceLabel: string;
  oneLiner: string;
  projectIntro: string;
  operationModel: string[];
  whyItMatters: string[];
  chinaAdaptation: string[];
  monetizationExecution: string[];
  contentAngles: OpportunityContentAngle[];
  validationSteps?: OpportunityValidationStep[];
  materialImage?: WrittenOpportunityImage;
  collageImages?: WrittenOpportunityImage[];
}
```

- [ ] **Step 4: 新建 `src/writer/analyzeOpportunity.ts` 并实现最小分析器**

先用最小可通过实现，把项目分型、来源平台展示和内容字段补齐。初版骨架：

```ts
import type { OpportunityContentAngle, OpportunityProjectType, OpportunitySignal, WrittenOpportunity } from '../types';

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'opportunity';
}

function detectProjectType(signal: OpportunitySignal): OpportunityProjectType {
  const joined = `${signal.title} ${signal.summary} ${signal.tags.join(' ')}`.toLowerCase();

  if (/(workflow|framework|agent|pipeline|automation)/.test(joined)) {
    return 'workflow-collaboration';
  }

  if (/(crm|order|booking|lead|shop|store|quote|assistant)/.test(joined)) {
    return 'business-frontend';
  }

  if (/(sdk|router|platform|infra|foundation|cask|toolkit)/.test(joined)) {
    return 'capability-foundation';
  }

  return 'tool-enhancement';
}

export function analyzeOpportunity(signal: OpportunitySignal): WrittenOpportunity {
  const projectType = detectProjectType(signal);
  const slug = slugify(signal.title);

  return {
    slug,
    title: signal.title.trim(),
    sourceLabel: signal.source.toUpperCase(),
    oneLiner: signal.summary,
    projectIntro: `“${signal.title}”当前更像一个可被二次包装的机会原型，而不是已经完成本地商业化的成熟项目。${signal.summary}`,
    operationModel: buildOperationModel(projectType, signal),
    whyItMatters: buildWhyItMatters(projectType, signal),
    chinaAdaptation: buildChinaAdaptation(projectType, signal),
    monetizationExecution: buildMonetizationExecution(projectType, signal),
    contentAngles: buildContentAngles(projectType, signal),
    validationSteps: buildValidationSteps(projectType, signal),
  };
}
```

其中 `buildWhyItMatters()`、`buildChinaAdaptation()`、`buildMonetizationExecution()`、`buildContentAngles()`、`buildValidationSteps()` 在同文件内一并实现，不允许保留占位字符串或空数组兜底。

- [ ] **Step 5: 让分析器按分型输出真实字段**

在 `analyzeOpportunity.ts` 中补足分型文案生成函数，例如：

```ts
function buildOperationModel(projectType: OpportunityProjectType, signal: OpportunitySignal): string[] {
  switch (projectType) {
    case 'tool-enhancement':
      return [
        `用户先提交与“${signal.title}”相关的原始内容或操作对象。`,
        '工具负责把其中最耗时的一步自动化处理掉。',
        '处理结果会回到用户当前的内容生产或交付流程里继续使用。',
      ];
    case 'workflow-collaboration':
      return [
        '发起方先定义任务目标与输入资料。',
        '不同角色或不同智能体按流程拆分执行。',
        '最后由人工复核与交付，形成可复用的协作闭环。',
      ];
    case 'business-frontend':
      return [
        '先通过前台入口承接客户需求或线索。',
        '系统把需求转成可处理、可跟进的业务动作。',
        '最后通过交付与复购把一次使用变成持续交易。',
      ];
    case 'capability-foundation':
      return [
        '底层能力先处理标准化技术任务。',
        '上层产品或团队在此基础上二次封装面向场景的功能。',
        '真正的商业价值来自把底座包装成可卖的解决方案。',
      ];
  }
}
```

同时补齐：
- `buildProjectIntro()`
- `buildWhyItMatters()`
- `buildChinaAdaptation()`
- `buildMonetizationExecution()`
- `buildContentAngles()`
- `buildValidationSteps()`（仅在确实能写具体内容时返回数组，否则返回 `undefined`）

- [ ] **Step 6: 运行单测确认通过**

Run: `npm test -- tests/orchestrator.test.ts`
Expected: PASS，且新增测试通过

- [ ] **Step 7: Commit**

```bash
git add src/types.ts src/writer/analyzeOpportunity.ts tests/orchestrator.test.ts
git commit -m "feat: add structured opportunity analysis model"
```

---

### Task 2: 切换 daily pipeline 到“先分析再渲染”

**Files:**
- Modify: `src/orchestrator/runDailyPipeline.ts:1-420`
- Modify: `tests/orchestrator.test.ts`

- [ ] **Step 1: 先写失败测试，验证精选成稿不再依赖旧模板字段**

在 `tests/orchestrator.test.ts` 中补一个集成测试，断言 Markdown 中出现新章节标题，并且旧的模板标题被移除。示例：

```ts
it('writes selected markdown with project intro and operation model sections', async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), 'opportunity-radar-article-structure-'));
  const result = await runDailyPipeline(buildConfig(tempDir), new Date('2026-05-07T12:00:00.000Z'));
  const markdown = await readFile(result.selectedArtifacts[0].markdownPath, 'utf8');

  expect(markdown).toContain('## 项目介绍');
  expect(markdown).toContain('## 运作模式');
  expect(markdown).toContain('## 国产化路径');
  expect(markdown).toContain('## 变现实操');
  expect(markdown).not.toContain('## Overseas signal');
  expect(markdown).not.toContain('## Why now');
});
```

- [ ] **Step 2: 运行测试确认当前失败**

Run: `npm test -- tests/orchestrator.test.ts`
Expected: FAIL，提示仍输出旧章节或缺少新章节

- [ ] **Step 3: 在 `runDailyPipeline.ts` 引入分析层**

把：

```ts
article: toWrittenOpportunity(item),
```

替换为：

```ts
import { analyzeOpportunity } from '../writer/analyzeOpportunity';

article: analyzeOpportunity(item),
```

同时删除不再需要的 `toWrittenOpportunity()` 和与其紧耦合的模板字段拼装逻辑。保留 `slugify()` 仅当分析器不再自己维护 slug 时使用；如果分析器内部已经负责 slug，则把 `slugify()` 一并迁出。

- [ ] **Step 4: 清理旧模板字段引用**

在 `runDailyPipeline.ts` 中，把任何引用旧字段的代码改为新字段名。例如：

```ts
const selectedArticles = selection.selected.map((item) => ({
  signal: item,
  article: analyzeOpportunity(item),
  materialPath: undefined as string | undefined,
}));
```

确保后续构建 `articleForHtml` 时，追加的是：
- `materialImage`
- `collageImages`

而不是重建旧的 `overseasSignal`、`whyNow` 这类字段。

- [ ] **Step 5: 运行测试确认 pipeline 集成通过**

Run: `npm test -- tests/orchestrator.test.ts`
Expected: PASS，且新章节存在

- [ ] **Step 6: Commit**

```bash
git add src/orchestrator/runDailyPipeline.ts tests/orchestrator.test.ts
git commit -m "refactor: route selected articles through analysis layer"
```

---

### Task 3: 重写 Markdown 章节结构

**Files:**
- Modify: `src/writer/renderMarkdown.ts:1-80`
- Test: `tests/orchestrator.test.ts`

- [ ] **Step 1: 写失败测试，验证 Markdown 新结构与可选验证板块**

在 `tests/orchestrator.test.ts` 加两组断言：

```ts
it('renders the redesigned markdown sections for selected articles', async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), 'opportunity-radar-markdown-redesign-'));
  const result = await runDailyPipeline(buildConfig(tempDir), new Date('2026-05-07T12:00:00.000Z'));
  const markdown = await readFile(result.selectedArtifacts[0].markdownPath, 'utf8');

  expect(markdown).toContain('## 一句话介绍');
  expect(markdown).toContain('## 项目介绍');
  expect(markdown).toContain('## 运作模式');
  expect(markdown).toContain('## 为什么值得看');
  expect(markdown).toContain('## 国产化路径');
  expect(markdown).toContain('## 变现实操');
  expect(markdown).toContain('## 内容传播角度');
});

it('omits the validation section when no differentiated plan is available', async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), 'opportunity-radar-markdown-no-validation-'));
  const result = await runDailyPipeline(buildConfig(tempDir), new Date('2026-05-07T12:00:00.000Z'));
  const markdown = await readFile(result.selectedArtifacts[0].markdownPath, 'utf8');

  expect(markdown).not.toContain('## 验证步骤');
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- tests/orchestrator.test.ts`
Expected: FAIL，缺少新标题或仍带旧标题

- [ ] **Step 3: 按新数据结构重写 `renderMarkdown.ts`**

将当前输出：
- `## Overseas signal`
- `## Why now`
- `## Localization path`
- `## Monetization paths`
- `## Validation path`
- `## Target profiles`
- `## Douyin summary`

改为输出：
- `## 一句话介绍`
- `## 项目介绍`
- `## 运作模式`
- `## 为什么值得看`
- `## 国产化路径`
- `## 变现实操`
- `## 内容传播角度`
- `## 验证步骤`（可选）

实现骨架：

```ts
function renderBulletSection(title: string, items: string[]): string[] {
  return items.length > 0 ? [title, '', ...items.map((item) => `- ${item}`), ''] : [];
}

export function renderArticleMarkdown(article: WrittenOpportunity): string {
  return [
    `# ${article.title}`,
    '',
    `来源平台：${article.sourceLabel}`,
    '',
    ...(article.collageImages && article.collageImages.length > 0
      ? ['## 素材总览', '', ...article.collageImages.map(renderMarkdownImage), '']
      : []),
    '## 一句话介绍',
    article.oneLiner,
    '',
    '## 项目介绍',
    article.projectIntro,
    '',
    ...renderBulletSection('## 运作模式', article.operationModel),
    ...(article.materialImage ? ['## 来源素材', '', renderMarkdownImage(article.materialImage), ''] : []),
    ...renderBulletSection('## 为什么值得看', article.whyItMatters),
    ...renderBulletSection('## 国产化路径', article.chinaAdaptation),
    ...renderBulletSection('## 变现实操', article.monetizationExecution),
    ...renderBulletSection(
      '## 内容传播角度',
      article.contentAngles.map((item) => `${item.channel === 'wechat-article' ? '公众号' : '抖音'}：${item.angle}`),
    ),
    ...(article.validationSteps && article.validationSteps.length > 0
      ? ['## 验证步骤', '', ...article.validationSteps.map((step) => `- ${step.title}：${step.detail}`), '']
      : []),
  ].join('\n');
}
```

- [ ] **Step 4: 运行测试确认 Markdown 结构正确**

Run: `npm test -- tests/orchestrator.test.ts`
Expected: PASS，且验证板块按条件省略

- [ ] **Step 5: Commit**

```bash
git add src/writer/renderMarkdown.ts tests/orchestrator.test.ts
git commit -m "feat: redesign selected article markdown structure"
```

---

### Task 4: 重写 HTML 章节结构与排版

**Files:**
- Modify: `src/render/renderMagazineArticle.ts:1-120`
- Modify: `src/render/styles/magazine.css:1-200`
- Test: `tests/orchestrator.test.ts`

- [ ] **Step 1: 写失败测试，锁定 HTML 新章节与旧章节消失**

在 `tests/orchestrator.test.ts` 增加断言：

```ts
it('renders redesigned html sections for selected articles', async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), 'opportunity-radar-html-redesign-'));
  const result = await runDailyPipeline(buildConfig(tempDir), new Date('2026-05-07T12:00:00.000Z'));
  const html = await readFile(result.selectedArtifacts[0].htmlPath, 'utf8');

  expect(html).toContain('<h2>项目介绍</h2>');
  expect(html).toContain('<h2>运作模式</h2>');
  expect(html).toContain('<h2>为什么值得看</h2>');
  expect(html).toContain('<h2>国产化路径</h2>');
  expect(html).toContain('<h2>变现实操</h2>');
  expect(html).not.toContain('<h2>Overseas signal</h2>');
  expect(html).not.toContain('<h2>Validation</h2>');
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- tests/orchestrator.test.ts`
Expected: FAIL，HTML 仍是旧章节

- [ ] **Step 3: 在 `renderMagazineArticle.ts` 增加列表渲染与副标题展示**

将当前固定英文章节替换为中文章节，并新增“来源平台 / 一句话介绍”头部信息。建议骨架：

```ts
function renderParagraphList(items: string[]): string {
  return items.map((item) => `<p>${escapeHtml(item)}</p>`).join('');
}

function renderContentAngles(angles: OpportunityContentAngle[]): string {
  return `<ul>${angles
    .map((item) => `<li>${escapeHtml(item.channel === 'wechat-article' ? '公众号' : '抖音')}：${escapeHtml(item.angle)}</li>`)
    .join('')}</ul>`;
}
```

正文结构改成：

```ts
<header class="hero">
  <p class="kicker">${escapeHtml(article.sourceLabel)}</p>
  <h1>${escapeHtml(article.title)}</h1>
  <p class="hero__dek">${escapeHtml(article.oneLiner)}</p>
</header>
```

并把正文章节换成：
- 项目介绍
- 运作模式
- 为什么值得看
- 国产化路径
- 变现实操
- 内容传播角度
- 验证步骤（可选）

- [ ] **Step 4: 在 `magazine.css` 增加新排版样式**

至少补这些样式：

```css
.hero__dek {
  margin-top: 18px;
  font-size: 22px;
  line-height: 1.6;
  color: #5c4934;
}

.section p + p,
.section ul + p {
  margin-top: 14px;
}

.section ul {
  display: grid;
  gap: 10px;
}
```

保留现有杂志风，不引入全新视觉体系。

- [ ] **Step 5: 运行测试确认 HTML 渲染通过**

Run: `npm test -- tests/orchestrator.test.ts`
Expected: PASS，HTML 出现新章节，旧章节消失

- [ ] **Step 6: Commit**

```bash
git add src/render/renderMagazineArticle.ts src/render/styles/magazine.css tests/orchestrator.test.ts
git commit -m "feat: redesign selected article html structure"
```

---

### Task 5: 增加差异化回归测试与 README 说明

**Files:**
- Modify: `tests/orchestrator.test.ts`
- Modify: `README.md`

- [ ] **Step 1: 写失败测试，验证三类项目内容重心不同**

在 `tests/orchestrator.test.ts` 新增直接针对 `analyzeOpportunity()` 的断言，覆盖三类代表项目：

```ts
it('produces differentiated content emphasis for different project types', () => {
  const tool = analyzeOpportunity({
    id: 'tool',
    source: 'github',
    title: 'AndreyMalyar/SubPlayer',
    summary: 'Local YouTube video player with AI subtitles and TTS',
    url: 'https://github.com/AndreyMalyar/SubPlayer',
    canonicalUrl: 'https://github.com/AndreyMalyar/SubPlayer',
    publishedAt: '2026-05-07T08:00:00.000Z',
    tags: ['video', 'subtitle', 'tts'],
    rawScore: 50,
  });

  const workflow = analyzeOpportunity({
    id: 'workflow',
    source: 'github',
    title: 'm9751/agent-operating-framework',
    summary: 'An operating framework for AI coding agents, refined through enterprise sales workflow',
    url: 'https://github.com/m9751/agent-operating-framework',
    canonicalUrl: 'https://github.com/m9751/agent-operating-framework',
    publishedAt: '2026-05-07T08:00:00.000Z',
    tags: ['ai-agents', 'workflow'],
    rawScore: 50,
  });

  const foundation = analyzeOpportunity({
    id: 'foundation',
    source: 'github',
    title: 'Homebrew/homebrew-cask',
    summary: 'A CLI workflow for the administration of macOS applications distributed as binaries',
    url: 'https://github.com/Homebrew/homebrew-cask',
    canonicalUrl: 'https://github.com/Homebrew/homebrew-cask',
    publishedAt: '2026-05-07T08:00:00.000Z',
    tags: ['cask', 'toolkit'],
    rawScore: 50,
  });

  expect(tool.projectType).toBe('tool-enhancement');
  expect(workflow.projectType).toBe('workflow-collaboration');
  expect(foundation.projectType).toBe('capability-foundation');
  expect(tool.operationModel.join(' ')).not.toEqual(workflow.operationModel.join(' '));
  expect(workflow.chinaAdaptation.join(' ')).not.toEqual(foundation.chinaAdaptation.join(' '));
  expect(tool.monetizationExecution.join(' ')).not.toEqual(foundation.monetizationExecution.join(' '));
});
```

- [ ] **Step 2: 运行测试确认当前失败**

Run: `npm test -- tests/orchestrator.test.ts`
Expected: FAIL，说明差异化不够或类型判断错误

- [ ] **Step 3: 调整分析文案与分型规则直到差异化测试通过**

重点检查：
- 工具增强型应强调替代手工与轻工具交付
- 工作流协作型应强调角色分工与 SOP / 陪跑
- 能力底座型应强调二次封装、行业解决方案

必要时在 `analyzeOpportunity.ts` 调整 `detectProjectType()` 的关键词和每类生成文案。

- [ ] **Step 4: 更新 README 精选稿说明**

在 `README.md` 的输出或 MVP 行为说明中补一句，明确精选稿现在包含项目拆解内容。例如：

```md
- `selected/*.md` / `selected/*.html` — 精选案例成稿，包含项目介绍、运作模式、国产化路径、变现实操等拆解内容
```

- [ ] **Step 5: 跑完整回归**

Run: `npm test`
Expected: PASS（当前应为全部测试通过）

Run: `npm exec tsc --noEmit`
Expected: PASS（无类型错误）

Run: `npm run daily`
Expected: PASS，并在 `output/YYYY-MM-DD/selected/*.md` 中看到新章节结构

- [ ] **Step 6: Commit**

```bash
git add src/writer/analyzeOpportunity.ts tests/orchestrator.test.ts README.md
git commit -m "test: verify differentiated selected article content"
```

---

## 计划自检清单

### Spec coverage
- 精选稿标准结构：Task 2、Task 3、Task 4
- 项目分型规则：Task 1、Task 5
- 内容生成分层：Task 1、Task 2
- 验证步骤可选：Task 3
- 实施边界与验收标准：Task 5

### Placeholder scan
- 计划中没有保留 TBD / TODO / “后续实现” 等占位词
- 每个任务都包含明确文件、测试命令、预期结果与代码骨架

### Type consistency
- 分型统一使用 `OpportunityProjectType`
- 精选稿渲染统一使用 `WrittenOpportunity`
- 可选验证字段统一命名为 `validationSteps`
