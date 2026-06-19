---
project: LEX AI
type: dev
status: active
updated: 2026-06-19
source_of_truth: true
tags:
  - lex-ai
  - dev
  - backlog
---

# Backlog

## TL;DR
- Полный список задач, разделённых по категориям. Ближайшие 5-10 → [[03_NEXT_ACTIONS]].
- P0/P1 — критично для конверсии и устойчивости; P2/P3 — улучшения.

## Когда читать этот файл
При планировании, decision на «что делать дальше». Активный спринт держи в `03_NEXT_ACTIONS.md`.

> [!important]
> Единый источник правды по неподтверждённому списку задач. Не дублируй в Next Actions.

## Product

- [ ] **Прогресс-бар ценности ●○○ в результатах разбора**
  - Приоритет: P2
  - Статус: planned
  - Причина: показать Free-юзеру «1/3 разборов» для драйвера апсейла без раннего paywall.
  - Связанные документы: [[10_Product/MONETIZATION]]
  - Связанные файлы: `components/ReelDecoderCard.tsx`
  - DoD: индикатор виден только на Free, обновляется после разбора.

- [ ] **Hard paywall fullscreen во всех генераторах**
  - Приоритет: P2
  - Статус: planned
  - Причина: 402 quota сейчас показывается текстом в Caption/Carousel/Script/Pack.
  - Связанные документы: [[10_Product/MONETIZATION]]
  - Связанные файлы: `components/{ReelScriptGenerator,CarouselGenerator,CaptionGenerator,ContentPack}Card.tsx`
  - DoD: 402 → `PaywallSheet`.

- [ ] **Watcher конкурентов (IG)**
  - Приоритет: P3
  - Статус: planned
  - Причина: отслеживание 3-10 IG-аккаунтов с авто-нотификацией о новых Reels.
  - Связанные файлы: backend нужен новый (RapidAPI polling), UI на `ProjectScreen` вкладка Конкуренты.

- [ ] **Daily Hook (ежедневный хук-промпт под нишу)**
  - Приоритет: P3
  - Статус: planned
  - Причина: ежедневная активация — короткий хук-промпт.

- [ ] **My Reels Analytics**
  - Приоритет: P3
  - Статус: planned
  - Причина: юзер вставляет свой Reels → разбор + сравнение с целевыми метриками.

- [ ] **Контент-план на неделю по архиву разборов (Pro)**
  - Приоритет: P3
  - Статус: planned
  - Причина: бенефит Pro-тарифа, заявлен но не реализован.

- [ ] **Социальное доказательство (стрип кейсов)**
  - Приоритет: P3
  - Статус: blocked
  - Причина: нет реальных кейсов/цифр (правило «no fake proof»).

## UX/UI

- [ ] **Welcome + Goal picker экран для активации**
  - Приоритет: P2
  - Статус: planned
  - Причина: спросить главную цель сразу — улучшает первичную ценность.
  - Связанные файлы: `components/WelcomeScreen.tsx`, новая страница.

- [ ] **Унифицировать Card / Pill / Chip компоненты**
  - Приоритет: P2
  - Статус: planned
  - Связанные документы: [[30_Technical/TECHNICAL_DEBT]] (#5)

- [ ] **Дизайн-токены в `lib/theme.ts`**
  - Приоритет: P2
  - Связанные документы: [[30_Technical/TECHNICAL_DEBT]] (#1), [[20_UX_UI/DESIGN_SYSTEM]]

## Frontend

- [ ] **Разделить `lib/api.ts` по доменам**
  - Приоритет: P2
  - Связанные документы: [[30_Technical/TECHNICAL_DEBT]] (#7)

- [ ] **Почистить legacy ScreenKey**
  - Приоритет: P3
  - Связанные файлы: `flow/types.ts`, `hooks/useResumeFlow.ts`
  - Связанные документы: [[30_Technical/TECHNICAL_DEBT]] (#4)

- [ ] **Вынести screen-router из `AppFlow.tsx`**
  - Приоритет: P3
  - Связанные документы: [[30_Technical/TECHNICAL_DEBT]] (#6)

## Backend

- [ ] **Идемпотентность ЮKassa webhook**
  - Приоритет: P1
  - Статус: requires verification
  - Связанные файлы: `app/api/billing/yookassa-webhook/route.ts`
  - Связанные документы: [[30_Technical/TECHNICAL_DEBT]] (#11)

- [ ] **Lite-пакет 390₽ за 10 разборов**
  - Приоритет: P2
  - Связанные файлы: `lib/yookassa.ts`, `components/PaywallSheet.tsx`, `lib/tiers.ts`, новая таблица `reel_decode_credits` (TBD)
  - Связанные документы: [[10_Product/MONETIZATION]]

- [ ] **Quick Setup доп. поля (опыт, ограничения, частота)**
  - Приоритет: P3
  - Связанные документы: [[10_Product/PROJECT_SETUP]]

## AI

- [ ] **Сценарии с генерацией 5 вариаций (бенефит Pro+)**
  - Приоритет: P3
  - Связанные файлы: `lib/scriptGenerator.ts` (новый mode `bulk`).

- [ ] **AI-сводка ниши (бенефит Pro+)**
  - Приоритет: P3
  - Связанные файлы: `lib/lexAI.ts` (новый агент).

## Payments

- [ ] См. Backend (Lite-пакет, idempotency).

## Analytics

- [ ] **Дашборд аналитики для основателя**
  - Приоритет: P3
  - Статус: planned
  - Причина: метрики (конверсия Free→Pro, retention D1/D7, abandoned-после-онбординга).
  - Связанные файлы: `app/api/admin/*`.

## Testing

- [ ] **Unit-тесты для `flow/reducer.ts`, `lib/gating.ts`, `lib/tiers.ts`**
  - Приоритет: P2
  - Связанные документы: [[40_Development/TESTING]]

## Deployment

- [ ] **vercel.json — закрепить cron-расписания, если не сделано**
  - Приоритет: P2
  - Статус: requires verification
  - Связанные документы: [[30_Technical/DEPLOYMENT]]

## Documentation

- [ ] **Обновить корневой `CLAUDE.md` под актуальный продукт**
  - Приоритет: P1
  - Статус: planned (после стабилизации Vault)
  - Связанные документы: [[30_Technical/TECHNICAL_DEBT]] (#9)

- [ ] **Поддерживать Vault — обновлять при каждой значимой задаче**
  - Приоритет: P0 (continuous)
  - Связанные документы: [[60_AI_Workflows/CLAUDE_CODE_PROTOCOL]]

## Связанные документы
- [[03_NEXT_ACTIONS]]
- [[02_CURRENT_STATE]]
- [[30_Technical/TECHNICAL_DEBT]]

## Связанные файлы проекта
- См. указанные в каждой задаче.
