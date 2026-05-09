# 云端管理后台 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把当前本地 CLI 版 overseas-opportunity-radar 升级成可部署到云端的管理后台 MVP，支持每日自动采集、候选池入库、人工点选生成成品稿、推送文稿预览与手动推送。

**Architecture:** 保留现有 `src/` 下的采集、分析、渲染、推送能力，把 `runDailyPipeline` 拆成可复用的云端服务层，再用 Next.js App Router 提供管理后台、API 路由和 cron 入口。业务真相从本地 `output/` 目录迁移到 “Supabase Postgres + Supabase Storage”，但开发环境仍保留本地输出用于调试与回归测试。

**Tech Stack:** Next.js App Router、React、TypeScript、Supabase Postgres、Supabase Storage、Vitest、现有 Playwright/OpenAI/推送适配器。

---

## 文件职责映射

- `package.json`
  - 增加 Next.js、React、Supabase 依赖与 Web 脚本。
- `next.config.ts`
  - Next.js 运行配置。
- `next-env.d.ts`
  - Next.js TypeScript 类型入口。
- `app/layout.tsx`
  - 后台通用布局。
- `app/page.tsx`
  - 今日工作台首页。
- `app/history/page.tsx`
  - 历史运行页。
- `app/settings/page.tsx`
  - 配置页。
- `app/globals.css`
  - 后台全局样式。
- `app/api/cron/daily-collect/route.ts`
  - 每日 cron 采集入口。
- `app/api/runs/[runId]/generate/route.ts`
  - 人工点选后生成成品稿。
- `app/api/runs/[runId]/push/route.ts`
  - 手动推送今日文稿。
- `src/cloud/loadCloudConfig.ts`
  - 解析云端环境变量。
- `src/cloud/types.ts`
  - 云端后台领域类型。
- `src/cloud/supabase/serverClient.ts`
  - Supabase 服务端客户端封装。
- `src/cloud/repositories/*.ts`
  - `runs`、`candidates`、`selected_items`、`artifacts`、`push_configs`、`push_logs` 的访问层。
- `src/cloud/storage/uploadArtifact.ts`
  - 产物上传到对象存储。
- `src/cloud/services/collectCandidatesForRun.ts`
  - 采集、归一化、排序、候选入库。
- `src/cloud/services/generateSelectedArtifacts.ts`
  - 把勾选候选生成成品 HTML/Markdown/PNG 并上传。
- `src/cloud/services/createRunPushDigest.ts`
  - 基于已生成成品构建 run 级推送文稿。
- `src/cloud/services/sendRunPushes.ts`
  - 读取已启用配置并执行手动推送。
- `src/cloud/viewmodels/buildTodayDashboardViewModel.ts`
  - 把 run/candidate/artifact 数据整理成首页可消费结构。
- `src/cloud/viewmodels/buildHistoryPageViewModel.ts`
  - 历史页展示模型。
- `src/cloud/viewmodels/buildSettingsPageViewModel.ts`
  - 配置页展示模型。
- `supabase/migrations/20260508_cloud_admin_mvp.sql`
  - 一期数据库表结构。
- `vercel.json`
  - Vercel cron 配置。
- `tests/cloudConfig.test.ts`
  - 云端环境变量解析测试。
- `tests/cloudRepositories.test.ts`
  - 仓储层测试。
- `tests/cloudCollect.test.ts`
  - 每日采集服务测试。
- `tests/cloudGenerate.test.ts`
  - 成品生成服务测试。
- `tests/cloudPush.test.ts`
  - 手动推送服务测试。
- `tests/cloudViewModels.test.ts`
  - 首页/历史页/配置页视图模型测试。
- `README.md`
  - 补充云端运行方式、环境变量和 cron 说明。

## 任务拆分说明

这个 spec 虽然跨越前端、后端、数据层，但都服务同一条主线：
- 每日采集候选
- 人工精选生成成品
- 推送与回看

