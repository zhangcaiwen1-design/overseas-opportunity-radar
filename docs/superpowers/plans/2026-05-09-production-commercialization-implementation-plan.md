# 海外商业机会雷达生产上线与商业化实施计划

## 目标
围绕 `docs/superpowers/specs/2026-05-09-production-commercialization-design.md`，先完成“生产运行层 + 网站上线层”的首发里程碑：让系统具备 staging / production 双环境、可追踪可补跑的运行闭环，以及网站首发与基础转化能力。

## 实施原则
- 先打通生产运行闭环，再接网站对外发布。
- 生成自动化，发布半自动化。
- 不引入独立 worker / queue，沿用 Next.js + Supabase + Vercel Cron。
- 先补最小可用领域模型，再接发布台与商业化入口。

## Phase 1：双环境与部署基线
### 目标
建立 staging / production 隔离的运行基线，避免 dev 直连 production。

### 关键改动
- 明确环境变量矩阵：Supabase URL / key、Storage bucket、admin secret、cron secret、站点域名。
- 调整 `vercel.json`，明确 staging / production 的 cron 入口与触发策略。
- 收口云端预检，让页面能识别当前环境缺失项与不可用状态。
- 补部署与环境配置说明。

### 涉及位置
- `vercel.json`
- `src/cloud/cloudEnv.ts`
- `src/cloud/queries/loadDashboardData.ts`
- `README.md`

### 验证
- staging 可通过 preflight。
- staging 可手动触发 collect / generate / push。
- production 配置与 staging 完全隔离。

### 风险与依赖
- 依赖两套 Supabase 项目与 Vercel 环境准备。
- 当前 cron 配置偏 MVP，需要先收口部署约束。

## Phase 2：运行健康、告警与恢复
### 目标
让 run 真正具备可追踪、可告警、可补跑能力。

### 关键改动
- 扩展 dashboard / history 的运行状态展示，覆盖 cron 未执行、collect / generate / push / publish 失败。
- 新增异常列表与恢复入口，统一收敛到后台操作流。
- 复用现有推送通道做内部告警。
- 为 publish 失败预留与 push 同级的状态呈现方式。

### 涉及位置
- `src/cloud/viewmodels/buildTodayDashboardViewModel.ts`
- `src/cloud/queries/loadDashboardData.ts`
- `app/page.tsx`
- `app/history/page.tsx`
- `app/DashboardActions.tsx`
- `src/cloud/services/sendRunPushes.ts`

### 验证
- 人工构造失败 run 后，首页与历史页都能定位失败点。
- 告警可写入后台可见状态，并触发内部通知。
- 补跑后状态能恢复且不污染当前视图。

### 风险与依赖
- 需要先定义 publish 失败的状态模型。
- 依赖现有 run / push 视图继续扩展而不是重写。

## Phase 3：发布领域模型扩展
### 目标
为网站发布、多渠道派生、审计和转化埋点建立持久化结构。

### 关键改动
- 新增 `content_variants` 表，承载 `site` / `wechat` / `douyin` 草稿与发布状态。
- 新增 `publication_logs` 表，记录 publish / retry / withdraw 操作。
- 新增 `lead_events` 表，记录订阅、咨询、私域等转化事件。
- 增加对应 repository、types、查询与写入接口。

### 涉及位置
- `supabase/migrations/20260508_cloud_admin_mvp.sql`
- `src/cloud/types.ts`
- `src/cloud/repositories/*`

### 验证
- 同一 run 可保存多渠道稿件版本。
- 可为单次发布动作写入审计记录。
- 可记录基础转化事件。

### 风险与依赖
- 这是网站发布台、公众号分发、商业化埋点的共同前置。
- migration 需要保持与现有 MVP 表结构兼容。

## Phase 4：网站首发链路
### 目标
把生成产物变成可公开访问的网站内容资产。

### 关键改动
- 新增文章主稿页、每日精选页、专题聚合页。
- 建立网站内容读取路径：优先基于 `content_variants`，必要时兼容现有 artifact。
- 补基础 SEO：title、description、canonical、列表摘要。
- 保持“自动成稿 + 人工确认发布”，不做完全自动发布。

### 涉及位置
- `app/layout.tsx`
- `app/page.tsx`
- 新增站点页面路由（文章页 / 每日精选页 / 专题页）
- `src/render/*`
- `src/cloud/services/generateSelectedArtifacts.ts`

### 验证
- staging 上可从最新 run 生成并查看文章页与精选页。
- 发布后的页面具备基础 SEO 元信息。
- 未发布内容不会误暴露到公开路由。

### 风险与依赖
- 当前应用更偏后台壳，需要先分清公开站点与后台入口。
- 依赖 Phase 3 的内容版本模型。

## Phase 5：发布台与半自动发布
### 目标
建立人工审核、发布、撤回、重发的操作闭环。

### 关键改动
- 新增发布台，集中展示 site / wechat / douyin 稿件。
- 支持审核备注、发布、撤回、重试，并写入 `publication_logs`。
- 管理动作统一受管理员密钥保护。
- 将 publish 结果回流到 dashboard / history。

### 涉及位置
- `app/DashboardActions.tsx`
- `app/history/page.tsx`
- 新增 `app/publish/*`
- `app/adminSecret.ts`
- 新增发布 route handlers / services

### 验证
- 管理员可完成 review → publish → log 全链路。
- 撤回或重试后，状态与日志一致。
- 非管理入口无法触发发布动作。

### 风险与依赖
- 依赖 Phase 3 的审计表。
- 需要避免将管理功能暴露到公开站点。

## Phase 6：商业化最小闭环
### 目标
先跑通网站转化，不等待完整会员体系。

### 关键改动
- 在文章页、精选页接入订阅、私域、咨询、合作 CTA。
- 为 CTA 点击或表单提交写入 `lead_events`。
- 首期只做基础事件采集与回看，不接重 CRM。

### 涉及位置
- 网站页面组件
- `src/cloud/repositories/*`
- 新增 lead event 写入逻辑与后台读取逻辑

### 验证
- CTA 可见且能正常触发记录。
- 后台可按来源页、事件类型查看基础统计。

### 风险与依赖
- 不要在首期引入复杂会员、支付、广告系统。
- 依赖网站首发链路已稳定。

## 推荐开工顺序
1. 先做 Phase 1 的环境与 preflight 收口。
2. 再做 Phase 3 的 migration 与 repository 扩展。
3. 接着做 Phase 4 的网站文章页 / 精选页 / SEO。
4. 然后做 Phase 5 的人工发布台与审计。
5. 最后补 Phase 2 告警恢复细化与 Phase 6 商业化埋点。

## 最小切片
### Slice A：双环境可跑
- 区分 staging / production env
- preflight 显示环境状态
- staging 手动 daily run 演练

### Slice B：发布模型落地
- 建 `content_variants` / `publication_logs`
- 接入最小读写 repository

### Slice C：网站可首发
- 文章页
- 每日精选页
- 人工发布按钮
- 基础 SEO

### Slice D：最小转化
- 订阅 CTA
- 咨询 CTA
- `lead_events` 埋点

## 完成标准
- staging 可完整演练 daily run。
- production 与 staging 严格隔离。
- 网站可承接已发布内容并具备基础转化入口。
- 发布动作全量留痕，可回看、可重试、可撤回。
- 告警与补跑链路覆盖 collect / generate / push / publish 四类关键异常。
