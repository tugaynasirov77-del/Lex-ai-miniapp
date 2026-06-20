---
project: LEX AI
type: plan
status: active
updated: 2026-06-19
source_of_truth: true
tags:
  - lex-ai
  - plan
---

# Ближайшие действия

## TL;DR
- 5-8 конкретных задач на ближайший спринт.
- Команда разделена: пользователь — Создать + План, главный разработчик — Главная + Профиль + инфра.

## Когда читать этот файл
В начале работы — чтобы понять, что в фокусе. Полный список → [[40_Development/BACKLOG]].

> [!important]
> Этот документ — единый источник правды по ближайшему плану. Не дублируй задачи в BACKLOG.

## Текущий спринт

### 1. Проверить флоу «Создать» в проде после PR #14
- **Приоритет:** P0
- **Результат:** все 6 карточек хаба ведут на правильный таб ToolsScreen, генераторы работают.
- **Связанные документы:** [[02_CURRENT_STATE]], [[10_Product/FEATURES]].
- **Связанные файлы:** `components/screens/{CreateHubScreen,ToolsScreen}.tsx`.
- **DoD:** ручная проверка на проде, скриншот в чат разработки.

### 2. Подкрутить PlanScreen empty/error states ✅
- **Приоритет:** P1 — **сделано 2026-06-20**
- **Результат:** все empty/error состояния PlanScreen используют `StateBlock` с action: нет проекта → «Создать проект»; ошибка без плана → «Повторить»; пустая неделя → «Создать контент»; устаревшие данные → compact StateBlock с «Обновить» (была текстовая плашка без действия).
- **Связанные документы:** [[10_Product/FEATURES]] (раздел План), [[20_UX_UI/SCREEN_MAP]].
- **Связанные файлы:** `components/screens/PlanScreen.tsx`.
- **DoD:** ✅ все состояния через `StateBlock` с action.

### 3. Сценарий со своей идеей — отдельный вход в Tools ✅
- **Приоритет:** P1 — **подтверждено 2026-06-20**
- **Результат:** структурно готово. `lexWriteReel(projectId, topic, duration)` не зависит от `decodeId`, эндпоинт `/api/projects/[id]/lex/reel` принимает `{ topic, duration }`, в `ToolsScreen` таб «Сценарий» = `<ReelScriptGeneratorCard projectId={projectId} />`. API возвращает `draftId` — сохранение в проект на бэкенде.
- **Связанные документы:** [[10_Product/FEATURES]] (раздел Сценарий).
- **Связанные файлы:** `components/ReelScriptGeneratorCard.tsx`, `components/screens/ToolsScreen.tsx:129`, `lib/api.ts:861`.
- **DoD:** ✅ нет зависимости от `decode_id` в коде. Финальная проверка в проде — ручная.

### 4. Прогресс-бар ценности в результатах разбора (●○○) ✅
- **Приоритет:** P2 — **сделано 2026-06-20**
- **Результат:** в `ReelDecoderCard` под полем ввода — N жёлтых/серых точек + «used/limit FREE». Только на Free; обновляется из `quota` после каждого разбора.
- **Связанные документы:** [[10_Product/MONETIZATION]].
- **Связанные файлы:** `components/ReelDecoderCard.tsx` (компонент `QuotaDots`).
- **DoD:** ✅ tier-gate `quota.tier === "free"`, заполненные = `used`, обновление через существующий `setQuota`.

### 5. Hard paywall fullscreen вместо текстового 402 ✅
- **Приоритет:** P2 — **сделано 2026-06-20**
- **Результат:** при `quota_exceeded` (HTTP 402) во всех 4 генераторах открывается `PaywallSheet` вместо текстовой ошибки.
- **Связанные документы:** [[10_Product/MONETIZATION]].
- **Связанные файлы:** `components/{ReelScriptGenerator,CarouselGenerator,CaptionGenerator,ContentPack}Card.tsx`.
- **DoD:** ✅ во всех 4 генераторах ветка `e?.status === 402 → setPaywallOpen(true)`, рендер `<PaywallSheet variant="limit_reached" />`.

### 6. Lite-пакет 390₽ за 10 разборов (one-shot)
- **Приоритет:** P2
- **Результат:** в `PaywallSheet` появляется кнопка «10 разборов за 390₽» (one-time через ЮKassa).
- **Связанные документы:** [[10_Product/MONETIZATION]].
- **Связанные файлы:** `lib/yookassa.ts`, `components/PaywallSheet.tsx`, `lib/tiers.ts`, новый endpoint биллинга.
- **DoD:** покупка проходит, начисляется в `subscriptions`/`reel_decode_credits` (схема — уточнить).

### 7. Социальное доказательство в IG-проекте (отложено)
- **Приоритет:** P3
- **Результат:** стрип кейсов.
- **Блокер:** нет реальных кейсов/цифр (зафиксировано в памяти: «no fake proof»).
- **Связанные файлы:** `components/screens/ProjectScreen.tsx`.

## Связанные документы
- [[02_CURRENT_STATE]]
- [[40_Development/BACKLOG]]
- [[10_Product/PRODUCT_DECISIONS]]

## Связанные файлы проекта
- `components/AppFlow.tsx`
