# 海外商业机会雷达云端管理后台 MVP 设计稿

## 目标
把当前本地优先运行的 overseas-opportunity-radar，升级为一个可部署到云端的管理后台型智能体：支持定时采集、候选池入库、人工精选生成成品稿、推送文稿预览与手动推送。

## 背景
当前项目已经具备本地 MVP 能力：
- 多来源采集机会信号
- 归一化与筛选
- 自动生成精选稿 Markdown / HTML / PNG
- 自动生成机会池 HTML / PNG
- 自动生成推送文稿 `push-digest.txt`
- 支持 Feishu / WeCom / WxPusher 文本推送
- 支持来源截图保留与杂志风成品页输出

但现阶段仍然存在几个关键限制：
- 运行入口仍以本地 CLI 为主，不适合云端定时运行
- 结果主要落在本地 `output/` 目录，缺少可持续查询的数据层
- 当前是程序自己直接精选 3 条，不符合“先看候选，再人工点选成品”的真实工作流
- 推送配置依赖环境变量，不具备后台可管理能力
- 运行历史、产物状态、推送状态缺乏统一视图

## 一期产品定位
一期不是完整 SaaS，也不是聊天机器人平台，而是一个以“每日选稿工作台”为核心的云端管理后台。

它要服务的核心动作只有四个：
1. 每天自动采集并沉淀候选池
2. 在后台快速浏览候选机会
3. 人工勾选 3-5 条并生成成品稿
4. 预览推送文稿并手动推送

## 范围
### 范围内
- 云端部署 Next.js 管理后台
- 把现有 pipeline 拆成可被后台和定时任务调用的服务层
- 定时触发每日采集并写入数据库
- 后台查看候选池、运行记录、当日精选结果
- 后台人工勾选候选并触发成品稿生成
- 后台查看 HTML / Markdown / PNG / 推送文稿产物
- 后台配置并使用 Feishu / WeCom / WxPusher 推送
- 保存运行历史与推送状态

### 范围外
- 多用户与复杂权限系统
- 聊天机器人交互入口
- 自动富媒体推送卡片
- 云端完整视频工作台
- 候选池自动 AI 审稿后直接发布
- 复杂审批流
- 全量重构现有内容生成逻辑

## 技术路线
### 1. Web 框架
使用 **Next.js** 搭建云端后台。

原因：
- 页面、API、服务端逻辑可放在一套工程里
- 最适合快速搭建管理后台 MVP
- 后续加登录、历史页、配置页、操作台都顺手
- 现有 TypeScript 代码可最大程度复用

### 2. 数据库
使用 **Supabase Postgres** 存储业务数据。

原因：
- 起步快，适合 MVP
- 同时具备数据库、对象存储、基础鉴权能力
- 便于记录每日运行、候选池、精选结果与推送状态

### 3. 文件存储
使用 **Supabase Storage** 存储产物文件。

存储对象包括：
- 选稿成品 HTML
- Markdown
- 页面截图 PNG
- 来源素材图
- 推送文稿
- 候选池预览图（如保留）

这样后台可以直接使用可访问链接，而不是继续依赖本地磁盘路径。

### 4. 调度方式
一期分成两类任务：
- **每日自动采集任务**：由定时任务触发
- **人工生成任务**：由后台按钮触发

定时任务只负责把候选池准备好，不直接替用户决定最终精选结果。

## 总体架构
整体拆成 5 层：

### 1. 采集层
复用现有 sources：
- GitHub
- Hacker News
- Reddit
- RSS

职责：
- 拉取原始信号
- 返回统一的 `OpportunitySignal[]`

### 2. 处理层
复用现有逻辑：
- `normalizeSignals`
- `selectDailySet`（但用途调整）
- `analyzeOpportunity`
- `renderMagazineArticleHtml`
- `renderPushDigest`

职责：
- 归一化
- 打分
- 候选排序
- 成品内容生成
- 推送文稿生成

### 3. 应用服务层
新增面向云端后台的服务：
- `runDailyCollection`
- `generateSelectedArtifacts`
- `buildDailyPushDigest`
- `sendDailyDigest`
- `persistArtifacts`

职责：
- 组合 pipeline
- 管理数据库状态
- 管理对象存储上传
- 管理推送状态记录

