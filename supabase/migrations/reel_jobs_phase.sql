-- Фазы обработки Reel-job для UI-прогресса
alter table reel_jobs
  add column if not exists phase text;
comment on column reel_jobs.phase is 'download | extract_audio | transcribe | caption | render | upload | done';