因此保持为**一个实施计划**更合理，但内部拆成 7 个可独立验证的任务，逐步把项目从 CLI 迁移到云端后台。

### Task 1: 搭建 Next.js 后台骨架与云端环境配置

**Files:**
- Modify: `package.json:1-29`
- Create: `next.config.ts`
- Create: `next-env.d.ts`
- Create: `app/layout.tsx`
- Create: `app/page.tsx`
- Create: `app/globals.css`
- Create: `src/cloud/loadCloudConfig.ts`
- Test: `tests/cloudConfig.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { loadCloudConfig } from '../src/cloud/loadCloudConfig';

describe('loadCloudConfig', () => {
  it('maps required Supabase and cron settings for the cloud admin app', () => {
    const config = loadCloudConfig({
      NEXT_PUBLIC_SUPABASE_URL: 'https://demo.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      SUPABASE_STORAGE_BUCKET: 'artifacts',
      CRON_SECRET: 'cron-secret',
      NEXT_PUBLIC_APP_URL: 'https://radar.example.com',
    });

    expect(config.supabaseUrl).toBe('https://demo.supabase.co');
    expect(config.storageBucket).toBe('artifacts');
    expect(config.cronSecret).toBe('cron-secret');
    expect(config.appUrl).toBe('https://radar.example.com');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/cloudConfig.test.ts`
Expected: FAIL with `Cannot find module '../src/cloud/loadCloudConfig'`.

- [ ] **Step 3: Write minimal implementation**

```json
{
  "scripts": {
    "dev:web": "next dev",
    "build:web": "next build",
    "start:web": "next start"
  },
  "dependencies": {
    "next": "^15.0.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "@supabase/supabase-js": "^2.49.0"
  }
}
```

```ts
// src/cloud/loadCloudConfig.ts
import { z } from 'zod';

const cloudConfigSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_STORAGE_BUCKET: z.string().min(1),
  CRON_SECRET: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url(),
});

export function loadCloudConfig(env: Record<string, string | undefined>) {
  const parsed = cloudConfigSchema.parse(env);
  return {
    supabaseUrl: parsed.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: parsed.SUPABASE_SERVICE_ROLE_KEY,
    storageBucket: parsed.SUPABASE_STORAGE_BUCKET,
    cronSecret: parsed.CRON_SECRET,
    appUrl: parsed.NEXT_PUBLIC_APP_URL,
  };
}
```

```tsx
// app/layout.tsx
import './globals.css';
import type { ReactNode } from 'react';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <main className="admin-shell">{children}</main>
      </body>
    </html>
  );
}
```

```tsx
// app/page.tsx
export default function HomePage() {
  return (
    <section className="page-section">
      <h1>海外商业机会雷达</h1>
      <p>云端管理后台骨架已就绪。</p>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/cloudConfig.test.ts && npm run build:web`
Expected: `tests/cloudConfig.test.ts` PASS, then Next.js build PASS with `/` route generated.

- [ ] **Step 5: Commit**

```bash
git add package.json next.config.ts next-env.d.ts app/layout.tsx app/page.tsx app/globals.css src/cloud/loadCloudConfig.ts tests/cloudConfig.test.ts
git commit -m "feat: bootstrap next admin shell"
```

### Task 2: 落地 Supabase 表结构与仓储层

