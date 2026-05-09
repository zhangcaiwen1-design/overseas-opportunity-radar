# Overseas Opportunity Radar

## 本地开发
1. 运行 `npm install`
2. 复制 `.env.example` 为 `.env.local` 或 `.env`
3. 至少填好 `NEXT_PUBLIC_SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`SUPABASE_STORAGE_BUCKET`、`CRON_SECRET`、`NEXT_PUBLIC_APP_URL`
4. 如果你要启用生成和推送能力，再补 OpenAI、Pexels、飞书、企业微信、WxPusher 等集成变量
5. 如果当前网络不能直连 OpenAI，先设置 `OPENAI_BASE_URL` 到兼容网关，再执行图片生成流程

## 常用命令
- `npm run dev` / `npm run dev:web`：启动 Next.js 后台本地预览
- `npm run build` / `npm run build:web`：校验后台可构建
- `npm run start` / `npm run start:web`：启动生产构建
- `npm run test`：运行自动化测试
- 运行环境识别优先使用 `VERCEL_ENV`：`production` => `production`，`preview` => `staging`，其他值或未设置 => `local`
- 未配置完整时，后台 `/settings` 会直接显示缺失的云端环境变量，并展示当前环境与运行目标
- `vercel.json` 里还保留 `/api/cron/daily-collect` 的入口定义，但这已经不是当前生产主链路

## 核心环境变量

| 变量 | 本地开发 | 阿里云生产 |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | 必填 | 必填 |
| `SUPABASE_SERVICE_ROLE_KEY` | 必填 | 必填 |
| `SUPABASE_STORAGE_BUCKET` | 必填 | 必填 |
| `CRON_SECRET` | 必填，可先用占位值 | 必填，使用正式密钥 |
| `NEXT_PUBLIC_APP_URL` | 必填，可先填本地地址 | 必填，填 `https://radar.yifan1.com` |
| `ADMIN_SECRET` | 可不填 | 建议必填，用于后台保护 |

## 阿里云部署（当前正式上线方式）

一句话说明：当前正式部署链路是 GitHub Actions 在 `main` 分支触发后，把代码发到阿里云服务器，在服务器上用 `pm2` 跑 `next start`（端口 `3001`），再由 `nginx` 把公开站点 `https://radar.yifan1.com` 和后台内容工厂 `https://admin-radar.yifan1.com` 分别反代到同一个 `127.0.0.1:3001` 进程。

### 1）先认准 workflow 文件位置
- 仓库内路径：`.github/workflows/deploy.yml`
- 当前这套阿里云部署就是由这个 workflow 执行的
- 它支持两种触发方式：
  - `push main`
  - GitHub Actions 页面手动点 `workflow_dispatch`
- 当前 workflow 里公网健康检查地址写死为 `https://radar.yifan1.com`。如果你以后要换正式域名，不只是改 `NEXT_PUBLIC_APP_URL`，还要同步修改这个 workflow 里的公网 `curl` 校验地址

### 2）GitHub Secrets 清单

#### 必须项
下面这些不配，阿里云自动部署基本跑不起来：

```bash
SERVER_HOST
SERVER_PORT
SERVER_USER
SERVER_PASSWORD
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_STORAGE_BUCKET
CRON_SECRET
NEXT_PUBLIC_APP_URL
ADMIN_SECRET
```

说明：
- `SERVER_HOST`：阿里云服务器公网 IP 或域名
- `SERVER_PORT`：SSH 端口，默认一般是 `22`
- `SERVER_USER`：SSH 登录用户。你当前这台阿里云服务器就按 `root` 填。当前 workflow 默认把项目部署到 `/root/overseas-opportunity-radar`，所以最省事的做法就是直接使用 `root`；如果你以后改成别的用户，请同步检查这个目录是否可写，并且这个部署用户还要能执行 `nginx -s reload`，否则 Actions 会在 nginx 重载步骤失败
- `SERVER_PASSWORD`：上面这个 SSH 用户的登录密码
- `NEXT_PUBLIC_APP_URL`：正式环境继续填公开站点地址 `https://radar.yifan1.com`，不要填后台域名；后台域名 `https://admin-radar.yifan1.com` 只在 nginx 入口层使用，不需要额外 GitHub secret

#### 可选项
下面这些不影响站点基本启动，但会影响“采集 / 生成 / 推送”等能力：

