-- Фаза 1: канал как проект + бюджет + слоты агентов
-- Выполнить в Supabase Studio → SQL Editor

-- 1) Расширяем projects полями канала
alter table projects add column if not exists channel_username text;
alter table projects add column if not exists channel_id bigint;
alter table projects add column if not exists channel_title text;
alter table projects add column if not exists channel_subscribers int;
alter table projects add column if not exists bot_admin_status text;
alter table projects add column if not exists channel_attached_at timestamptz;

create unique index if not exists projects_tg_channel_unique
  on projects(tg_id, channel_username)
  where channel_username is not null;

-- 2) Бюджет на проект ($1/мес дефолт, автостоп при превышении)
create table if not exists project_budget (
  project_id uuid primary key references projects(id) on delete cascade,
  monthly_cap_usd numeric(10,4) not null default 1.0000,
  spent_usd_current_month numeric(10,6) not null default 0,
  period_start timestamptz not null default now(),
  auto_pause_on_exceed boolean not null default true,
  updated_at timestamptz not null default now()
);

-- 3) Слоты агентов на проект (6 ролей)
create table if not exists project_agents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  role text not null check (role in ('analyst','scout','writer','editor','strategist','community')),
  status text not null default 'pending' check (status in ('pending','active','paused')),
  config jsonb not null default '{}'::jsonb,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  unique(project_id, role)
);
create index if not exists project_agents_project_idx on project_agents(project_id);

-- 4) Лог расходов на проект (для UI breakdown по агентам)
create table if not exists project_usage (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  agent_role text not null,
  cost_usd numeric(10,6) not null default 0,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  cache_read_tokens int not null default 0,
  cache_creation_tokens int not null default 0,
  model text,
  created_at timestamptz not null default now()
);
create index if not exists project_usage_project_time_idx on project_usage(project_id, created_at desc);

-- RLS — только service_role (запросы идут через server-side)
alter table project_budget enable row level security;
alter table project_agents enable row level security;
alter table project_usage enable row level security;

drop policy if exists "service_role_all" on project_budget;
create policy "service_role_all" on project_budget for all using (true) with check (true);
drop policy if exists "service_role_all" on project_agents;
create policy "service_role_all" on project_agents for all using (true) with check (true);
drop policy if exists "service_role_all" on project_usage;
create policy "service_role_all" on project_usage for all using (true) with check (true);
