-- Reels из пользовательского видео (без HeyGen).
-- Клиент грузит mp4 прямо в Supabase Storage → воркер делает Whisper+FFmpeg+публикацию.
-- HeyGen-ветка остаётся для будущего "Премиум" тарифа.

alter table content_drafts
  add column if not exists source_video_url text,
  add column if not exists source_video_size_bytes bigint,
  add column if not exists source_video_duration_seconds int;

alter table reel_jobs
  add column if not exists mode text not null default 'avatar',
    -- 'avatar' (HeyGen pipeline) | 'from_upload' (user-uploaded source)
  add column if not exists source_video_url text;

create index if not exists reel_jobs_mode_idx on reel_jobs(mode);

-- Hard-cap по тарифу — для project_budget
alter table project_budget
  add column if not exists reels_per_month int not null default 15;

comment on column content_drafts.source_video_url is 'URL сырого видео клиента в Supabase Storage bucket raw-uploads';
comment on column reel_jobs.mode is 'avatar = HeyGen pipeline | from_upload = пользовательское видео';
comment on column project_budget.reels_per_month is 'Лимит Reels в месяц по тарифу (Lite=15, Pro=больше)';