### 4. 数据层
新增数据库表和查询接口，负责：
- run 记录
- candidates 记录
- selected 记录
- artifacts 记录
- push config 与 push log 记录

### 5. 后台交互层
Next.js 页面与 API：
- 今日工作台
- 历史记录
- 配置页
- API route / server actions

## 数据模型设计
### `runs`
记录每次每日运行。

字段建议：
- `id`
- `date_key`
- `trigger_type`：`cron` / `manual`
- `status`：`running` / `completed` / `failed`
- `started_at`
- `completed_at`
- `used_fallback`
- `selected_count`
- `pool_count`
- `summary_text`
- `error_message`

### `candidates`
记录当日候选池。

字段建议：
- `id`
- `run_id`
- `signal_id`
- `source`
- `title`
- `summary`
- `canonical_url`
- `published_at`
- `tags`（json / text[]）
- `raw_score`
- `rank`
- `screenshot_artifact_id`（可空）
- `selection_state`：`pending` / `selected` / `discarded`

### `selected_items`
记录人工选择后进入成品链路的项目。

字段建议：
- `id`
- `run_id`
- `candidate_id`
- `title`
- `slug`
- `status`：`queued` / `generating` / `completed` / `failed`
- `project_type`
- `one_liner`
- `article_json`
- `sort_order`

### `artifacts`
记录所有产物。

字段建议：
- `id`
- `run_id`
- `selected_item_id`（可空，用于 run 级产物如 push digest）
- `artifact_type`：`selected_html` / `selected_markdown` / `selected_png` / `material_png` / `push_digest` / `pool_html` / `pool_png`
- `storage_path`
- `public_url`
- `mime_type`
- `status`

### `push_configs`
记录推送配置。

字段建议：
- `id`
- `channel`：`feishu` / `wecom` / `wxpusher`
- `enabled`
- `secret_payload`
- `updated_at`

说明：
- 一期可以先把敏感值以服务端安全方式保存，不在前端明文暴露
- 后台展示时只显示是否已配置，不显示完整密钥

### `push_logs`
记录每次推送结果。

字段建议：
- `id`
- `run_id`
- `channel`
- `status`：`success` / `failed`
- `response_summary`
- `pushed_at`

## 页面结构设计
### 1. 今日工作台
这是一期最重要的页面。

分为四块：

#### A. 今日运行卡片
展示：
- 今日是否已采集
- 当前 run 状态
- 候选数
- 已精选数
- 是否已生成推送文稿
- 是否已推送
- 手动重跑按钮

#### B. 候选池列表
每条候选显示：
- 标题
- 来源
- 一句话摘要
- 标签
- 原始链接
- 来源截图缩略图（如已采集）
- 勾选按钮

列表设计目标：
- 用户可以快速从 10-20 条候选里挑出值得做成品的条目
- 不要求一期就做复杂筛选器，但至少支持按分数顺序展示

#### C. 精选区
展示已勾选候选：
- 已选数量
- 拖动或按钮调整顺序（一期可简化为上下移动）
- “生成成品稿”按钮

#### D. 推送预览区
展示：
- 今日 push digest 内容
- 最近生成时间
- 推送按钮
- 各渠道推送状态

### 2. 历史页
按日期查看：
- 当日 run
- 候选池数量
- 精选项
- 产物链接
- 推送状态

作用：
- 回看历史内容
- 补发漏发内容
- 判断哪些天跑挂了

### 3. 配置页
一期只保留必要配置：
- OpenAI API key
- OpenAI gateway base URL
- Feishu webhook
- WeCom webhook
- WxPusher token / uid
- 时区
- 每日执行时间

## 运行流设计
### 流程一：每日自动采集
1. 定时任务触发 `runDailyCollection`
2. 创建 `runs` 记录，状态为 `running`
3. 调用各来源采集信号
4. 调用 `normalizeSignals`
5. 基于评分生成候选排序
6. 写入 `candidates`
7. 按需抓取来源截图
8. 上传截图到存储
9. 更新 `runs` 状态为 `completed`

结果：
- 后台出现 10-20 条候选
- 状态为“待精选”

### 流程二：人工精选生成
1. 用户在后台勾选 3-5 条候选
2. 创建 `selected_items`
3. 触发 `generateSelectedArtifacts`
4. 对每条候选运行 `analyzeOpportunity`
5. 渲染 Markdown / HTML
6. 截图生成 PNG
7. 上传全部产物到存储
8. 记录 `artifacts`
9. 调用 `renderPushDigest` 生成每日推送文稿
10. 保存 run 级 `push_digest` 产物

