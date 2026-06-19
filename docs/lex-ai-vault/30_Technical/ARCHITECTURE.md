---
project: LEX AI
type: technical
status: active
updated: 2026-06-19
source_of_truth: true
tags:
  - lex-ai
  - tech
  - architecture
---

# Architecture

## TL;DR
- Next.js App Router монолит: frontend (Mini App SPA через `AppFlow`) + serverless API routes на одном проекте.
- State client-side: `FlowProvider` (Context + reducer) + `localStorage` persist через `useResumeFlow`.
- Server-side: API routes → Supabase (Postgres) + Anthropic/OpenAI/RapidAPI/ЮKassa.
- Auth: каждый POST/GET проверяет `verifyInitData(x-telegram-init-data)`.

## Когда читать этот файл
При работе с API, новой фичей, рефакторингом архитектурных решений.

> [!important]
> Единый источник правды по архитектуре.

## Слои

```
┌────────────────────────────────────────────────┐
│ Telegram Mini App WebView                      │
│  ┌──────────────────────────────────────────┐  │
│  │ Next.js page (app/page.tsx → AppFlow)    │  │
│  │   FlowProvider (Context + reducer)       │  │
│  │     screens (по state.currentScreen)     │  │
│  │     localStorage persist (useResumeFlow) │  │
│  └──────────────────────────────────────────┘  │
└────────────────────────────────────────────────┘
        │ tgFetch (добавляет x-telegram-init-data)
        ▼
┌────────────────────────────────────────────────┐
│ Next.js API routes (runtime=nodejs, Vercel)    │
│   verifyInitData (HMAC по TELEGRAM_BOT_TOKEN)  │
│   enforceQuota / checkQuota                    │
│   business logic (lib/*)                       │
└────────────────────────────────────────────────┘
        │
        ├──► Supabase (Postgres)
        │       projects, content_drafts, reel_decodes,
        │       subscriptions, user_prefs, analytics_events,
        │       project_usage, health_log
        │
        ├──► Anthropic (Claude Haiku 4.5)
        │       сценарии, адаптации, подписи, пакеты
        │
        ├──► OpenAI Whisper
        │       транскрипты Reels-аудио
        │
        ├──► RapidAPI (Instagram)
        │       метаданные + видео-URL Reels
        │
        └──► ЮKassa
                checkout, webhook подтверждения
```

## Flow state (клиент)

Источник правды — `flow/`:
- `FlowState`: `currentScreen`, `history[]`, `format`, `brief`, `projectId`, `draftId`, `reelJobId`, `weeklyPlanId`, `screenMeta`.
- `flowReducer` — pure, exhaustive switch по `FlowAction`.
- `FlowProvider` — Context, обёрнут вокруг `AppFlow`.
- Selectors / actions: `useFlow`, `useFlowActions`.
- Persist: `useResumeFlow` (load on mount + debounced save 300ms). Хранится в `localStorage['lex.flow.v1']`.

## Server-side patterns

### Авторизация
```ts
const v = verifyInitData(req.headers.get("x-telegram-init-data"));
if (!v.ok || !v.user) return Response.json({ error: "unauthorized" }, { status: 401 });
const tgId = v.user.id;
```

### Owner-check проекта
```ts
const { data } = await sb
  .from("projects")
  .select("id, tg_id, niche, audience, …")
  .eq("id", projectId)
  .eq("tg_id", tgId)
  .maybeSingle();
if (!data) return Response.json({ error: "project not found" }, { status: 404 });
```

### Quota
```ts
const gate = await checkQuota({ tgId, action: "reel_decode" });
if (!gate.ok) return Response.json({ error: gate.reason, code: "quota_exceeded", … }, { status: 402 });
```

### AI generation
```ts
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const r = await client.messages.create({
  model: "claude-haiku-4-5-20251001",
  max_tokens: ...,
  messages: [{ role: "user", content: prompt }],
});
```

### Расход
После генерации:
```ts
await sb.from("project_usage").insert({
  project_id, agent_role: "content_pack", cost_usd: 0.06, model: "claude-haiku-4-5-20251001",
});
```

## Decoder pipeline (детально)
`lib/reelDecoder.ts`:
1. Парсинг shortcode из URL.
2. Проверка кэша по shortcode → если есть, возвращаем.
3. RapidAPI → `{ video_url, metadata }`.
4. Скачивание видео (≤24 МБ).
5. OpenAI Whisper → транскрипт с таймкодами.
6. Claude Haiku → structured analysis (JSON).
7. Сохранение в `reel_decodes`.

Затраты: RapidAPI per-call + Whisper per-min + Claude per-1k tokens. Расход в `project_usage` `agent_role='reel_decoder'`.

## Адаптация под нишу
`lib/topicAdapter.ts`:
- `adaptTopics`: разбор + проектный контекст → 3 темы.
- `refineUserIdea`: разбор + пользовательская идея → усиленная версия.
- Расход: `agent_role='topic_adapt'` / `topic_refine`.

## Personal Script
`lib/scriptGenerator.ts`:
- `generateScript`: тема + (опц.) разбор + проектный контекст → 20 полей.
- `refineScriptBlock`: блок + действие (6 шт.) → переписанный фрагмент.
- Расход: `script_generator` 0.03 / `script_refine` 0.005.

## Content Pack
`lib/contentPack.ts`:
- Один комбинированный промпт → JSON `{ reel, carousel, caption }`.
- Сохраняет 3 строки в `content_drafts` с общим `content_pack_id`.
- Расход: `content_pack` 0.06.

## Notification cron
`app/api/cron/reminders/route.ts`:
- Запускается каждый час.
- Для каждого юзера определяет приоритетный триггер: `draft_unfinished > streak_kept/broken > after_publish > inactive_2d`.
- Отправляет через Telegram Bot API (`TELEGRAM_BOT_TOKEN`).
- Обновляет `user_prefs.last_reminder_sent_at`.

## Аналитика
`lib/analytics.ts` (клиент):
- Очередь в памяти + батч-аплоад раз в 3 сек или при 10 событиях.
- Flush на `visibilitychange=hidden`.
`app/api/analytics/route.ts` (сервер):
- Принимает батч `{ events: [...] }`.
- Whitelist 27+ событий; неизвестные → `other:slug`.
- Запись в `analytics_events`.

## Связанные документы
- [[REPOSITORY_MAP]]
- [[DATA_AND_STATE]]
- [[INTEGRATIONS]]
- [[10_Product/FEATURES]]

## Связанные файлы проекта
- `components/AppFlow.tsx`
- `flow/{types,reducer,FlowProvider}.ts`
- `lib/{api,verifyTelegram,gating,reelDecoder,scriptGenerator,contentPack,analytics}.ts`
- `app/api/projects/[id]/{reel/decode,ig/script,ig/pack,ig/adapt}/route.ts`