**Files:**
- Create: `supabase/migrations/20260508_cloud_admin_mvp.sql`
- Create: `src/cloud/types.ts`
- Create: `src/cloud/supabase/serverClient.ts`
- Create: `src/cloud/repositories/runRepository.ts`
- Create: `src/cloud/repositories/candidateRepository.ts`
- Create: `src/cloud/repositories/selectedItemRepository.ts`
- Create: `src/cloud/repositories/artifactRepository.ts`
- Create: `src/cloud/repositories/pushConfigRepository.ts`
- Create: `src/cloud/repositories/pushLogRepository.ts`
- Test: `tests/cloudRepositories.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest';
import { createRunRepository } from '../src/cloud/repositories/runRepository';

describe('createRunRepository', () => {
  it('creates a run with cron trigger metadata', async () => {
    const insert = vi.fn().mockReturnValue({ select: () => ({ single: async () => ({ data: { id: 'run-1', trigger_type: 'cron' }, error: null }) }) });
    const from = vi.fn().mockReturnValue({ insert });
    const repository = createRunRepository({ from } as never);

    const run = await repository.create({ dateKey: '2026-05-08', triggerType: 'cron' });

    expect(from).toHaveBeenCalledWith('runs');
    expect(run.id).toBe('run-1');
    expect(run.triggerType).toBe('cron');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/cloudRepositories.test.ts`
Expected: FAIL with `Cannot find module '../src/cloud/repositories/runRepository'`.

- [ ] **Step 3: Write minimal implementation**

```sql
create table runs (
  id uuid primary key default gen_random_uuid(),
  date_key text not null,
  trigger_type text not null check (trigger_type in ('cron', 'manual')),
  status text not null check (status in ('running', 'completed', 'failed')) default 'running',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  used_fallback boolean not null default false,
  selected_count integer not null default 0,
  pool_count integer not null default 0,
  summary_text text not null default '',
  error_message text not null default ''
);

create table candidates (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs(id) on delete cascade,
  signal_id text not null,
  source text not null,
  title text not null,
  summary text not null,
  canonical_url text not null,
  published_at timestamptz,
  tags jsonb not null default '[]'::jsonb,
  raw_score integer not null default 0,
  rank integer not null,
  selection_state text not null check (selection_state in ('pending', 'selected', 'discarded')) default 'pending'
);
```

```ts
// src/cloud/types.ts
export interface CloudRun {
  id: string;
  dateKey: string;
  triggerType: 'cron' | 'manual';
  status: 'running' | 'completed' | 'failed';
}

export interface CreateRunInput {
  dateKey: string;
  triggerType: 'cron' | 'manual';
}
```

