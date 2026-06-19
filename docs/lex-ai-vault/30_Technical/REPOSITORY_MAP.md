---
project: LEX AI
type: technical
status: active
updated: 2026-06-19
source_of_truth: true
tags:
  - lex-ai
  - tech
  - repo
---

# Repository Map

## TL;DR
- Стек: Next.js 16 (App Router) + React 19 + TypeScript 5 + Tailwind 3.
- Backend: Next.js API routes + Supabase (Postgres + RLS).
- AI: Anthropic SDK 0.96 (Claude Haiku 4.5), OpenAI SDK 6 (Whisper), RapidAPI (Instagram scraping).
- Платежи: ЮKassa.
- Деплой: Vercel.
- Auth: Telegram `initData`.

## Когда читать этот файл
В начале любой задачи, чтобы найти нужный файл за 30 секунд. Не открывай файлы заранее — используй таблицу ниже.

> [!important]
> Единый источник правды по структуре репо.

## Быстрая карта

| Задача | Файл или папка |
|---|---|
| Изменить онбординг | `components/WelcomeScreen.tsx`, `components/screens/CreateProjectScreen.tsx`, `hooks/useWelcomeGate.ts` |
| Изменить главную | `components/HomeScreen.tsx` |
| Изменить «Создать» | `components/screens/{CreateHubScreen,ToolsScreen}.tsx` |
| Изменить план | `components/screens/PlanScreen.tsx` |
| Изменить страницу проекта | `components/screens/ProjectScreen.tsx` |
| Изменить разбор Reels | `components/ReelDecoderCard.tsx`, `lib/reelDecoder.ts`, `app/api/projects/[id]/reel/decode/route.ts` |
| Изменить сценарий | `components/screens/PersonalScriptScreen.tsx`, `lib/scriptGenerator.ts`, `app/api/projects/[id]/ig/script/*` |
| Изменить карусель | `components/CarouselGeneratorCard.tsx`, `app/api/projects/[id]/lex/carousel/route.ts`, `lib/lexAI.ts` (`writeCarousel`) |
| Изменить подпись | `components/CaptionGeneratorCard.tsx`, `lib/captionGenerator.ts`, `app/api/projects/[id]/ig/caption/route.ts` |
| Изменить контент-пакет | `components/ContentPackCard.tsx`, `lib/contentPack.ts`, `app/api/projects/[id]/ig/pack/route.ts` |
| Изменить адаптацию идей | `components/AdaptedTopicsBlock.tsx`, `lib/topicAdapter.ts`, `app/api/projects/[id]/ig/adapt/route.ts` |
| Изменить Library | `components/ContentLibrary.tsx` |
| Изменить нав-бар | `components/BottomTabBar.tsx` |
| Изменить роутинг экранов | `components/AppFlow.tsx`, `flow/types.ts` |
| Изменить состояние flow | `flow/{types,reducer,FlowProvider}.ts` |
| Изменить тарифы | `lib/tiers.ts` |
| Изменить gating | `lib/gating.ts` |
| Изменить paywall | `components/PaywallSheet.tsx` |
| Изменить биллинг | `components/screens/BillingScreen.tsx`, `lib/yookassa.ts`, `app/api/billing/*` |
| Изменить аналитику | `lib/analytics.ts`, `app/api/analytics/route.ts` |
| Изменить уведомления | `app/api/cron/reminders/route.ts`, `lib/reminderTexts.ts` |
| Изменить тексты ошибок | `components/StateBlock.tsx` + место использования |
| Добавить SQL-миграцию | `supabase/migrations/*.sql` |
| Изменить API клиент | `lib/api.ts` |

## Главные директории

