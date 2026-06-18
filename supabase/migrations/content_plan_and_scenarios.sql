-- Миграция для нового продуктового flow (Reels → Сценарий → План):
-- 1. content_drafts: новые поля для сценариев Reels и плана
-- 2. user_prefs: флаг onboarding_completed
-- 3. Снятие старого check на status (нужны новые статусы из брифа)

-- ── 1. content_drafts: расширение для сценариев и плана ──

-- Снимаем старый check status (был 'pending'|'approved'|'rejected'),
-- теперь нужны новые статусы: idea / draft / scenario_ready / ready_to_shoot /
-- shot / ready_to_publish / scheduled / published / archived.
-- Существующие 'pending'/'approved'/'rejected' маппим в новые на уровне приложения;
-- здесь просто разрешаем любые text-значения.
alter table content_drafts drop constraint if exists content_drafts_status_check;

alter table content_drafts
  -- ссылка на исходный разбор Reels, из которого создан сценарий
  add column if not exists source_decode_id uuid references reel_decodes(id) on delete set null,
  -- какая из 3 адаптированных тем была выбрана (если генерировалось через flow)
  add column if not exists source_topic text,
  -- полный объект сценария (20+ полей: hook, текст озвучки, раскадровка, риски и т.д.)
  add column if not exists scenario_data jsonb,
  -- запланированная дата публикации (для контент-плана)
  add column if not exists planned_for_date date,
  -- текст идеи (для черновых идей без полного сценария)
  add column if not exists idea_text text,
  -- группировка материалов в контент-пакет (один пакет = много форматов)
  add column if not exists content_pack_id uuid,
  -- ссылка на опубликованный пост в IG (если published)
  add column if not exists ig_post_url text,
  -- ручные метрики после публикации (views, likes, comments)
  add column if not exists published_metrics jsonb;

-- Индекс для быстрого получения недельного плана по проекту
create index if not exists content_drafts_plan_idx
  on content_drafts(project_id, planned_for_date)
  where planned_for_date is not null;

-- Индекс для архива разборов: что снято на основе какого разбора
create index if not exists content_drafts_source_decode_idx
  on content_drafts(source_decode_id)
  where source_decode_id is not null;

-- Индекс для контент-пакетов
create index if not exists content_drafts_pack_idx
  on content_drafts(content_pack_id)
  where content_pack_id is not null;

-- ── 2. user_prefs: флаг прохождения онбординга ──

-- Таблица создана в другой миграции (используется в cron/reminders).
-- Просто добавляем нужные поля.
alter table user_prefs
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists onboarding_completed_at timestamptz;

-- ── 3. projects: расширение настроек проекта (Quick Setup из брифа) ──

-- Эти поля сохраняются на шаге 1 онбординга. Они дублируют lex_brand_kit jsonb,
-- но даны отдельными колонками для быстрого фильтра и читаемости.
alter table projects
  add column if not exists niche text,
  add column if not exists audience text,
  add column if not exists content_goal text,            -- охваты/продажи/экспертность/бренд/вовлечение
  add column if not exists content_style text,           -- экспертный/разговорный/дерзкий/спокойный/юмор/вдохновляющий
  add column if not exists on_camera text,               -- yes/sometimes/no
  add column if not exists what_sells text,
  add column if not exists content_language text default 'ru';

-- ── 4. Безопасность: RLS для service_role (соответствует существующим policies) ──

alter table content_drafts enable row level security;
drop policy if exists "service_role_all" on content_drafts;
create policy "service_role_all" on content_drafts for all using (true) with check (true);

-- ── Комментарии к колонкам для будущих разработчиков ──

comment on column content_drafts.source_decode_id is
  'ID разбора Reels из reel_decodes — если сценарий создан на основе чужого Reels';
comment on column content_drafts.source_topic is
  'Выбранная адаптированная тема (одна из 3) — название/идея Reels';
comment on column content_drafts.scenario_data is
  'Полный объект сценария: hook, voice_over, storyboard, risks, alt_hooks, alt_cta и т.д.';
comment on column content_drafts.planned_for_date is
  'Дата на которую материал запланирован в контент-плане';
comment on column content_drafts.content_pack_id is
  'Группировка: один контент-пакет = Reels + Carousel + Caption + Stories на одну идею';

-- ── Готово ──
-- Существующие данные не затрагиваются. Новые поля nullable / с default'ами.
-- Снят старый check на status — теперь статусы расширяются на уровне приложения.
