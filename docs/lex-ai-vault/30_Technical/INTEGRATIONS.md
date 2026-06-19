---
project: LEX AI
type: technical
status: active
updated: 2026-06-19
source_of_truth: true
tags:
  - lex-ai
  - tech
  - integrations
---

# Integrations

## TL;DR
- 6 внешних сервисов: Anthropic, OpenAI, Supabase, RapidAPI (IG), ЮKassa, Telegram Bot API.
- Все ключи через `process.env`; на сервере service-role.

## Когда читать этот файл
При работе с внешним API, новой интеграцией, debug ошибок 5xx.

> [!important]
> Единый источник правды по внешним зависимостям.

## Anthropic (Claude)
- **Модель:** `claude-haiku-4-5-20251001` (везде).
- **SDK:** `@anthropic-ai/sdk@^0.96.0`.
- **Env:** `ANTHROPIC_API_KEY`.
- **Использование:**
  - `lib/reelDecoder.ts` — структурированный анализ Reels.
  - `lib/topicAdapter.ts` — 3 темы / усиление идеи.
  - `lib/scriptGenerator.ts` — полный сценарий + refine блоков.
  - `lib/captionGenerator.ts` — 5 подписей + хэштеги.
  - `lib/contentPack.ts` — связанный пакет.
  - `lib/lexAI.ts` — `writeCarousel`, `writeReel`, legacy агенты.
- **Бюджет:** `lib/projectBudget.ts` — soft-cap `monthlyCapUsd` на проект (free 0.4, pro 12, business 40).

## OpenAI Whisper
- **SDK:** `openai@^6.44.0`.
- **Env:** `OPENAI_API_KEY`.
- **Использование:** только транскрипция аудио из Reels (`lib/reelDecoder.ts`). Видео ≤ 24 МБ (Whisper limit 25).

## Supabase
- **SDK:** `@supabase/supabase-js@^2.105.4`.
- **Env:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (service role!).
- **Клиент:** `lib/supabase.ts` (`getSupabase()`).
- **RLS:** включён на новых таблицах с политикой `service_role_all` (using `true` with check `true`). Auth на уровне API через `tg_id` owner-check.

## RapidAPI (Instagram)
- **Env:** `RAPIDAPI_KEY`, `RAPIDAPI_HOST`.
- **Использование:** `lib/reelDecoder.ts` → метаданные Reels по shortcode + URL `.mp4` для скачивания.
- **Ошибки:**
  - Static post (не видео) → «Это статичный пост, а не Reels».
  - Private/недоступный → «Не удалось получить видео. Проверь что Reels публичный».
  - HTTP 4xx/5xx от RapidAPI → проброс через `RapidAPI ${status}: ${body}`.

## ЮKassa
- **Lib:** `lib/yookassa.ts`.
- **Env:** `YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET_KEY` (предположительно).
- **API routes:**
  - `POST /api/billing/yookassa-checkout` → создаёт платёж, возвращает `confirmation_url`.
  - `POST /api/billing/yookassa-webhook` → подтверждение от ЮKassa, активирует подписку.
  - `POST /api/billing/confirm` → клиентское подтверждение.
- **Открытие:** через `Telegram.WebApp.openLink` (в TG) или `window.open` fallback.
- **Что НЕ используется:** Apple/Google IAP, Telegram Stars (в `tiers.ts` есть поле `priceStars` как запасной канал, но в UI не активно).

## Telegram Bot API
- **Lib:** `lib/telegram.ts`, `lib/telegramBot.ts`.
- **Env:** `TELEGRAM_BOT_TOKEN`.
- **Использование:**
  - Auth: `verifyInitData` (HMAC через bot token).
  - Уведомления: `app/api/cron/reminders/route.ts` → `sendMessage`.
  - Webhook: `app/api/telegram/webhook/route.ts` (для legacy команд бота).
- **Bot username:** `LEX_BOT_USERNAME` в `lib/telegramBot.ts`.

## Google APIs (legacy / bartender)
- **Libs:** `googleapis@^173.0.0`, `google-auth-library@^10.7.0`.
- **Использование:** только в legacy bartender-фиче (Google Drive xlsx parsing). Не используется в основном LEX AI flow.

## xlsx
- **Lib:** `xlsx@^0.18.5`.
- **Использование:** legacy bartender (parsing xlsx-файлов из Drive). В LEX AI flow не используется.

## Связанные документы
- [[ARCHITECTURE]]
- [[DATA_AND_STATE]]
- [[DEPLOYMENT]]
- [[10_Product/MONETIZATION]]

## Связанные файлы проекта
- `lib/{reelDecoder,topicAdapter,scriptGenerator,captionGenerator,contentPack,lexAI,yookassa,telegram,verifyTelegram,supabase}.ts`
- `app/api/billing/{yookassa-checkout,yookassa-webhook,confirm}/route.ts`
- `app/api/telegram/{webhook,setup-webhook}/route.ts`
- `app/api/cron/reminders/route.ts`
