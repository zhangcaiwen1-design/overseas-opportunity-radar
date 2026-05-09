create extension if not exists pgcrypto;

create table if not exists runs (
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

create table if not exists candidates (
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
  draft_sort_order integer,
  selection_state text not null check (selection_state in ('pending', 'selected', 'discarded')) default 'pending'
);

create table if not exists selected_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs(id) on delete cascade,
  candidate_id uuid not null references candidates(id) on delete cascade,
  title text not null,
  slug text not null,
  status text not null check (status in ('queued', 'generating', 'completed', 'failed')) default 'queued',
  project_type text not null default '',
  one_liner text not null default '',
  article_json jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0
);

create table if not exists artifacts (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs(id) on delete cascade,
  selected_item_id uuid references selected_items(id) on delete cascade,
  artifact_type text not null,
  storage_path text not null,
  public_url text not null,
  mime_type text not null,
  status text not null default 'ready'
);

create table if not exists push_configs (
  id uuid primary key default gen_random_uuid(),
  channel text not null unique check (channel in ('feishu', 'wecom', 'wxpusher')),
  enabled boolean not null default false,
  secret_payload text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists push_logs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs(id) on delete cascade,
  channel text not null check (channel in ('feishu', 'wecom', 'wxpusher')),
  status text not null check (status in ('success', 'failed')),
  response_summary text not null default '',
  pushed_at timestamptz not null default now()
);

create table if not exists app_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists content_variants (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs(id) on delete cascade,
  candidate_id uuid references candidates(id) on delete set null,
  selected_item_id uuid references selected_items(id) on delete set null,
  channel text not null check (channel in ('site', 'wechat', 'douyin')),
  title text not null,
  body text not null default '',
  status text not null check (status in ('draft', 'reviewed', 'published', 'failed')) default 'draft',
  published_at timestamptz,
  review_notes text not null default ''
);

create table if not exists publication_logs (
  id uuid primary key default gen_random_uuid(),
  content_variant_id uuid not null references content_variants(id) on delete cascade,
  channel text not null check (channel in ('site', 'wechat', 'douyin')),
  action text not null check (action in ('publish', 'retry', 'withdraw')),
  status text not null default '',
  response_summary text not null default '',
  operator text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists lead_events (
  id uuid primary key default gen_random_uuid(),
  source_channel text not null check (source_channel in ('site', 'wechat', 'douyin')),
  page_type text not null default '',
  event_type text not null check (event_type in ('subscribe', 'consult', 'community_join', 'partner_inquiry')),
  created_at timestamptz not null default now()
);
