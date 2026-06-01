-- Очередь задач для Михаила Reels-maker (воркер на VPS).
-- Mini App кладёт сюда задание, воркер пуллит → HeyGen + Whisper + FFmpeg.

create table if not exists reel_jobs (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references content_drafts(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  status text not null default 'pending',
    -- pending | claimed | rendering | done | failed
  script text not null,
  overlays jsonb,
    -- [{time:int, text:string, duration:int}]
  heygen_video_id text,
  video_url text,
  cover_url text,
  srt_text text,
  attempts int not null default 0,
  error text,
  claimed_by text,
  claimed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists reel_jobs_pending_idx on reel_jobs(created_at) where status = 'pending';
create index if not exists reel_jobs_status_idx on reel_jobs(status);
create index if not exists reel_jobs_draft_idx on reel_jobs(draft_id);

comment on table reel_jobs is 'Очередь рендеринга Reels. Воркер на VPS (Lex-agents repo) пуллит через /api/ig/reel-jobs/next.';
