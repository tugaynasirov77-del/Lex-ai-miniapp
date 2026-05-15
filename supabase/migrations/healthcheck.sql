-- Таблицы для мониторинга сервисов
-- Выполнить в Supabase Studio → SQL Editor

create table if not exists health_log (
  id uuid primary key default gen_random_uuid(),
  service text not null,
  status text not null check (status in ('up','down')),
  latency_ms int,
  error text,
  checked_at timestamptz not null default now()
);
create index if not exists health_log_service_time_idx on health_log(service, checked_at desc);

create table if not exists health_state (
  service text primary key,
  status text not null check (status in ('up','down')),
  since timestamptz not null default now(),
  alert_sent boolean not null default false,
  last_error text,
  updated_at timestamptz not null default now()
);

alter table health_log enable row level security;
alter table health_state enable row level security;

drop policy if exists "service_role_all" on health_log;
create policy "service_role_all" on health_log for all using (true) with check (true);

drop policy if exists "service_role_all" on health_state;
create policy "service_role_all" on health_state for all using (true) with check (true);
