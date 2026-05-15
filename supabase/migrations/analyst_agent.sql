-- Фаза 2: таблицы для Аналитика

create table if not exists channel_snapshots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  subscribers int not null,
  posts_count int not null default 0,
  snapshot_at timestamptz not null default now()
);
create index if not exists channel_snapshots_project_time_idx
  on channel_snapshots(project_id, snapshot_at desc);

create table if not exists channel_posts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  message_id bigint not null,
  text text,
  views int,
  forwards int,
  has_media boolean default false,
  published_at timestamptz,
  fetched_at timestamptz not null default now(),
  unique(project_id, message_id)
);
create index if not exists channel_posts_project_views_idx
  on channel_posts(project_id, views desc nulls last);
create index if not exists channel_posts_project_published_idx
  on channel_posts(project_id, published_at desc);

alter table channel_snapshots enable row level security;
alter table channel_posts enable row level security;

drop policy if exists "service_role_all" on channel_snapshots;
create policy "service_role_all" on channel_snapshots for all using (true) with check (true);
drop policy if exists "service_role_all" on channel_posts;
create policy "service_role_all" on channel_posts for all using (true) with check (true);