结果：
- 后台可直接打开 HTML 成品
- 推送预览区可读取当日文稿

### 流程三：手动推送
1. 用户点击“推送今日文稿”
2. 后端读取当日 `push_digest`
3. 根据启用配置调用 Feishu / WeCom / WxPusher 适配器
4. 记录 `push_logs`
5. 回写 run 级推送状态

## 对现有代码的改造策略
### 保留的部分
以下能力尽量原样复用：
- 采集源实现
- 归一化逻辑
- 内容分析与成稿渲染
- 推送文稿渲染
- 推送适配器

### 需要拆分的部分
当前 `runDailyPipeline` 把太多事情串在一起：
- 采集
- 精选
- 成品生成
- 推送
- 本地归档

云端版本要把它拆成几个独立服务：
- `collectCandidatesForRun`
- `captureCandidateMaterials`
- `createSelectedArticles`
- `createRunPushDigest`
- `dispatchRunPushes`

### 本地文件输出的角色变化
`output/` 在云端一期不再是唯一输出真相源。

新的原则：
- 开发环境仍允许本地输出，方便调试
- 云端环境以数据库记录 + 对象存储为准
- 页面读取 `public_url` 而不是本地磁盘路径

## 部署设计
### 应用部署
一期部署到 **Vercel**：
- 托管 Next.js 后台
- 部署 API routes / server actions
- 配环境变量
- 配置定时任务入口

### 数据与存储
部署到 **Supabase**：
- Postgres
- Storage
- 基础服务端凭据管理

### 定时执行
用 Vercel Cron 调后台内部安全接口：
- `/api/cron/daily-collect`

说明：
- 自动采集和人工精选生成拆开，有助于避免“每天自动帮你直接定稿”带来的失控感
- 也更符合你希望先看候选再选稿的工作方式

## 安全与配置策略
一期最小安全要求：
- 定时接口必须有服务端校验，不允许裸公开
- 推送配置只在服务端使用，不下发前端
- 配置页只显示“已配置 / 未配置”，不明文展示密钥
- 敏感环境变量优先放 Vercel / Supabase 服务端配置中

## 失败与降级策略
### 1. 来源采集失败
- 单个来源失败不影响整次 run
- 其他来源正常数据仍应入库

### 2. 截图失败
- 候选仍可展示，只是没有截图

### 3. GPT Image-2 或成品图链路失败
- 单条精选失败不应拖垮整次 run
- 失败条目标记为 `failed` 并显示错误

### 4. 推送失败
- 推送失败不影响成品产物保留
- 后台允许再次补推

### 5. 定时任务失败
- 在 run 记录里可见失败状态
- 后台支持手动重跑

## 一期验收标准
### 1. 云端每日可自动生成候选池
每天定时后，后台能看到当日候选列表，而不是只在日志里知道跑过。

### 2. 用户可在后台点选生成成品
不再由程序直接固定精选 3 条，而是支持人工勾选 3-5 条生成成品稿。

### 3. 成品稿与推送文稿可在后台预览
至少能打开：
- HTML 成品页
- PNG 成品预览图
- 当日 push digest

### 4. 推送可在后台手动触发
配置好渠道后，可从后台触发一次当日推送，并看到成功/失败状态。

### 5. 历史记录可追溯
至少能按日期回看 run、候选、精选结果和推送状态。

## 为什么现在先做这个
因为你当前真正缺的，不是继续增强单篇文章字段，而是把整条生产链从“本地一次性跑脚本”升级成“云端持续运营后台”。

只有先把：
- 定时采集
- 候选池
- 人工精选
- 成品产物
- 推送控制

这些关键环节搬进云端后台，这个项目才算从本地实验，进入可持续使用的智能体阶段。

## 下一步实施方向
下一步实施计划应拆成以下几块：
1. 搭 Next.js 后台基础骨架
2. 建 Supabase 数据表与存储层
3. 拆分现有 pipeline 成服务层
4. 接入每日自动采集与 run 入库
5. 做今日工作台：候选池、精选区、推送预览区
6. 接通成品生成、产物上传与手动推送
7. 增加云端环境配置、失败状态与基础测试
