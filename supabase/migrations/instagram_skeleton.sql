-- Instagram-раздел: скелет таблиц. Реальные функции добавляем по одной.
-- Не ломает существующий TG-флоу.

alter table projects
  add column if not exists platform text not null default 'telegram',
  add column if not exists instagram_username text,
  add column if not exists instagram_account_id text,
  add column if not exists instagram_followers int,
  add column if not exists instagram_attached_at timestamptz,
  add column if not exists instagram_token text,
  add column if not exists instagram_token_expires_at timestamptz;

-- содержательный тип контента для черновика:
-- 'post' (текстовый пост, как было) | 'reel' (видео 9:16) | 'carousel' (2-10 картинок)
alter table content_drafts
  add column if not exists platform text not null default 'telegram',
  add column if not exists content_type text not null default 'post',
  add column if not exists video_url text,
  add column if not exists cover_url text,
  add column if not exists media_urls jsonb,
  add column if not exists ig_media_id text,
  add column if not exists ig_permalink text;

create index if not exists projects_platform_idx on projects(platform);
create index if not exists content_drafts_platform_idx on content_drafts(platform);

-- скелет таблиц IG-специфики (пустые, наполним по этапам)
create table if not exists ig_competitors (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  username text not null,
  full_name text,
  followers int,
  top_post_caption text,
  top_post_likes int,
  top_post_url text,
  fetched_at timestamptz default now(),
  unique(project_id, username)
);

create table if not exists ig_snapshots (
  id bigserial primary key,
  project_id uuid not null references projects(id) on delete cascade,
  followers int,
  posts_count int,
  reels_count int,
  snapshot_at timestamptz default now()
);

create index if not exists ig_snapshots_project_idx on ig_snapshots(project_id, snapshot_at desc);

comment on column projects.platform is 'telegram | instagram';
comment on column content_drafts.platform is 'telegram | instagram';
comment on column content_drafts.content_type is 'post | reel | carousel';
comment on column content_drafts.media_urls is 'jsonb массив URL картинок для карусели';
comment on column content_drafts.video_url is 'URL Reel-видео после рендера (HeyGen+FFmpeg)';
comment on column content_drafts.cover_url is 'URL обложки Reel';
comment on column content_drafts.ig_media_id is 'ID опубликованного медиа в Instagram';
