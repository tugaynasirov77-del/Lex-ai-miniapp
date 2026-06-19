---
project: LEX AI
type: dev
status: active
updated: 2026-06-19
tags:
  - lex-ai
  - dev
  - bugs
---

# Bugs

## TL;DR
- Подтверждённых открытых багов на 2026-06-19 нет.
- Подозреваемые места — ниже (требуют проверки).

## Когда читать этот файл
При баге, регрессии, debug. Сначала смотри открытые, потом подозреваемые.

## Открытые
_(пусто)_

## Подозреваемые / требуют проверки

### B-001 — ЮKassa webhook без идемпотентности
- **Файл:** `app/api/billing/yookassa-webhook/route.ts`
- **Подозрение:** повторный webhook от ЮKassa может активировать подписку дважды.
- **Что проверить:** есть ли проверка `payment_id` против `subscriptions` перед insert.
- **Связано:** [[30_Technical/TECHNICAL_DEBT]] (#11), [[40_Development/BACKLOG]].

### B-002 — Decoder fallback при больших Reels
- **Файл:** `lib/reelDecoder.ts`
- **Подозрение:** видео > 24 МБ — `Whisper не примет`, выдаст ошибку. Что показывается юзеру?
- **Что проверить:** error mapping в `humanizeDecodeError` ловит этот кейс?
- **Связано:** `components/ReelDecoderCard.tsx`.

### B-003 — `lex.flow.v1` persist при смене юзера
- **Файл:** `hooks/useResumeFlow.ts`
- **Подозрение:** если на одном устройстве два TG-юзера (теоретически), state сохранится между ними.
- **Реальный сценарий:** маловероятен в Mini App.
- **Что проверить:** очищается ли `localStorage` при logout/смене юзера.

### B-004 — `content_drafts.status` без CHECK constraint
- **Файл:** SQL миграция `content_plan_and_scenarios.sql` (drop constraint в начале).
- **Подозрение:** опечатка в `status` пройдёт в БД без ошибки.
- **Мitigation:** валидация на уровне приложения (см. `app/api/projects/[id]/drafts/route.ts`).
- **Что проверить:** все POST/PATCH валидируют `status` против известного списка.

## Закрытые

### B-FIXED-001 — Streak за вход
- **Дата фикса:** 2026-06-19
- **Проблема:** `app/api/streak/route.ts` считал день активным по `content_drafts.created_at`, что близко, но не корректно отражает «полезные действия».
- **Решение:** объединение полезных событий аналитики (`script_saved`, `script_added_to_plan`, `content_status_changed`, `content_marked_published`, `project_created`) + `content_drafts` (≠ rejected, created_at + updated_at). `app_opened` намеренно не учитывается.
- **Связано:** [[10_Product/PRODUCT_DECISIONS]] DEC-014.

### B-FIXED-002 — Хаб «Создать» вёл на свалку генераторов
- **Дата фикса:** 2026-06-19
- **Проблема:** 4 из 5 кнопок хаба скроллили к одной длинной колонке генераторов на «Обзоре» проекта.
- **Решение:** новый `ToolsScreen` с табами; с «Обзора» генераторы убраны.
- **Связано:** [[10_Product/PRODUCT_DECISIONS]] DEC-013.

### B-FIXED-003 — DashboardScreen звал «Подключите канал»
- **Дата фикса:** 2026-06-19
- **Проблема:** legacy TG-копи в пустом состоянии профиля.
- **Решение:** заменено на «Создайте первый проект» + IG-формулировку.

## Связанные документы
- [[02_CURRENT_STATE]]
- [[30_Technical/TECHNICAL_DEBT]]
- [[40_Development/BACKLOG]]

## Связанные файлы проекта
- См. файлы в каждом баге.
