-- Фаза 3: Разведчик — каналы-конкуренты привязанные к проекту

create table if not exists competitor_channels (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  username text not null,
  title text,
  subscribers int,
  posts_count int not null default 0,
  top_post_message_id bigint,
  top_post_views int,
  top_post_text text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique(project_id, username)
);
create index if not exists competitor_channels_project_idx on competitor_channels(project_id);

alter table competitor_channels enable row level security;
drop policy if exists "service_role_all" on competitor_channels;
create policy "service_role_all" on competitor_channels for all using (true) with check (true);
