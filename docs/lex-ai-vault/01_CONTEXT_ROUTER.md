---
project: LEX AI
type: router
status: active
updated: 2026-06-19
source_of_truth: true
tags:
  - lex-ai
  - router
---

# Context Router

## TL;DR
- Маршрутизатор: тип задачи → 3-5 заметок Vault + связанные файлы кода.
- Под каждую задачу читай только нужный context pack, не более.
- При нехватке информации — расширяй контекст явно и кратко объясни почему.

## Когда читать этот файл
Сразу после `00_HOME.md` в начале любой задачи. Дальше открывай только перечисленные документы.

> [!important]
> Этот документ является единым источником правды по маршрутизации контекста.

## Таблица маршрутизации

| Тип задачи | Какие заметки читать | Что не читать без необходимости |
|---|---|---|
| Онбординг | HOME, CURRENT_STATE, [[10_Product/ONBOARDING]], [[10_Product/USER_JOURNEY]] | Весь технический раздел |
| Анализ Reels | HOME, [[10_Product/FEATURES]], [[50_Marketing/PRODUCT_FUNNEL]], [[30_Technical/ARCHITECTURE]] | Дизайн-систему целиком |
| Монетизация | HOME, [[10_Product/MONETIZATION]], [[50_Marketing/PRODUCT_FUNNEL]] | Все компоненты интерфейса |
| Новый экран | HOME, [[20_UX_UI/SCREEN_MAP]], [[20_UX_UI/DESIGN_SYSTEM]], нужная feature-note | Весь продуктовый архив |
| Исправление UI | HOME, [[20_UX_UI/DESIGN_SYSTEM]], [[20_UX_UI/SCREEN_MAP]], конкретный компонент | Монетизацию и маркетинг |
| Баг | HOME, CURRENT_STATE, [[40_Development/BUGS]], [[30_Technical/REPOSITORY_MAP]] | Все продуктовые заметки |
| Работа с API | HOME, [[30_Technical/ARCHITECTURE]], [[30_Technical/INTEGRATIONS]], [[30_Technical/DATA_AND_STATE]] | Все UX-тексты |
| Деплой | HOME, [[30_Technical/DEPLOYMENT]], [[30_Technical/REPOSITORY_MAP]] | Онбординг и маркетинг |
| Новая функция | HOME, [[10_Product/FEATURES]], [[10_Product/USER_JOURNEY]], [[30_Technical/ARCHITECTURE]] | Архив без причины |
| Тексты интерфейса | HOME, [[20_UX_UI/UX_COPY]], нужная продуктовая заметка | Технический долг |
| Маркетинг | HOME, [[50_Marketing/POSITIONING]], [[50_Marketing/TARGET_AUDIENCE]], [[50_Marketing/PRODUCT_FUNNEL]] | Код приложения |
| Рефакторинг | HOME, [[30_Technical/ARCHITECTURE]], [[30_Technical/REPOSITORY_MAP]], [[30_Technical/TECHNICAL_DEBT]] | Маркетинговые документы |
| План контента / неделя | HOME, [[10_Product/FEATURES]] (раздел План), [[20_UX_UI/SCREEN_MAP]] | Биллинг, paywall |
| Создание сценария | HOME, [[10_Product/FEATURES]] (раздел Сценарий), [[30_Technical/INTEGRATIONS]] | Архив, маркетинг |
| Контент-пакет | HOME, [[10_Product/FEATURES]] (раздел Пакет) | Все остальные packs |

## Context Packs

### Pack: ONBOARDING
- [[00_HOME]]
- [[02_CURRENT_STATE]]
- [[10_Product/ONBOARDING]]
- [[10_Product/USER_JOURNEY]]
- Файлы: `components/WelcomeScreen.tsx`, `components/screens/CreateProjectScreen.tsx`, `hooks/useWelcomeGate.ts`, `app/api/user/prefs/onboarding-done/route.ts`.

### Pack: REELS_ANALYSIS
- [[00_HOME]]
- [[10_Product/FEATURES]]
- [[30_Technical/ARCHITECTURE]]
- [[30_Technical/INTEGRATIONS]]
- Файлы: `components/ReelDecoderCard.tsx`, `lib/reelDecoder.ts`, `app/api/projects/[id]/reel/decode/route.ts`, `lib/topicAdapter.ts`.

### Pack: MONETIZATION
- [[00_HOME]]
- [[10_Product/MONETIZATION]]
- [[50_Marketing/PRODUCT_FUNNEL]]
- Файлы: `lib/tiers.ts`, `lib/gating.ts`, `components/PaywallSheet.tsx`, `lib/yookassa.ts`, `app/api/billing/*`.

### Pack: CREATE_TAB
- [[00_HOME]]
- [[10_Product/FEATURES]] (раздел Создать)
- [[20_UX_UI/SCREEN_MAP]]
- Файлы: `components/screens/CreateHubScreen.tsx`, `components/screens/ToolsScreen.tsx`, `components/{ReelDecoderCard,ReelScriptGeneratorCard,CarouselGeneratorCard,CaptionGeneratorCard,ContentPackCard}.tsx`.

### Pack: PLAN_TAB
- [[00_HOME]]
- [[10_Product/FEATURES]] (раздел План)
- [[20_UX_UI/SCREEN_MAP]]
- Файлы: `components/screens/PlanScreen.tsx`, `app/api/projects/[id]/plan/route.ts` (если есть), `lib/api.ts` (раздел plan).

### Pack: DEPLOY
- [[00_HOME]]
- [[30_Technical/DEPLOYMENT]]
- [[30_Technical/REPOSITORY_MAP]]
- Файлы: `vercel.json` (если есть), `next.config.js`, `.env.local` (только переменные, без значений).

## Связанные документы
- [[00_HOME]]
- [[60_AI_Workflows/CLAUDE_CODE_PROTOCOL]]
- [[60_AI_Workflows/CONTEXT_PACKS]]

## Связанные файлы проекта
- `CLAUDE.md`
