# Overseas Opportunity Radar

## Setup
1. Run `npm install`
2. Copy `.env.example` to `.env.local` or `.env`
3. Fill in `NEXT_PUBLIC_SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`SUPABASE_STORAGE_BUCKET`、`CRON_SECRET`、`NEXT_PUBLIC_APP_URL`
4. Optional: fill in OpenAI, Pexels API, Feishu, WeCom, and WxPusher keys if you want generation and push integrations enabled
5. If direct OpenAI access is unavailable in your environment, set `OPENAI_BASE_URL` to an OpenAI-compatible gateway before running image generation flows

## Cloud admin MVP
- `npm run dev` / `npm run dev:web` — 启动 Next.js 云端后台本地预览
- `npm run build` / `npm run build:web` — 校验后台可构建
- `npm run start` / `npm run start:web` — 启动生产构建
- `npm run test` — run the automated test suite
- 额外环境变量：`NEXT_PUBLIC_SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`SUPABASE_STORAGE_BUCKET`、`CRON_SECRET`、`NEXT_PUBLIC_APP_URL`
- 运行环境识别优先使用 `VERCEL_ENV`：`production` => `production`，`preview` => `staging`，其他值或未设置 => `local`
- 未配置完整时，后台设置页会直接显示缺失的云端环境变量，并明确展示当前环境与运行目标
- `vercel.json` 已预留 `/api/cron/daily-collect` 的每日定时入口
- 设置页展示的 cron 文案仅是按当前时区与每日执行时间计算出的表达式预览，不表示运行时已自动同步部署定时任务。

### 环境变量基线

| 变量 | local | staging | production |
| --- | --- | --- | --- |
| `VERCEL_ENV` | 不设置或非 `production`/`preview` | `preview` | `production` |
| `NEXT_PUBLIC_SUPABASE_URL` | 必填 | 必填 | 必填 |
| `SUPABASE_SERVICE_ROLE_KEY` | 必填 | 必填 | 必填 |
| `SUPABASE_STORAGE_BUCKET` | 必填 | 必填 | 必填 |
| `CRON_SECRET` | 必填，可先用占位值 | 必填，使用独立密钥 | 必填，使用正式密钥 |
| `NEXT_PUBLIC_APP_URL` | 必填，可先用本地地址 | 必填，指向 staging 域名 | 必填，指向 production 域名 |

### 最小部署步骤

#### Staging
1. 确认 Vercel Preview 环境下 `VERCEL_ENV=preview`
2. 配置 `NEXT_PUBLIC_SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`SUPABASE_STORAGE_BUCKET`、`CRON_SECRET`、`NEXT_PUBLIC_APP_URL`
3. 执行 migration：`supabase/migrations/20260508_cloud_admin_mvp.sql`
4. 在 Supabase 手动创建与 `SUPABASE_STORAGE_BUCKET` 同名的 bucket
5. 部署后打开 `/settings`，确认页面显示 `Staging 环境`
6. 在 staging 手动触发一次 daily run 演练，确认 preflight 为 ready 后再继续联调

#### Production
1. 在 Vercel Production 项目中确认 `VERCEL_ENV=production`
2. 按 production 域名与正式凭据配置同一组云端变量
3. 确认 production 数据库已执行 `supabase/migrations/20260508_cloud_admin_mvp.sql`
4. 确认 production bucket 已创建，且 `/settings` 显示 `生产环境`
5. 再检查 `vercel.json` 对应的 `/api/cron/daily-collect` 定时入口是否已随部署生效

### 最短本地 Supabase 联调路径
1. 复制 `.env.example` 为 `.env.local` 或 `.env`
2. 填入 `NEXT_PUBLIC_SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`SUPABASE_STORAGE_BUCKET`、`CRON_SECRET`、`NEXT_PUBLIC_APP_URL`
   - 本地联调时 `CRON_SECRET` 和 `NEXT_PUBLIC_APP_URL` 可以先填占位值，但不能为空
3. 执行现有 migration：`supabase/migrations/20260508_cloud_admin_mvp.sql`
4. 在 Supabase 手动创建 Storage bucket
5. 启动 `npm run dev:web`
6. 先看 `/settings` 的预检结果，再跑手动采集 `/api/runs/manual-collect`

## Stored artifacts
- 业务真相已经迁移到 Supabase Postgres + Supabase Storage
- 生成后的 HTML、Markdown、PNG 和 push digest 通过云端服务写入存储并记录到数据库
- 本地开发仍可通过测试和页面预览验证生成、推送和设置流程

精选文章 HTML 和 Markdown 现在会消费来源素材图，生成证据导览区与正文来源图区（如有可用素材）。
- When OpenAI image generation succeeds, selected articles embed a GPT Image-2 hero visual.
- When hero image generation fails, the article still renders with source evidence and text content.

## Push prerequisites
These are not required for basic local page development, but remain the integration targets for generation and delivery:
- OpenAI API key for article generation
- Pexels API key for stock image and video discovery
- Feishu webhook for team delivery
- WeCom webhook for enterprise delivery
- WxPusher app token and UID for personal WeChat delivery
