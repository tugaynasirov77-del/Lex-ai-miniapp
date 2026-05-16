-- Фаза 4: Контентщик + Редактор — таблица черновиков

create table if not exists content_drafts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  title_variants text[] not null default '{}',
  body text not null,
  source text,
  model_writer text,
  model_editor text,
  cost_usd numeric(10,6) not null default 0,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index if not exists content_drafts_project_status_idx
  on content_drafts(project_id, status, created_at desc);

alter table content_drafts enable row level security;
drop policy if exists "service_role_all" on content_drafts;
create policy "service_role_all" on content_drafts for all using (true) with check (true);