```bash
OPENAI_API_KEY
OPENAI_BASE_URL
CANDIDATE_TRANSLATION_MODEL
PEXELS_API_KEY
FEISHU_WEBHOOK_URL
WECOM_WEBHOOK_URL
WXPUSHER_APP_TOKEN
WXPUSHER_UID
RSS_FEEDS
```

可选项怎么理解：
- 不做 AI 生成，可先不配 `OPENAI_API_KEY`
- 网络受限时，可额外配置 `OPENAI_BASE_URL`
- 不做图文素材补充，可先不配 `PEXELS_API_KEY`
- 不做推送，可先不配飞书 / 企业微信 / WxPusher
- `RSS_FEEDS` 不配时，就不会按你自定义的源去采集

### 3）服务器一次性环境准备
下面以 Ubuntu 22.04 / 24.04 为例，直接照抄即可。

#### 3.1 安装 Node.js 20、nginx、pm2、rsync

```bash
sudo apt update
sudo apt install -y curl ca-certificates gnupg nginx rsync
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

#### 3.2 检查安装结果

```bash
node -v
npm -v
pm2 -v
nginx -v
rsync --version
```

你至少要确认：
- Node 是 20.x
- `pm2` 能直接执行
- `nginx` 能直接执行
- `rsync` 已安装，否则 workflow 会在服务器步骤直接失败

#### 3.3 准备部署目录
当前 workflow 在服务器里写死了下面这些值：

```bash
APP_DIR=/root/overseas-opportunity-radar
PROCESS_NAME=overseas-opportunity-radar
APP_PORT=3001
```

先执行：

```bash
mkdir -p /root/overseas-opportunity-radar
```

如果你以后不想继续用 `root` 部署，也可以改回别的目录，但要记得同步改 workflow 里的 `APP_DIR`。

#### 3.4 域名先解析到服务器
先把下面两条 A 记录都指向这台阿里云服务器公网 IP：
- `radar.yifan1.com`
- `admin-radar.yifan1.com`

如果你还没做这一步，后面就算 Actions 成功，外网也打不开站点。

### 4）nginx 配置示例
推荐直接分成两个入口：
- `radar.yifan1.com`：只给外部用户看公开站点
- `admin-radar.yifan1.com`：只给你自己进后台内容工厂

下面这份配置会把两个域名都反代到同一个 Next.js 进程 `127.0.0.1:3001`，但公开站点域名只放行最小公开路径，避免后台页面直接暴露在公开域名下。

建议保存为：`/etc/nginx/sites-available/overseas-opportunity-radar.conf`

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name radar.yifan1.com admin-radar.yifan1.com;

    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name radar.yifan1.com;

    ssl_certificate /etc/letsencrypt/live/radar.yifan1.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/radar.yifan1.com/privkey.pem;

    location = / {
        return 302 https://radar.yifan1.com/site;
    }

    location ^~ /site {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
    }

    location = /api/lead-events {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
    }

    location ^~ /_next {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
    }

    location / {
        return 404;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name admin-radar.yifan1.com;

    ssl_certificate /etc/letsencrypt/live/admin-radar.yifan1.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/admin-radar.yifan1.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
        proxy_read_timeout 60s;
        proxy_connect_timeout 60s;
    }
}
```

启用方式：

```bash
sudo ln -sf /etc/nginx/sites-available/overseas-opportunity-radar.conf /etc/nginx/sites-enabled/overseas-opportunity-radar.conf
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx
```

如果你还没有 HTTPS 证书，需要分别给 `radar.yifan1.com` 和 `admin-radar.yifan1.com` 申请证书，再套用上面的 443 配置。

### 5）首次部署顺序（按这个顺序做）

1. 上传代码
   - 先把项目代码和 `.github/workflows/deploy.yml` 上传到 GitHub 仓库
   - 如果 workflow 还只存在于本地 worktree，没有进入 GitHub 仓库，Actions 不会生效

2. 配 GitHub Secrets
   - 先配“必须项”
   - 再按你是否需要生成 / 推送功能，补“可选项”

3. 做服务器准备
   - 安装 Node.js、nginx、pm2、rsync
   - 创建部署目录
   - 配好 nginx
   - 确认 `radar.yifan1.com` 和 `admin-radar.yifan1.com` 都已解析到服务器

4. push main
   - 当前正式部署是 `push main` 触发
   - 推送后去 GitHub 仓库的 Actions 页面看 `Deploy to Alibaba Cloud`