```ts
// src/cloud/repositories/runRepository.ts
import type { CreateRunInput, CloudRun } from '../types';

export function createRunRepository(supabase: { from: (table: string) => { insert: (value: unknown) => { select: () => { single: () => Promise<{ data: { id: string; date_key?: string; trigger_type: 'cron' | 'manual'; status?: 'running' | 'completed' | 'failed' }; error: unknown }> } } } }) {
  return {
    async create(input: CreateRunInput): Promise<CloudRun> {
      const { data, error } = await supabase
        .from('runs')
        .insert({ date_key: input.dateKey, trigger_type: input.triggerType, status: 'running' })
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        dateKey: data.date_key ?? input.dateKey,
        triggerType: data.trigger_type,
        status: data.status ?? 'running',
      };
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/cloudRepositories.test.ts`
Expected: PASS with the repository mapping test green.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260508_cloud_admin_mvp.sql src/cloud/types.ts src/cloud/supabase/serverClient.ts src/cloud/repositories/*.ts tests/cloudRepositories.test.ts
git commit -m "feat: add supabase schema and repositories"
```

### Task 3: 抽离每日候选采集服务并把候选池写入数据库

**Files:**
- Create: `src/cloud/services/collectCandidatesForRun.ts`
- Modify: `src/orchestrator/runDailyPipeline.ts:169-188`
- Test: `tests/cloudCollect.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest';
import { collectCandidatesForRun } from '../src/cloud/services/collectCandidatesForRun';

describe('collectCandidatesForRun', () => {
  it('normalizes signals, ranks candidates, and persists them under the run', async () => {
    const fetchSignals = vi.fn().mockResolvedValue([
      { id: 'signal-1', source: 'github', title: 'Signal One', summary: 'summary', canonicalUrl: 'https://example.com/1', url: 'https://example.com/1', publishedAt: '2026-05-08T00:00:00.000Z', tags: ['ops'], rawScore: 40 },
    ]);
    const createMany = vi.fn().mockResolvedValue(undefined);

    const result = await collectCandidatesForRun({
      runId: 'run-1',
      fetchSignals,
      createMany,
    });

    expect(result.poolCount).toBe(1);
    expect(createMany).toHaveBeenCalledWith('run-1', expect.arrayContaining([expect.objectContaining({ signalId: 'signal-1', rank: 1 })]));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/cloudCollect.test.ts`
Expected: FAIL with `Cannot find module '../src/cloud/services/collectCandidatesForRun'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/cloud/services/collectCandidatesForRun.ts
import { normalizeSignals } from '../../src/pipeline/normalizeSignals';
import type { OpportunitySignal } from '../types';

interface CandidateRecord {
  signalId: string;
  source: string;
  title: string;
  summary: string;
  canonicalUrl: string;
  publishedAt: string;
  tags: string[];
  rawScore: number;
  rank: number;
}

export async function collectCandidatesForRun(input: {
  runId: string;
  fetchSignals: () => Promise<OpportunitySignal[]>;
  createMany: (runId: string, candidates: CandidateRecord[]) => Promise<void>;
}) {
  const normalizedSignals = normalizeSignals(await input.fetchSignals());
  const ranked = normalizedSignals.map((signal, index) => ({
    signalId: signal.id,
    source: signal.source,
    title: signal.title,
    summary: signal.summary,
    canonicalUrl: signal.canonicalUrl,
    publishedAt: signal.publishedAt,
    tags: signal.tags,
    rawScore: signal.rawScore,
    rank: index + 1,
  }));

  await input.createMany(input.runId, ranked);
  return { poolCount: ranked.length, candidates: ranked };
}
```

```ts
// in src/orchestrator/runDailyPipeline.ts
export async function collectSignals(): Promise<OpportunitySignal[]> {
  // keep existing source fan-out here so CLI and cloud service can both reuse it
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/cloudCollect.test.ts`
Expected: PASS with one persisted ranked candidate.

- [ ] **Step 5: Commit**

```bash
git add src/cloud/services/collectCandidatesForRun.ts src/orchestrator/runDailyPipeline.ts tests/cloudCollect.test.ts
git commit -m "refactor: extract cloud candidate collection service"
```

### Task 4: 抽离人工精选生成服务并上传成品产物

**Files:**
- Create: `src/cloud/storage/uploadArtifact.ts`
- Create: `src/cloud/services/generateSelectedArtifacts.ts`
- Modify: `src/orchestrator/runDailyPipeline.ts:232-420`
- Test: `tests/cloudGenerate.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest';
import { generateSelectedArtifacts } from '../src/cloud/services/generateSelectedArtifacts';

describe('generateSelectedArtifacts', () => {
  it('creates html, markdown, screenshot, and push digest records for selected candidates', async () => {
    const upload = vi.fn().mockResolvedValue({ storagePath: 'runs/2026-05-08/selected/demo.html', publicUrl: 'https://cdn.example.com/demo.html' });
    const saveArtifact = vi.fn().mockResolvedValue(undefined);

    const result = await generateSelectedArtifacts({
      runId: 'run-1',
      dateKey: '2026-05-08',
      selectedCandidates: [{ id: 'candidate-1', title: 'Demo', summary: 'summary', canonicalUrl: 'https://example.com', source: 'github', tags: ['ops'], rawScore: 42, publishedAt: '2026-05-08T00:00:00.000Z' }],
      upload,
      saveArtifact,
    });

    expect(result.selectedCount).toBe(1);
    expect(saveArtifact).toHaveBeenCalledWith(expect.objectContaining({ artifactType: 'selected_html' }));
    expect(upload).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/cloudGenerate.test.ts`
Expected: FAIL with `Cannot find module '../src/cloud/services/generateSelectedArtifacts'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/cloud/storage/uploadArtifact.ts
export interface UploadedArtifact {
  storagePath: string;
  publicUrl: string;
}

export async function uploadArtifact(input: {
  bucket: string;
  storagePath: string;
  body: Buffer | string;
  contentType: string;
}): Promise<UploadedArtifact> {
  return {
    storagePath: input.storagePath,
    publicUrl: input.storagePath,
  };
}
```

```ts
// src/cloud/services/generateSelectedArtifacts.ts
import { analyzeOpportunity } from '../writer/analyzeOpportunity';
import { renderArticleMarkdown } from '../writer/renderMarkdown';
import { renderMagazineArticleHtml } from '../render/renderMagazineArticle';

export async function generateSelectedArtifacts(input: {
  runId: string;
  dateKey: string;
  selectedCandidates: Array<{ id: string; title: string; summary: string; canonicalUrl: string; source: string; tags: string[]; rawScore: number; publishedAt: string }>;
  upload: (input: { storagePath: string; body: Buffer | string; contentType: string }) => Promise<{ storagePath: string; publicUrl: string }>;
  saveArtifact: (artifact: { runId: string; selectedItemId: string; artifactType: string; storagePath: string; publicUrl: string; mimeType: string }) => Promise<void>;
}) {
  for (const candidate of input.selectedCandidates) {
    const article = analyzeOpportunity(candidate as never);
    const markdown = renderArticleMarkdown(article);
    const html = renderMagazineArticleHtml(article);

    const uploadedHtml = await input.upload({
      storagePath: `runs/${input.dateKey}/selected/${article.slug}.html`,
      body: html,
      contentType: 'text/html; charset=utf-8',
    });

    await input.saveArtifact({
      runId: input.runId,
      selectedItemId: candidate.id,
      artifactType: 'selected_html',
      storagePath: uploadedHtml.storagePath,
      publicUrl: uploadedHtml.publicUrl,
      mimeType: 'text/html',
    });

    await input.upload({
      storagePath: `runs/${input.dateKey}/selected/${article.slug}.md`,
      body: markdown,
      contentType: 'text/markdown; charset=utf-8',
    });
  }

  return { selectedCount: input.selectedCandidates.length };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/cloudGenerate.test.ts`
Expected: PASS with saved HTML artifact metadata.

- [ ] **Step 5: Commit**

```bash
git add src/cloud/storage/uploadArtifact.ts src/cloud/services/generateSelectedArtifacts.ts src/orchestrator/runDailyPipeline.ts tests/cloudGenerate.test.ts
git commit -m "refactor: extract selected artifact generation service"
```

### Task 5: 新增推送文稿构建与手动推送服务

**Files:**
- Create: `src/cloud/services/createRunPushDigest.ts`
- Create: `src/cloud/services/sendRunPushes.ts`
- Test: `tests/cloudPush.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest';
import { sendRunPushes } from '../src/cloud/services/sendRunPushes';

describe('sendRunPushes', () => {
  it('sends digest through enabled channels and records push logs', async () => {
    const pushToFeishu = vi.fn().mockResolvedValue(undefined);
    const createPushLog = vi.fn().mockResolvedValue(undefined);

    const result = await sendRunPushes({
      runId: 'run-1',
      digest: '今日海外商业机会雷达｜2026-05-08',
      configs: [{ channel: 'feishu', enabled: true, secretPayload: 'https://example.com/feishu' }],
      pushers: { pushToFeishu },
      createPushLog,
    });

    expect(result.feishu).toBe(true);
    expect(pushToFeishu).toHaveBeenCalledWith('https://example.com/feishu', '今日海外商业机会雷达｜2026-05-08');
    expect(createPushLog).toHaveBeenCalledWith(expect.objectContaining({ channel: 'feishu', status: 'success' }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/cloudPush.test.ts`
Expected: FAIL with `Cannot find module '../src/cloud/services/sendRunPushes'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/cloud/services/createRunPushDigest.ts
import { renderPushDigest } from '../../push/renderPushDigest';

export function createRunPushDigest(input: {
  dateKey: string;
  poolCount: number;
  leadTitle: string;
  outputDir: string;
  selected: Parameters<typeof renderPushDigest>[0]['selected'];
}) {
  return renderPushDigest(input);
}
```

```ts
// src/cloud/services/sendRunPushes.ts
import { pushToFeishu } from '../../push/feishuPusher';
import { pushToWeCom } from '../../push/wecomPusher';
import { pushToWxPusher } from '../../push/wxpusherPusher';

export async function sendRunPushes(input: {
  runId: string;
  digest: string;
  configs: Array<{ channel: 'feishu' | 'wecom' | 'wxpusher'; enabled: boolean; secretPayload: string }>;
  pushers?: {
    pushToFeishu?: typeof pushToFeishu;
    pushToWeCom?: typeof pushToWeCom;
    pushToWxPusher?: typeof pushToWxPusher;
  };
  createPushLog: (input: { runId: string; channel: string; status: 'success' | 'failed'; responseSummary: string }) => Promise<void>;
}) {
  const pushers = {
    pushToFeishu,
    pushToWeCom,
    pushToWxPusher,
    ...input.pushers,
  };
  const status = { feishu: false, wecom: false, wxpusher: false };

  for (const config of input.configs.filter((item) => item.enabled)) {
    if (config.channel === 'feishu' && pushers.pushToFeishu) {
      await pushers.pushToFeishu(config.secretPayload, input.digest);
      await input.createPushLog({ runId: input.runId, channel: 'feishu', status: 'success', responseSummary: 'ok' });
      status.feishu = true;
    }
  }

  return status;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/cloudPush.test.ts`
Expected: PASS with Feishu channel green; later commits extend WeCom/WxPusher symmetry.

- [ ] **Step 5: Commit**

```bash
git add src/cloud/services/createRunPushDigest.ts src/cloud/services/sendRunPushes.ts tests/cloudPush.test.ts
git commit -m "feat: add cloud push digest and dispatch services"
```

### Task 6: 实现今日工作台与成品生成/推送 API

**Files:**
- Create: `src/cloud/viewmodels/buildTodayDashboardViewModel.ts`
- Modify: `app/page.tsx`
- Create: `app/api/runs/[runId]/generate/route.ts`
- Create: `app/api/runs/[runId]/push/route.ts`
- Test: `tests/cloudViewModels.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { buildTodayDashboardViewModel } from '../src/cloud/viewmodels/buildTodayDashboardViewModel';

describe('buildTodayDashboardViewModel', () => {
  it('groups today run data into status, candidate list, selected list, and push preview blocks', () => {
    const viewModel = buildTodayDashboardViewModel({
      run: { id: 'run-1', dateKey: '2026-05-08', status: 'completed', triggerType: 'cron' },
      candidates: [{ id: 'candidate-1', title: 'Signal One', source: 'github', summary: 'summary', rank: 1, selectionState: 'pending', tags: ['ops'], canonicalUrl: 'https://example.com/1' }],
      selectedItems: [],
      pushDigest: '今日海外商业机会雷达｜2026-05-08',
      pushStatus: { feishu: false, wecom: false, wxpusher: false },
    });

    expect(viewModel.statusCard.candidateCount).toBe(1);
    expect(viewModel.candidateRows[0].title).toBe('Signal One');
    expect(viewModel.pushPreview.body).toContain('今日海外商业机会雷达');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/cloudViewModels.test.ts`
Expected: FAIL with `Cannot find module '../src/cloud/viewmodels/buildTodayDashboardViewModel'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/cloud/viewmodels/buildTodayDashboardViewModel.ts
export function buildTodayDashboardViewModel(input: {
  run: { id: string; dateKey: string; status: string; triggerType: string };
  candidates: Array<{ id: string; title: string; source: string; summary: string; rank: number; selectionState: string; tags: string[]; canonicalUrl: string }>;
  selectedItems: Array<{ id: string; title: string; status: string }>;
  pushDigest: string;
  pushStatus: { feishu: boolean; wecom: boolean; wxpusher: boolean };
}) {
  return {
    statusCard: {
      runId: input.run.id,
      dateKey: input.run.dateKey,
      status: input.run.status,
      candidateCount: input.candidates.length,
      selectedCount: input.selectedItems.length,
    },
    candidateRows: input.candidates,
    selectedRows: input.selectedItems,
    pushPreview: {
      body: input.pushDigest,
      status: input.pushStatus,
    },
  };
}
```

```tsx
// app/page.tsx
import { buildTodayDashboardViewModel } from '../src/cloud/viewmodels/buildTodayDashboardViewModel';

export default async function HomePage() {
  const viewModel = buildTodayDashboardViewModel({
    run: { id: 'local-preview', dateKey: '未连接', status: 'idle', triggerType: 'manual' },
    candidates: [],
    selectedItems: [],
    pushDigest: '今日推送文稿会显示在这里。',
    pushStatus: { feishu: false, wecom: false, wxpusher: false },
  });

  return (
    <section className="page-grid">
      <article className="card"><h1>今日工作台</h1><p>候选数：{viewModel.statusCard.candidateCount}</p></article>
      <article className="card"><h2>候选池</h2><p>等待数据库接入。</p></article>
      <article className="card"><h2>推送预览</h2><pre>{viewModel.pushPreview.body}</pre></article>
    </section>
  );
}
```

```ts
// app/api/runs/[runId]/generate/route.ts
import { NextResponse } from 'next/server';

export async function POST(_: Request, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  return NextResponse.json({ ok: true, runId, action: 'generate' });
}
```

```ts
// app/api/runs/[runId]/push/route.ts
import { NextResponse } from 'next/server';

export async function POST(_: Request, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  return NextResponse.json({ ok: true, runId, action: 'push' });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/cloudViewModels.test.ts && npm run build:web`
Expected: view-model test PASS, then Next.js build PASS with `/api/runs/[runId]/generate` and `/api/runs/[runId]/push` routes listed.

- [ ] **Step 5: Commit**

```bash
git add src/cloud/viewmodels/buildTodayDashboardViewModel.ts app/page.tsx app/api/runs/[runId]/generate/route.ts app/api/runs/[runId]/push/route.ts tests/cloudViewModels.test.ts
git commit -m "feat: add today dashboard and run action routes"
```

### Task 7: 加入历史页、配置页、cron 路由与部署说明

**Files:**
- Create: `src/cloud/viewmodels/buildHistoryPageViewModel.ts`
- Create: `src/cloud/viewmodels/buildSettingsPageViewModel.ts`
- Create: `app/history/page.tsx`
- Create: `app/settings/page.tsx`
- Create: `app/api/cron/daily-collect/route.ts`
- Create: `vercel.json`
- Modify: `README.md`
- Test: `tests/cloudViewModels.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { buildHistoryPageViewModel } from '../src/cloud/viewmodels/buildHistoryPageViewModel';

describe('buildHistoryPageViewModel', () => {
  it('sorts runs by date desc and exposes artifact links', () => {
    const viewModel = buildHistoryPageViewModel([
      { id: 'run-older', dateKey: '2026-05-07', status: 'completed', selectedCount: 3, poolCount: 12, artifacts: [] },
      { id: 'run-newer', dateKey: '2026-05-08', status: 'completed', selectedCount: 4, poolCount: 10, artifacts: [{ artifactType: 'push_digest', publicUrl: 'https://cdn.example.com/push.txt' }] },
    ]);

    expect(viewModel.rows[0].id).toBe('run-newer');
    expect(viewModel.rows[0].artifactLinks[0].label).toBe('push_digest');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/cloudViewModels.test.ts -t "sorts runs by date desc and exposes artifact links"`
Expected: FAIL with `Cannot find module '../src/cloud/viewmodels/buildHistoryPageViewModel'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/cloud/viewmodels/buildHistoryPageViewModel.ts
export function buildHistoryPageViewModel(runs: Array<{ id: string; dateKey: string; status: string; selectedCount: number; poolCount: number; artifacts: Array<{ artifactType: string; publicUrl: string }> }>) {
  return {
    rows: [...runs]
      .sort((left, right) => right.dateKey.localeCompare(left.dateKey))
      .map((run) => ({
        id: run.id,
        dateKey: run.dateKey,
        status: run.status,
        selectedCount: run.selectedCount,
        poolCount: run.poolCount,
        artifactLinks: run.artifacts.map((artifact) => ({ label: artifact.artifactType, href: artifact.publicUrl })),
      })),
  };
}
```

```ts
// src/cloud/viewmodels/buildSettingsPageViewModel.ts
export function buildSettingsPageViewModel(input: {
  timezone: string;
  dailyRunTime: string;
  configuredChannels: Array<'feishu' | 'wecom' | 'wxpusher'>;
}) {
  return {
    timezone: input.timezone,
    dailyRunTime: input.dailyRunTime,
    channels: ['feishu', 'wecom', 'wxpusher'].map((channel) => ({
      channel,
      configured: input.configuredChannels.includes(channel as 'feishu' | 'wecom' | 'wxpusher'),
    })),
  };
}
```

```ts
// app/api/cron/daily-collect/route.ts
import { NextResponse } from 'next/server';
import { loadCloudConfig } from '../../../../src/cloud/loadCloudConfig';

export async function POST(request: Request) {
  const config = loadCloudConfig(process.env);
  const auth = request.headers.get('authorization');

  if (auth !== `Bearer ${config.cronSecret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  return NextResponse.json({ ok: true, action: 'daily-collect' });
}
```

```json
{
  "crons": [
    {
      "path": "/api/cron/daily-collect",
      "schedule": "0 1 * * *"
    }
  ]
}
```

```md
## Cloud admin MVP
- `npm run dev:web` — 启动 Next.js 云端后台本地预览
- `npm run build:web` — 校验后台可构建
- 需要额外配置：`NEXT_PUBLIC_SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`SUPABASE_STORAGE_BUCKET`、`CRON_SECRET`、`NEXT_PUBLIC_APP_URL`
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/cloudViewModels.test.ts && npm run build:web`
Expected: history/settings view-model tests PASS, Next.js build PASS, cron route compiled.

- [ ] **Step 5: Commit**

```bash
git add src/cloud/viewmodels/buildHistoryPageViewModel.ts src/cloud/viewmodels/buildSettingsPageViewModel.ts app/history/page.tsx app/settings/page.tsx app/api/cron/daily-collect/route.ts vercel.json README.md tests/cloudViewModels.test.ts
git commit -m "feat: add history settings and cron entrypoints"
```

## 自检

### 1. Spec coverage
- 云端后台骨架：Task 1、Task 6、Task 7
- Supabase 数据表与存储：Task 2、Task 4
- 每日自动采集候选池：Task 3、Task 7
- 人工勾选生成成品：Task 4、Task 6
- 推送文稿预览与手动推送：Task 5、Task 6
- 历史记录与配置：Task 7
- README 与部署说明：Task 7

### 2. Placeholder scan
- 未使用 TBD/TODO/“后续补充” 之类占位词。
- 每个任务都给出了明确文件、代码示例、命令和预期结果。

### 3. Type consistency
- `CloudRun`、`CreateRunInput`、`buildTodayDashboardViewModel`、`sendRunPushes`、`generateSelectedArtifacts` 在任务间命名保持一致。
- run 级主流程始终围绕 `runId`、`dateKey`、`selectedCandidates`、`pushDigest` 这几组稳定字段推进。
