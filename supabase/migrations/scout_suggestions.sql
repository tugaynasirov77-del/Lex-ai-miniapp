-- Фаза 3.5: Авто-обнаружение конкурентов

create table if not exists scout_suggestions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  username text not null,
  title text,
  description text,
  subscribers int,
  relevance_score int not null default 0,
  reason text,
  status text not null default 'pending' check (status in ('pending','added','dismissed')),
  fetched_at timestamptz not null default now(),
  unique(project_id, username)
);
create index if not exists scout_suggestions_project_status_idx
  on scout_suggestions(project_id, status, relevance_score desc);

alter table scout_suggestions enable row level security;
drop policy if exists "service_role_all" on scout_suggestions;
create policy "service_role_all" on scout_suggestions for all using (true) with check (true);
