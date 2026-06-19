---
project: LEX AI
type: technical
status: active
updated: 2026-06-19
source_of_truth: true
tags:
  - lex-ai
  - tech
  - deploy
---

# Deployment

## TL;DR
- Хост: Vercel, автодеплой из ветки `main` (push в main → деплой за ~1-2 мин).
- Build: `next build` (Node runtime, не Edge).
- Все Anthropic/Whisper/RapidAPI вызовы под Vercel `maxDuration` (см. ниже).
- Git: GitHub `tugaynasirov77-del/Lex-ai-miniapp`.

## Когда читать этот файл
При деплое, отладке проды, добавлении cron, конфигурации env.

> [!important]
> Единый источник правды по деплою.

## Git
- **Remote:** `https://github.com/tugaynasirov77-del/Lex-ai-miniapp.git`.
- **Main branch:** `main`.
- **Workflow:** `git checkout main && git pull` → `git checkout -b feature/X` → код → `git push` → `gh pr create --fill` → ревью / self-merge → автодеплой Vercel.
- **Email коммитов:** для Vercel требуется коммитить под учётной записью, привязанной к проекту (раньше использовался `yangaev16@gmail.com` для Ba-Zi; для LEX AI — `tugaynasirov.77@gmail.com` или `antonvologdin2180@gmail.com` в зависимости от автора).

## Vercel
- **Type:** Production = main branch.
- **Build command:** `next build` (default).
- **Install command:** `npm install` (default).
- **Output:** `.next`.
- **Runtime:** Node 20+ (Vercel default).
- **Env vars:** в Vercel Dashboard (раздел Project Settings → Environment Variables). См. список ниже.
- **Логи:** Vercel Functions tab + Live Tail.

## Env vars (production)
| Имя | Назначение | Где используется |
|---|---|---|
| `ANTHROPIC_API_KEY` | Claude Haiku | все AI-генераторы |
| `OPENAI_API_KEY` | Whisper | `lib/reelDecoder.ts` |
| `SUPABASE_URL` | Supabase REST URL | `lib/supabase.ts` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role | `lib/supabase.ts` (server only!) |
| `TELEGRAM_BOT_TOKEN` | Bot API + HMAC | `verifyInitData`, отправка уведомлений |
| `RAPIDAPI_KEY` | IG scraping | `lib/reelDecoder.ts` |
| `RAPIDAPI_HOST` | IG scraping host | `lib/reelDecoder.ts` |
| `YOOKASSA_SHOP_ID` | ЮKassa shop id | `lib/yookassa.ts` |
| `YOOKASSA_SECRET_KEY` | ЮKassa secret | `lib/yookassa.ts` |

⚠️ Никаких значений в Vault. Только имена.

## maxDuration (Vercel function timeouts)
В route handlers, требующих > 10 сек:
```ts
export const maxDuration = 60; // секунд
```
Используется в: `decode`, `ig/script`, `ig/script/refine`, `ig/adapt`, `ig/caption`, `ig/pack`, `lex/carousel`.

## Cron jobs (Vercel или UptimeRobot)
- `app/api/cron/reminders/route.ts` — ежечасно. Уведомления.
- `app/api/cron/healthcheck/route.ts` — мониторинг сервисов.
- `app/api/cron/tick/route.ts` — общий tick.
- `app/api/cron/morning-digest/route.ts`, `user-morning-digest/route.ts` — дайджест.
- `app/api/cron/publish-scheduled/route.ts`, `ig-publish-scheduled/route.ts` — отложенная публикация.
- `app/api/cron/cleanup-raw-uploads/route.ts` — очистка raw-uploads.

Расписания задаются:
- Через Vercel Cron (`vercel.json` — проверить наличие).
- Альтернативно — UptimeRobot bumping URL раз в N минут (есть в истории как fallback).

## Telegram webhook
- Endpoint: `https://<vercel-app>.vercel.app/api/telegram/webhook`.
- Setup: `app/api/telegram/setup-webhook/route.ts` (POST).
- Mini App: настройка через `@BotFather` → `Bot Settings` → `Menu Button` → URL приложения.

## Миграции БД
- Применяются вручную через Supabase Studio → SQL Editor.
- Файлы: `supabase/migrations/*.sql`.
- Перед мержем PR с новой миграцией — применить её в Supabase.

## Локальная разработка
- `npm install`
- `npm run dev` → `http://localhost:3000`.
- `.env.local` с теми же ключами.
- Mini App без `initData` работает частично (auth не пройдёт, UI-скелеты видно).

## Откат
- Vercel Dashboard → Deployments → нужный деплой → Promote to Production.
- Git revert: `git revert <merge-sha>` → push в main → новый деплой.

## Связанные документы
- [[REPOSITORY_MAP]]
- [[INTEGRATIONS]]
- [[40_Development/CHANGELOG]]

## Связанные файлы проекта
- `next.config.js`
- `vercel.json` (если есть)
- `package.json`
- `app/api/cron/*/route.ts`
- `app/api/telegram/setup-webhook/route.ts`