5. 看 Actions
   - 重点看是否卡在 SSH、SCP、`npm ci`、`npm run build`、`pm2 restart/start`、`nginx -s reload`
   - 全绿后，再继续看站点

6. 看站点
   - 先打开 `https://radar.yifan1.com`，确认会进入公开站点
   - 再打开 `https://admin-radar.yifan1.com/settings`，确认能进入后台内容工厂
   - 如果不通，先上服务器执行下面几个命令排查：

```bash
pm2 list
pm2 logs overseas-opportunity-radar --lines 100
curl -I http://127.0.0.1:3001
curl -I https://radar.yifan1.com
```

### 6）Smoke test 清单
每次首次上线或重要改动上线后，至少按下面顺序过一遍：

- [ ] 打开 `https://admin-radar.yifan1.com/settings`，确认预检通过，没有关键环境变量缺失
- [ ] 在后台手动采集一次
- [ ] 跑一次生成流程
- [ ] 跑一次推送流程
- [ ] 执行一次“发布到网站”
- [ ] 打开 `https://radar.yifan1.com`，确认会跳到公开站点入口
- [ ] 打开 `https://radar.yifan1.com/site`，确认列表页可访问
- [ ] 打开一篇 `https://radar.yifan1.com/site/[slug]`，确认详情页可访问
- [ ] 在公开网站上提交一次线索表单，确认能写入
- [ ] 执行一次“从网站下线”，确认内容会从公开网站侧消失

## Vercel 旧说明（仅保留给历史参考，不是当前生产链路）

注意：本项目当前正式生产环境不走 Vercel，生产上线请以上面的“阿里云部署”为准。下面这些内容只保留给历史 preview / staging 对照用，避免你误以为 production 还在走 Vercel。

### 旧的 Vercel staging 参考
1. 确认 Vercel Preview 环境下 `VERCEL_ENV=preview`
2. 配置 `NEXT_PUBLIC_SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`SUPABASE_STORAGE_BUCKET`、`CRON_SECRET`、`NEXT_PUBLIC_APP_URL`
3. 执行 migration：`supabase/migrations/20260508_cloud_admin_mvp.sql`
4. 在 Supabase 手动创建与 `SUPABASE_STORAGE_BUCKET` 同名的 bucket
5. 部署后打开 `/settings`，确认页面显示 `Staging 环境`
6. 在 staging 手动触发一次 daily run 演练，确认 preflight 为 ready 后再继续联调

### 旧的 Vercel production 说明
- 已降级为历史说明，不再作为当前正式上线方式
- 如果你看到旧文档提到 Vercel Production，请以本 README 的“阿里云部署（当前正式上线方式）”为准

## 最短本地 Supabase 联调路径
1. 复制 `.env.example` 为 `.env.local` 或 `.env`
2. 填入 `NEXT_PUBLIC_SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`SUPABASE_STORAGE_BUCKET`、`CRON_SECRET`、`NEXT_PUBLIC_APP_URL`
   - 本地联调时 `CRON_SECRET` 和 `NEXT_PUBLIC_APP_URL` 可以先填占位值，但不能为空
3. 执行现有 migration：`supabase/migrations/20260508_cloud_admin_mvp.sql`
4. 在 Supabase 手动创建 Storage bucket
5. 启动 `npm run dev:web`
6. 先看 `/settings` 的预检结果，再跑手动采集 `/api/runs/manual-collect`

## 云端存储与集成说明
- 业务真相已经迁移到 Supabase Postgres + Supabase Storage
- 生成后的 HTML、Markdown、PNG 和 push digest 通过云端服务写入存储并记录到数据库
- 本地开发仍可通过测试和页面预览验证生成、推送和设置流程

精选文章 HTML 和 Markdown 现在会消费来源素材图，生成证据导览区与正文来源图区（如有可用素材）。
- OpenAI 图片生成成功时，精选文章会嵌入 GPT Image-2 头图
- 头图生成失败时，文章仍会带着来源证据与正文正常渲染

## Push prerequisites
这些不是本地页面开发的硬前提，但仍然是生成与投递链路会用到的集成项：
- OpenAI API key：用于文章生成
- Pexels API key：用于库存图片和视频发现
- Feishu webhook：用于团队投递
- WeCom webhook：用于企业投递
- WxPusher app token + UID：用于个人微信投递
