---
project: LEX AI
type: index
status: active
updated: 2026-06-19
source_of_truth: true
tags:
  - lex-ai
  - home
---

# LEX AI · База знаний

## TL;DR
- LEX AI — Telegram Mini App для Instagram-блогеров: разбор Reels → адаптация → персональный сценарий → план и архив.
- Стек: Next.js (App Router) + TypeScript, Supabase, Vercel, Claude Haiku 4.5, OpenAI Whisper, RapidAPI (Instagram), ЮKassa.
- Auth — через Telegram `initData` (`lib/verifyTelegram.ts`).
- 4 главные вкладки: **Главная / Создать / План / Профиль** (`components/BottomTabBar.tsx`).
- Pivot завершён: IG-only продукт (TG-функции скрыты из UI, но техническая интеграция = канал доставки).
- Монетизация: free (3 разбора/мес) → Pro / Pro+ через ЮKassa, без раннего paywall.
- 341 юзер, 271 проект, 0 платящих — задача активации и конверсии.

## Когда читать этот файл
Точка входа в Vault. Всегда читай первым, после корневого `CLAUDE.md`. Дальше открывай **только** [[01_CONTEXT_ROUTER]] и из него — нужный context pack.

## Как читать Vault
1. `CLAUDE.md` (корень) — правила работы.
2. `00_HOME.md` (этот файл) — обзор.
3. `01_CONTEXT_ROUTER.md` — какие 3-5 заметок читать под конкретный тип задачи.
4. По роутеру — нужные документы и файлы кода.
5. Расширяй контекст только при реальной нехватке.

## Каркас Vault
- `00_HOME.md` — обзор (этот файл).
- `01_CONTEXT_ROUTER.md` — маршрутизатор задач.
- `02_CURRENT_STATE.md` — что реально работает сейчас.
- `03_NEXT_ACTIONS.md` — 5-10 ближайших задач.
- `04_GLOSSARY.md` — термины проекта.
- `10_Product/` — продуктовая логика, монетизация, решения.
- `20_UX_UI/` — карта экранов, дизайн-система, тексты.
- `30_Technical/` — карта репо, архитектура, интеграции, деплой, тех-долг.
- `40_Development/` — backlog, changelog, баги, DoD.
- `50_Marketing/` — позиционирование, ЦА, воронка.
- `60_AI_Workflows/` — протокол Claude Code, context packs, промпты.
- `90_Archive/` — отменённые идеи.

## Связанные документы
- [[01_CONTEXT_ROUTER]]
- [[02_CURRENT_STATE]]
- [[03_NEXT_ACTIONS]]
- [[04_GLOSSARY]]
- [[10_Product/PRODUCT_OVERVIEW]]
- [[30_Technical/REPOSITORY_MAP]]

## Связанные файлы проекта
- `CLAUDE.md`
- `package.json`
- `components/AppFlow.tsx`
- `flow/types.ts`
