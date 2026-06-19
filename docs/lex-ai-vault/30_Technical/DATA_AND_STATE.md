---
project: LEX AI
type: technical
status: active
updated: 2026-06-19
source_of_truth: true
tags:
  - lex-ai
  - tech
  - data
---

# Data and State

## TL;DR
- БД: Supabase Postgres. Все миграции — `supabase/migrations/*.sql`.
- Клиентский state: `FlowProvider` (Context + reducer) + `localStorage` persist.
- Server cache: нет (stateless API routes). На клиенте — `lib/clientCache.ts` для проектов/биллинга/streak.
- Source of truth по типам: `lib/api.ts` (DTO) + `lib/tiers.ts`.

## Когда читать этот файл
При работе с БД, типами, расширением Quick Setup, изменением структуры content_drafts и т.п.

> [!important]
> Единый источник правды по схеме БД и client state.

## Таблицы Supabase

### `projects`
Основная сущность. Колонки:
- `id` uuid PK
- `tg_id` bigint — Telegram user ID, owner check
- `title`, `platform` (`instagram` / `telegram`), `status`, `progress`, `agents` jsonb
- `channel_username`, `channel_title`, `channel_subscribers` — legacy TG
- `instagram_username`, `instagram_followers` — IG
- Quick Setup (миграция `content_plan_and_scenarios.sql`):
  - `niche`, `audience`, `content_goal`, `content_style`, `on_camera` (`yes`/`sometimes`/`no`), `what_sells`, `content_language` (default `'ru'`)
- `lex_brand_kit` jsonb — расширенный бренд-контекст
- `lex_insights` jsonb — анализ ниши агентами
- `lex_week_plan` jsonb — кешированный план
- `created_at`, `updated_at`

### `content_drafts`
Все материалы проекта. Колонки:
- `id` uuid PK, `project_id` uuid FK
- `platform` (`instagram` / `telegram`)
- `content_type` (`post` / `carousel` / `reel` / `idea` / `caption`)
- `status` — расширенный набор: `idea`, `draft`, `scenario_ready`, `ready_to_shoot`, `shot`, `ready_to_publish`, `scheduled`, `published`, `archived` + legacy `pending`, `approved`, `rejected`
- `title`, `body`, `caption`, `chosen_title`, `media_urls` jsonb, `cost_usd`
- `source_decode_id` uuid FK → `reel_decodes.id`
- `source_topic` text — выбранная адаптированная тема
- `scenario_data` jsonb — полный сценарий (20 полей)
- `planned_for_date` date — план публикации
- `idea_text` text
- `content_pack_id` uuid — группировка пакета
- `ig_post_url`, `published_metrics` jsonb
- `lex_carousel` jsonb (структура карусели)
- `lex_reel` jsonb (legacy reel-сценарий)
- `published_externally` boolean, `published_message_id`, `error`
- `scheduled_at`, `decided_at`, `created_at`, `updated_at`

Индексы:
- `content_drafts_plan_idx (project_id, planned_for_date)` где `planned_for_date is not null`.
- `content_drafts_source_decode_idx (source_decode_id)`.
- `content_drafts_pack_idx (content_pack_id)`.

### `reel_decodes`
Разборы Reels.
- `id`, `tg_id`, `project_id`, `shortcode`, `url`
- `metadata` jsonb (author, counts, duration)
- `transcript` text
- `analysis` jsonb (`ReelAnalysisDTO`)
- `cost_usd`, `created_at`

### `subscriptions`
Подписки.
- `id`, `tg_id`, `plan` (`free`/`pro`/`business`), `status` (`active`/`canceled`/`expired`), `expires_at`, `payment_id`, `created_at`

### `user_prefs`
Настройки юзера.
- `tg_id` PK
- `reminder_frequency` (`off`/`daily`/`smart`)
- `last_reminder_sent_at`, `last_reminder_trigger`
- `onboarding_completed` boolean default false
- `onboarding_completed_at` timestamptz

### `analytics_events`
- `id`, `tg_id`, `event` text, `props` jsonb, `created_at`

### `project_usage`
- `id`, `project_id`, `agent_role` text, `cost_usd` numeric, `model` text, `created_at`

### Прочие (legacy / служебные)
- `health_log`, `health_state` — мониторинг
- `weekly_plans` — legacy кеш плана
- `scout_*` — конкуренты (legacy IG/TG)
- `review_log` — legacy review

## Типы (TypeScript)

### Источник: `lib/api.ts`
- `ProjectDTO`, `ContentDraftDTO`, `ReelDecodeDTO`, `ReelAnalysisDTO`, `ReelScenarioData`, `StoryboardScene`, `AdaptedTopicDTO`, `ContentStatus`, `ContentType`, `WeekPlanDTO`, `PlanItemDTO`, `BillingSummary`, `StreakDTO`, `CaptionGenResultDTO`, `ContentPackDTO`.

### Источник: `lib/tiers.ts`
- `Tier` = `"free" | "pro" | "business"`
- `TierConfig` (limits, maxProjects, monthlyCapUsd, features).
- `LimitSpec` = `{ count, period: "week" | "month" }`.

### Источник: `flow/types.ts`
- `ScreenKey`, `FlowState`, `FlowAction`, `Brief`, `Tone`, `Platform`, `Audience`, `Goal`, `Period`.

### Источник: `lib/analytics.ts`
- `AnalyticsEvent` union из 27+ имён.

## Client state (frontend)

### FlowProvider
- Источник: `flow/FlowProvider.tsx`.
- Контекст: `state`, `dispatch`.
- Хуки: `useFlow`, `useFlowActions` (typed actions).
- Reducer чистый, тестируется без React.

### localStorage keys
- `lex.flow.v1` — persist `FlowState` (`useResumeFlow`).
- `lex_onboarding_completed` — флаг прохождения welcome.
- `lex_first_script_done` — флаг показа OnboardingSuccess.
- `lex_demo_decode_dismissed` — скрыта ли демо-карточка в архиве.
- `lex_decode_hint_dismissed` — скрыт ли hint «Как взять ссылку».
- `lex_prefill_reel_url` — pre-fill для Decoder (используется при переходе с Home).
- `lex.tip.project.v1` — first-time tip на ProjectScreen.
- `lex.updateBanner.v1.dismissed` — закрыт ли update-banner для существующих юзеров.

### Client cache (`lib/clientCache.ts`)
- Простой in-memory кеш с TTL.
- Ключи: `projects`, `billing`, `streak`.
- Хелперы: `peekProjects()`, `peekBilling()`, `peekStreak()`, `bustClientCache(key?)`.

## Миграции
Применяются вручную в Supabase Studio. Ключевые:
- `content_plan_and_scenarios.sql` — Quick Setup поля, scenario_data, planned_for_date, content_pack_id, onboarding_completed.
- `welcome_onboarding.sql` — flag `user_prefs.onboarding_completed` (дубль из content_plan_and_scenarios).
- `instagram_skeleton.sql` — IG-таблицы.
- `ig_strategy.sql`, `niche_strategy.sql` — стратегические jsonb-поля.
- `reel_jobs.sql` — legacy reel-сценарии очередью.
- `billing.sql` — `subscriptions`.

## Связанные документы
- [[REPOSITORY_MAP]]
- [[ARCHITECTURE]]
- [[INTEGRATIONS]]

## Связанные файлы проекта
- `lib/api.ts`
- `lib/tiers.ts`
- `flow/types.ts`
- `supabase/migrations/*.sql`
- `hooks/useResumeFlow.ts`
- `lib/clientCache.ts`
