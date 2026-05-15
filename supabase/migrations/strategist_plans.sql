-- Фаза 5: Стратег — недельные планы контента

create table if not exists content_plans (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  week_start date not null,
  items jsonb not null default '[]'::jsonb,
  summary text,
  cost_usd numeric(10,6) not null default 0,
  model text,
  created_at timestamptz not null default now(),
  unique(project_id, week_start)
);
create index if not exists content_plans_project_week_idx on content_plans(project_id, week_start desc);

alter table content_plans enable row level security;
drop policy if exists "service_role_all" on content_plans;
create policy "service_role_all" on content_plans for all using (true) with check (true);
