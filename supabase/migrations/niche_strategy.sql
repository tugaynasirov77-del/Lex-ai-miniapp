-- Этап A: niche_strategy — выученная стратегия ниши

create table if not exists niche_strategy (
  project_id uuid primary key references projects(id) on delete cascade,
  patterns jsonb not null default '{}'::jsonb,
  summary text,
  based_on_competitors text[] not null default '{}',
  posts_analyzed int not null default 0,
  model text,
  cost_usd numeric(10,6) not null default 0,
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table niche_strategy enable row level security;
drop policy if exists "service_role_all" on niche_strategy;
create policy "service_role_all" on niche_strategy for all using (true) with check (true);
