-- Идеи для Reels на сегодня: кэш сгенерированных под нишу идей (1 набор на проект в день)

create table if not exists project_daily_ideas (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  idea_date date not null default (now() at time zone 'utc')::date,
  ideas jsonb not null,
  created_at timestamptz not null default now(),
  unique(project_id, idea_date)
);
create index if not exists project_daily_ideas_lookup_idx
  on project_daily_ideas(project_id, idea_date desc);

alter table project_daily_ideas enable row level security;
