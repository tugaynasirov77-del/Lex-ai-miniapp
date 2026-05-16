-- Расписание публикаций и фото к постам

-- 1. Время публикации по умолчанию на проект (для постов из плана)
alter table projects
  add column if not exists publish_time text not null default '10:00',
  add column if not exists publish_timezone text not null default 'Europe/Moscow';

-- 2. content_drafts: расписание, фото, флаг неудачи публикации
alter table content_drafts
  add column if not exists scheduled_at timestamptz,
  add column if not exists publish_attempts int not null default 0,
  add column if not exists publish_error text,
  add column if not exists photo_url text,
  add column if not exists photo_storage_path text;

create index if not exists content_drafts_scheduled_idx
  on content_drafts(scheduled_at)
  where status = 'approved' and published_message_id is null and scheduled_at is not null;

-- 3. plan_items могут хранить format (text/poll/quiz) — но т.к. items это jsonb,
--    схема не меняется, поле опциональное на уровне приложения

-- 4. Storage bucket для фото постов
insert into storage.buckets (id, name, public)
values ('post-photos', 'post-photos', true)
on conflict (id) do nothing;

drop policy if exists "service_role_all_post_photos" on storage.objects;
create policy "service_role_all_post_photos" on storage.objects
  for all using (bucket_id = 'post-photos') with check (bucket_id = 'post-photos');
