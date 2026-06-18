-- Флаг прохождения welcome-онбординга новыми юзерами.
-- Выполнить в Supabase Studio → SQL Editor.

alter table user_prefs
  add column if not exists onboarding_completed boolean not null default false;
