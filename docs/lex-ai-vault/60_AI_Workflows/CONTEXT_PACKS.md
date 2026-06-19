---
project: LEX AI
type: workflow
status: active
updated: 2026-06-19
tags:
  - lex-ai
  - workflow
  - context
---

# Context Packs

## TL;DR
- Готовые наборы документов и файлов для частых задач.
- Полная таблица типов задач → [[01_CONTEXT_ROUTER]].

## Когда читать этот файл
Когда тип задачи попадает на один из перечисленных пакетов — копируй список и работай по нему.

## Packs

### Pack: ONBOARDING
**Когда:** правки Welcome, Quick Setup, OnboardingSuccess, гейта показа.
**Vault:**
- [[00_HOME]]
- [[02_CURRENT_STATE]]
- [[10_Product/ONBOARDING]]
- [[10_Product/USER_JOURNEY]]

**Код (читать только при необходимости):**
- `components/WelcomeScreen.tsx`
- `components/screens/CreateProjectScreen.tsx`
- `components/screens/OnboardingSuccessScreen.tsx`
- `hooks/useWelcomeGate.ts`
- `app/api/user/prefs/onboarding-done/route.ts`
- `supabase/migrations/welcome_onboarding.sql`

### Pack: REELS_ANALYSIS
**Когда:** правки Decoder, парсинг IG, ошибки, анализ.
**Vault:**
- [[00_HOME]]
- [[10_Product/FEATURES]]
- [[30_Technical/ARCHITECTURE]]
- [[30_Technical/INTEGRATIONS]]

**Код:**
- `components/ReelDecoderCard.tsx`
- `lib/reelDecoder.ts`
- `app/api/projects/[id]/reel/decode/route.ts`
- `lib/topicAdapter.ts`
- `components/AdaptedTopicsBlock.tsx`

### Pack: PERSONAL_SCRIPT
**Когда:** правки сценария Reels, AI-actions, save/план.
**Vault:**
- [[00_HOME]]
- [[10_Product/FEATURES]] (раздел Personal Script)

**Код:**
- `components/screens/PersonalScriptScreen.tsx`
- `lib/scriptGenerator.ts`
- `app/api/projects/[id]/ig/script/route.ts`
- `app/api/projects/[id]/ig/script/refine/route.ts`

### Pack: MONETIZATION
**Когда:** правки тарифов, paywall, квот, биллинга.
**Vault:**
- [[00_HOME]]
- [[10_Product/MONETIZATION]]
- [[50_Marketing/PRODUCT_FUNNEL]]

**Код:**
- `lib/tiers.ts`
- `lib/gating.ts`
- `components/PaywallSheet.tsx`
- `components/screens/BillingScreen.tsx`
- `lib/yookassa.ts`
- `app/api/billing/*`

### Pack: CREATE_TAB
**Когда:** правки хаба «Создать», ToolsScreen.
**Vault:**
- [[00_HOME]]
- [[10_Product/FEATURES]] (разделы инструментов)
- [[20_UX_UI/SCREEN_MAP]]

**Код:**
- `components/screens/CreateHubScreen.tsx`
- `components/screens/ToolsScreen.tsx`
- `components/{ReelDecoderCard,ReelScriptGeneratorCard,CarouselGeneratorCard,CaptionGeneratorCard,ContentPackCard}.tsx`

### Pack: PLAN_TAB
**Когда:** правки PlanScreen, action-sheet, статусов.
**Vault:**
- [[00_HOME]]
- [[10_Product/FEATURES]] (раздел Plan)
- [[20_UX_UI/SCREEN_MAP]]

**Код:**
- `components/screens/PlanScreen.tsx`
- `lib/api.ts` (раздел plan)
- `app/api/projects/[id]/plan/route.ts` (если есть)

### Pack: NEW_SCREEN
**Когда:** новый экран в нав-баре или роутинге.
**Vault:**
- [[00_HOME]]
- [[20_UX_UI/SCREEN_MAP]]
- [[20_UX_UI/DESIGN_SYSTEM]]
- Тематическая feature-note из [[10_Product/FEATURES]]

**Код:**
- `flow/types.ts` (новый ScreenKey)
- `components/AppFlow.tsx` (роутинг)
- `components/BottomTabBar.tsx` (если в нав-баре)

### Pack: UI_BUG
**Когда:** баг с визуалом, отступами, цветами.
**Vault:**
- [[00_HOME]]
- [[20_UX_UI/DESIGN_SYSTEM]]
- [[20_UX_UI/SCREEN_MAP]]
- [[40_Development/BUGS]]

**Код:**
- Конкретный компонент по REPOSITORY_MAP.

### Pack: API_WORK
**Когда:** новый endpoint, изменение существующего.
**Vault:**
- [[00_HOME]]
- [[30_Technical/ARCHITECTURE]]
- [[30_Technical/INTEGRATIONS]]
- [[30_Technical/DATA_AND_STATE]]

**Код:**
- `app/api/.../route.ts`
- `lib/verifyTelegram.ts`
- `lib/gating.ts`
- Соответствующий `lib/<domain>.ts`

### Pack: DEPLOY
**Когда:** деплой, отладка проды, миграция env.
**Vault:**
- [[00_HOME]]
- [[30_Technical/DEPLOYMENT]]
- [[30_Technical/REPOSITORY_MAP]]

**Код:**
- `vercel.json` (если есть)
- `next.config.js`
- `package.json`

### Pack: COPY_EDIT
**Когда:** правка текстов UI.
**Vault:**
- [[00_HOME]]
- [[20_UX_UI/UX_COPY]]
- Тематическая feature-note

**Код:**
- Файл по REPOSITORY_MAP.

## Связанные документы
- [[01_CONTEXT_ROUTER]]
- [[CLAUDE_CODE_PROTOCOL]]
- [[PROMPT_LIBRARY]]

## Связанные файлы проекта
- См. в каждом pack.
