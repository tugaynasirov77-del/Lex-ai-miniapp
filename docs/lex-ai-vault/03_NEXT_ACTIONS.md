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

### 2. Подкрутить PlanScreen empty/error states
- **Приоритет:** P1
- **Результат:** план без проекта / без материалов выглядит понятно, есть путь к действию.
- **Связанные документы:** [[10_Product/FEATURES]] (раздел План), [[20_UX_UI/SCREEN_MAP]].
- **Связанные файлы:** `components/screens/PlanScreen.tsx`.
- **DoD:** все 3 пустых состояния используют `StateBlock` с action.

### 3. Сценарий со своей идеей — отдельный вход в Tools
- **Приоритет:** P1
- **Результат:** в ToolsScreen таб «Сценарий» = `ReelScriptGeneratorCard` (есть); проверить, что он работает без проекта-разбора.
- **Связанные документы:** [[10_Product/FEATURES]] (раздел Сценарий).
- **Связанные файлы:** `components/ReelScriptGeneratorCard.tsx`.
- **DoD:** генерация сценария от темы без `decode_id` проходит до сохранения.

### 4. Прогресс-бар ценности в результатах разбора (●○○)
- **Приоритет:** P2
- **Результат:** в `ReelDecoderCard` появляется индикатор «1/3 free».
- **Связанные документы:** [[10_Product/MONETIZATION]].
- **Связанные файлы:** `components/ReelDecoderCard.tsx`.
- **DoD:** показывается только на Free; обновляется после разбора.

### 5. Hard paywall fullscreen вместо текстового 402
- **Приоритет:** P2
- **Результат:** при `quota_exceeded` показывается `PaywallSheet` (уже сделано в Decoder), распространить на все генераторы.
- **Связанные документы:** [[10_Product/MONETIZATION]].
- **Связанные файлы:** `components/{ReelScriptGenerator,CarouselGenerator,CaptionGenerator,ContentPack}Card.tsx`.
- **DoD:** во всех генераторах 402 → `PaywallSheet`, не сухой текст.

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