```
app/
  api/
    admin/           — админ-эндпоинты
    agent/           — legacy AI-агенты
    analytics/       — продуктовые события
    billing/         — ЮKassa checkout, webhook, confirm, upgrade
    council/         — legacy совет агентов
    cron/            — крон-джобы (reminders, healthcheck, scheduled publish)
    drafts/          — управление черновиками (PATCH/DELETE)
    health/          — healthcheck
    inbox/           — legacy inbox
    orchestrate/     — legacy оркестратор
    projects/        — проекты (CRUD + вложенные ig/, lex/, reel/, drafts/)
    streak/          — серия дней
    telegram/        — TG webhook, setup
    usage/           — расход
    user/prefs/      — настройки юзера (onboarding-done, frequency)
  layout.tsx, page.tsx, globals.css

components/
  AppFlow.tsx                — главный orchestrator (рендер экранов)
  AppBg.tsx                  — фоновая радиальная подсветка
  BottomTabBar.tsx           — нав-бар на 4 таба
  HomeScreen.tsx             — рабочая главная
  WelcomeScreen.tsx          — онбординг
  StateBlock.tsx             — единый блок пустых/ошибочных состояний
  PaywallSheet.tsx           — paywall bottom-sheet
  Reel*.tsx, Caption*.tsx, Carousel*.tsx, ContentPack*.tsx,
    ContentLibrary.tsx, AdaptedTopicsBlock.tsx — feature-cards
  screens/
    DashboardScreen.tsx      — таб «Профиль»
    ProjectScreen.tsx        — проект с 4 IG-вкладками
    PlanScreen.tsx           — таб «План»
    CreateHubScreen.tsx      — хаб «Создать»
    ToolsScreen.tsx          — табы инструментов
    PersonalScriptScreen.tsx — полный сценарий
    OnboardingSuccessScreen.tsx
    CreateProjectScreen.tsx  — Quick Setup
    AddCompetitorsScreen.tsx
    BillingScreen.tsx
    SettingsScreen.tsx
    LexCreateScreen.tsx      — legacy unified flow

flow/
  types.ts                   — ScreenKey, FlowState, Brief
  reducer.ts                 — flowReducer (pure)
  FlowProvider.tsx           — React Context provider
  useFlow.ts, useFlowActions.ts, selectors.ts, index.ts

hooks/
  useAutoStartAgents.ts      — авто-старт агентов после онбординга (legacy IG/TG)
  useDraftBackup.ts          — резервная копия драфта в localStorage
  useResumeFlow.ts           — восстановление flow при возврате
  useTgBackButton.ts         — Telegram BackButton
  useWelcomeGate.ts          — гейт показа Welcome

lib/
  api.ts                     — клиентский API-слой (все запросы)
  analytics.ts               — продуктовые события (batch upload)
  captionGenerator.ts        — Claude → подписи
  clientCache.ts             — простой LRU-cache для клиента
  contentPack.ts             — Claude → пакет {reel, carousel, caption}
  demoReelDecode.ts          — демо-разбор для пустого архива
  gating.ts                  — quota check
  instagram.ts               — IG helpers
  lexAI.ts                   — основной LEX-агент (legacy + новые writeCarousel/writeReel)
  parseTmePreview.ts         — парсинг превью t.me
  projectBudget.ts           — лимиты расхода Anthropic
  publishScheduler.ts        — отложенная публикация (legacy TG)
  reelDecoder.ts             — RapidAPI + Whisper + Claude pipeline
  reminderTexts.ts           — тексты уведомлений
  reviewActions.ts           — действия в legacy review-экране
  sanitize.ts                — sanitize строк
  scheduling.ts              — расписание публикаций
  scoutSync.ts               — синхронизация скаута конкурентов
  scriptGenerator.ts         — Claude → полный сценарий 20 полей
  supabase.ts                — supabase client
  telegram.ts                — Telegram WebApp helpers + tgFetch
  telegramBot.ts             — bot username, deep links
  tiers.ts                   — тарифы и лимиты
  topicAdapter.ts            — Claude → адаптированные темы
  usage.ts                   — расход
  verifyTelegram.ts          — verifyInitData (HMAC)
  yookassa.ts                — ЮKassa API

supabase/migrations/
  *.sql                      — все миграции, имена осмысленные

public/
  logo.jpg, slide-*.jpg, иконки
```

## Точка входа
- `app/layout.tsx` → `app/page.tsx` → `components/AppFlow.tsx` (`FlowProvider` обёртка снаружи).
- `app/api/*/route.ts` — серверные эндпоинты (Next.js App Router).

## Стек подробнее
- **Next.js 16** (`^16.2.6`) — App Router, серверные routes, не Edge runtime (используется `runtime = "nodejs"` явно).
- **React 19** + **TypeScript 5**.
- **Supabase** (`@supabase/supabase-js@^2.105.4`) — Postgres + RLS, service-role key на сервере.
- **Anthropic SDK** (`^0.96.0`) — Claude Haiku 4.5 (`claude-haiku-4-5-20251001`).
- **OpenAI** (`^6.44.0`) — только Whisper для транскриптов.
- **framer-motion** — page transitions.
- **Tailwind 3** + **PostCSS** — установлены, но компоненты используют inline styles (Tailwind задействован минимально).
- **xlsx**, **googleapis** — legacy для bartender-фичи (Google Drive xlsx).

## Переменные окружения (без значений)
Подтверждены в коде:
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TELEGRAM_BOT_TOKEN`
- `RAPIDAPI_KEY`, `RAPIDAPI_HOST` (Instagram scraping)
- `YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET_KEY` (предположительно — проверить в `lib/yookassa.ts`)

## Где находится логика
- **Анализ Reels:** `lib/reelDecoder.ts` + `app/api/projects/[id]/reel/decode/route.ts`.
- **Онбординг:** `components/WelcomeScreen.tsx` + `hooks/useWelcomeGate.ts` + `app/api/user/prefs/onboarding-done/route.ts`.
- **Профиль (Dashboard):** `components/screens/DashboardScreen.tsx`.
- **Проекты:** `components/screens/ProjectScreen.tsx` + `app/api/projects/route.ts` + `app/api/projects/[id]/route.ts`.
- **Архив разборов:** `components/ReelArchive.tsx` + `GET /api/projects/[id]/reel/decode`.
- **Платёжная логика:** `lib/yookassa.ts` + `app/api/billing/*` + `components/PaywallSheet.tsx`.
- **Стили:** `tailwind.config.ts` + `app/globals.css` + inline style props в компонентах. См. [[20_UX_UI/DESIGN_SYSTEM]].

## Связанные документы
- [[ARCHITECTURE]]
- [[DATA_AND_STATE]]
- [[INTEGRATIONS]]
- [[DEPLOYMENT]]
- [[20_UX_UI/SCREEN_MAP]]

## Связанные файлы проекта
- `package.json`
- `tsconfig.json`
- `next.config.js`
- `tailwind.config.ts`
