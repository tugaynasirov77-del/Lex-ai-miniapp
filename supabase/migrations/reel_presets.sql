-- Пресеты стиля Reel: expert_clean | personal_brand_energy | ai_tech_fast
alter table reel_jobs
  add column if not exists preset text not null default 'expert_clean';
comment on column reel_jobs.preset is 'expert_clean | personal_brand_energy | ai_tech_fast';
