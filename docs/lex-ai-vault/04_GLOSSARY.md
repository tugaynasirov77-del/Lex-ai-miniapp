---
project: LEX AI
type: glossary
status: active
updated: 2026-06-19
tags:
  - lex-ai
  - glossary
---

# Глоссарий

## TL;DR
- Термины проекта в одном месте, чтобы в новой сессии не выводить заново.

## Когда читать этот файл
Когда встретил незнакомый термин в коде или документации.

## Термины

| Термин | Значение |
|---|---|
| **Decoder** | `ReelDecoderCard` + `lib/reelDecoder.ts` + `/api/projects/[id]/reel/decode`. Разбор Reels: RapidAPI → Whisper → Claude. |
| **AdaptedTopics** | 3 темы под нишу, сгенерированные из разбора. Источник: `lib/topicAdapter.ts`. |
| **Personal Script** | Полный сценарий Reels (20 полей) из выбранной адаптированной темы. Источник: `lib/scriptGenerator.ts`. |
| **Content Pack** | Набор {Reel + Carousel + Caption} с общим `content_pack_id`, сгенерированный из одной идеи. Источник: `lib/contentPack.ts`. |
| **Quick Project Setup** | Онбординг-форма из 8 полей (название, ниша, аудитория, цель, стиль, on_camera, what_sells, язык). |
| **Welcome Gate** | Гейт показа `WelcomeScreen`: `localStorage` + `user_prefs.onboarding_completed` + наличие проектов. См. `hooks/useWelcomeGate.ts`. |
| **Flow State** | Глобальный state навигации/контекста. `flow/types.ts`, `flow/reducer.ts`, `FlowProvider`. |
| **ScreenKey** | Идентификатор экрана в `flow/types.ts`. Все рендерятся в `components/AppFlow.tsx`. |
| **screenMeta** | Произвольный per-screen контекст внутри FlowState. Пример: `toolTab`, `scriptTopic`, `projectInitialTab`. |
| **ToolId** | `decoder` / `script` / `carousel` / `caption` / `pack` — вкладки `ToolsScreen`. |
| **StateBlock** | Универсальный блок empty/error состояний. `components/StateBlock.tsx`. |
| **Gate / Quota** | Проверка лимитов тарифа перед action. `lib/gating.ts`, `lib/tiers.ts`. |
| **Tier** | `free` / `pro` / `business` (`Pro+` в UI). См. `lib/tiers.ts`. |
| **Paywall** | `PaywallSheet` — bottom-sheet с тарифами, открывается на value-moment или limit. |
| **Streak** | Серия дней с полезным действием. Источник: `app/api/streak/route.ts`. |
| **analytics_events** | Таблица продуктовых событий. Клиент: `lib/analytics.ts`. |
| **project_usage** | Таблица расходов AI-генераций по `agent_role`. |
| **lex_brand_kit** | jsonb в `projects`: расширенный контекст бренда (помимо колонок niche/audience). |
| **lex_insights** | jsonb с анализом ниши от агентов (legacy, остался для конкурентов). |
| **reel_decodes** | Таблица разборов Reels. |
| **content_drafts** | Все материалы проекта: post / carousel / reel / caption / idea. |
| **content_pack_id** | UUID объединения нескольких `content_drafts` в один пакет. |
| **scenario_data** | jsonb-поле в `content_drafts` для `ReelScenarioData` (20 полей). |
| **planned_for_date** | Дата плана публикации (`YYYY-MM-DD`) в `content_drafts`. |
| **initData** | Подписанные данные Telegram-юзера, проверяемые в `lib/verifyTelegram.ts`. |
| **tgFetch** | `lib/telegram.ts` — обёртка над fetch, добавляющая `x-telegram-init-data`. |
| **Mini App** | Telegram WebView, в котором живёт приложение. |

## Связанные документы
- [[00_HOME]]
- [[30_Technical/REPOSITORY_MAP]]
- [[30_Technical/ARCHITECTURE]]

## Связанные файлы проекта
- `flow/types.ts`
- `lib/api.ts`
- `lib/tiers.ts`
