---
project: LEX AI
type: technical
status: active
updated: 2026-06-19
tags:
  - lex-ai
  - tech
  - debt
---

# Technical Debt

## TL;DR
- Стилизация: inline CSS-in-JS вместо Tailwind / централизованных токенов.
- Legacy TG-флоу (`LexCreateScreen`, `lexAI.ts` агенты, `useAutoStartAgents`, `scoutSync.ts`) — не удалён, но скрыт из UI.
- `flow/types.ts` содержит legacy ScreenKey, оставленные для совместимости `useResumeFlow`.
- Дублирование цветовых констант (`YELLOW`, `INK`, и т.п.) в каждом компоненте.

## Когда читать этот файл
При рефакторинге, аудите кода, оценке стоимости новой фичи.

## Категории долга

### 1. Дизайн-токены
- **Проблема:** константы цветов/радиусов/отступов дублируются в 20+ компонентах.
- **Решение:** вынести в `lib/theme.ts` (constants), импортировать.
- **Цена откладывания:** при изменении цвета — правка в 20+ местах. См. [[20_UX_UI/DESIGN_SYSTEM]] для текущих значений.
- **Приоритет:** P2.

### 2. Tailwind почти не используется
- **Проблема:** установлен и сконфигурирован, но компоненты на inline style.
- **Решение:** либо удалить Tailwind, либо постепенно мигрировать.
- **Приоритет:** P3 — не блокирует.

### 3. Legacy TG-флоу
- Компоненты: `LexCreateScreen`, `InboxScreen`, `TaskInput`, `TaskHero`, `ReviewCard`, `ResultsList`, `AgentsScroll`, `AgentsGrid`, `HomeHeader`, `QuickActions` — TG-эпохи, скрыты из IG-UI.
- Libs: `lexAI.ts` legacy агенты (writer, councilor, scout), `scoutSync.ts`, `publishScheduler.ts`, `scheduling.ts`.
- API: `app/api/agent/`, `app/api/council/`, `app/api/orchestrate/`, `app/api/inbox/`.
- **Решение:** не удалять до подтверждения, что не вызывается. Часть может всё ещё дёргаться (`cron/morning-digest`).
- **Приоритет:** P3.

### 4. ScreenKey legacy в `flow/types.ts`
- Оставлены: `choose-format`, `project-brief`, `upload`, `generate`, `reel-approve`, `review` — для `useResumeFlow` (если в localStorage старое значение).
- **Решение:** при следующем «major» можно почистить, но `useResumeFlow` придётся обновить.
- **Приоритет:** P3.

### 5. Дублирующиеся компоненты
- `Card` обёртка повторяется в ContentLibrary, ReelArchive, PlanScreen, ProjectScreen.
- `Pill` / `StatusPill` встречается в 5+ местах с разными формулами цвета.
- **Решение:** `components/ui/{Card,Pill,Chip}.tsx`.
- **Приоритет:** P2.

### 6. AppFlow growing
- `components/AppFlow.tsx` — 220+ строк, рендер свич + два больших inline IIFE для `personal-script` и `onboarding-success`.
- **Решение:** вынести IIFE в фабрику `renderScreen(key, state)` или router-map.
- **Приоритет:** P3.

### 7. `lib/api.ts` ~ 900+ строк
- Все DTO + клиентские функции в одном файле.
- **Решение:** разделить по доменам (`api/projects.ts`, `api/drafts.ts`, `api/plan.ts`, `api/billing.ts`, `api/analytics.ts`).
- **Приоритет:** P2.

### 8. Дублирующиеся типы (Tier, Status)
- `Tier` в `lib/tiers.ts` и `lib/api.ts` (`BillingSummary.tier`).
- `ContentStatus` в `lib/api.ts` — но миграция SQL разрешает любые строки (drop constraint).
- **Решение:** канонический enum в `lib/types/` + использование везде.
- **Приоритет:** P3.

### 9. CLAUDE.md (корневой) устарел
- Описывает старый продукт (TG + montage). Реальное состояние — IG-only AI-студия.
- **Решение:** обновить промпт под актуальный продукт **после** того, как Vault стабилизируется. Сейчас Vault — источник правды.
- **Приоритет:** P1.

### 10. Tests
- Нет автоматических тестов (`__tests__/`, `*.test.ts`).
- **Решение:** хотя бы reducer + critical lib functions (gating, tiers).
- **Приоритет:** P2.

### 11. Webhook ЮKassa без идемпотентности
- `app/api/billing/yookassa-webhook/route.ts` — нужно проверить, что повторный webhook не активирует подписку дважды.
- **Приоритет:** P1 (если ещё не сделано).
- **Требует проверки.**

### 12. Поля Quick Setup не полные
- Бриф: 12 полей, реализовано 8. См. [[10_Product/PROJECT_SETUP]].
- Дозалить остальные через `lex_brand_kit` или новые колонки.
- **Приоритет:** P3 — не блокирует ценность.

## Связанные документы
- [[REPOSITORY_MAP]]
- [[ARCHITECTURE]]
- [[40_Development/BACKLOG]]
- [[10_Product/PRODUCT_DECISIONS]]

## Связанные файлы проекта
- `components/AppFlow.tsx`
- `lib/api.ts`
- `lib/lexAI.ts`
- `CLAUDE.md`
