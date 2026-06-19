---
project: LEX AI
type: ui
status: active
updated: 2026-06-19
source_of_truth: true
tags:
  - lex-ai
  - ui
  - screens
---

# Screen Map

## TL;DR
- 14 экранов, рендерятся в `components/AppFlow.tsx` по `state.currentScreen` (`ScreenKey` из `flow/types.ts`).
- Нав-бар на 4 таба: Главная / Создать / План / Профиль.

## Когда читать этот файл
При работе с навигацией, новым экраном, рефакторингом UI.

> [!important]
> Единый источник правды по карте экранов.

## ScreenKey enum
Из `flow/types.ts`:
- `home`, `welcome`, `dashboard`, `create-project`, `add-competitors`, `project`, `billing`, `choose-format`, `project-brief`, `upload`, `generate`, `reel-approve`, `review`, `lex-create`, `settings`, `personal-script`, `onboarding-success`, `plan`, `create-hub`, `tools`.

Legacy (`choose-format`, `project-brief`, `upload`, `generate`, `reel-approve`, `review`) удалены из UI, но остались в типе для совместимости с `useResumeFlow`.

## Активные экраны

| ScreenKey | Компонент | Вкладка нав-бара | Назначение |
|---|---|---|---|
| `home` | `components/HomeScreen.tsx` | Главная | Рабочий дашборд: greeting + ввод ссылки + прогресс + последние материалы. |
| `welcome` | `components/WelcomeScreen.tsx` | — (нав-бар скрыт) | Одноразовый онбординг для новых юзеров. |
| `create-hub` | `components/screens/CreateHubScreen.tsx` | Создать | Хаб 6 карточек инструментов. |
| `tools` | `components/screens/ToolsScreen.tsx` | Создать | Экран инструментов с табами (Decoder/Script/Carousel/Caption/Pack). |
| `plan` | `components/screens/PlanScreen.tsx` | План | Недельный контент-план с прогрессом и action-sheet. |
| `dashboard` | `components/screens/DashboardScreen.tsx` | Профиль | Список проектов, billing pill, streak. |
| `project` | `components/screens/ProjectScreen.tsx` | Создать (если из хаба) | Проект на 4 вкладки: Обзор / Контент / Разборы / Настройки. |
| `create-project` | `components/screens/CreateProjectScreen.tsx` | — | Quick Project Setup (8 полей). |
| `add-competitors` | `components/screens/AddCompetitorsScreen.tsx` | — | Добавление IG-конкурентов (вход через настройки проекта). |
| `personal-script` | `components/screens/PersonalScriptScreen.tsx` | — | Полный сценарий Reels (20 полей + AI-actions). |
| `onboarding-success` | `components/screens/OnboardingSuccessScreen.tsx` | — | Финальный экран после первого сценария. |
| `billing` | `components/screens/BillingScreen.tsx` | Профиль | Тарифы, monthly/yearly, FAQ, checkout. |
| `settings` | `components/screens/SettingsScreen.tsx` | Профиль | Глобальные настройки (уведомления, тариф, выход). |
| `lex-create` | `components/screens/LexCreateScreen.tsx` | — | Legacy unified create flow (старая ветка post/carousel/reel). |

## BottomTabBar маппинг
Активный таб определяется по `currentScreen`:
- `home` → Главная.
- `create-hub` / `tools` / `project` → Создать.
- `plan` → План.
- Остальное → Профиль (включая `dashboard`, `billing`, `settings`, `create-project`, `add-competitors`).

`welcome` — нав-бар скрыт.

## Иерархия (типичные переходы)
```
welcome → create-project → project (вкладка "Обзор") → tools (decoder) →
  → personal-script → onboarding-success → project (или home)

home → tools (decoder/script/…) → personal-script → save → project
plan → action-sheet → project (опционально открыть материал)
dashboard → project (тап на проект) или billing
```

## Внутренние вкладки экранов
- `ProjectScreen` (IG-ветка): Обзор / Контент / Разборы / Настройки.
- `ToolsScreen`: Decoder / Сценарий / Карусель / Подпись / Пакет.

## Возврат (back)
- `useTgBackButton` подписан на Telegram BackButton, активен на всех экранах кроме `home` и `welcome`.
- История стека лимитирована 20 шагами в `flow/reducer.ts`.

## Связанные документы
- [[DESIGN_SYSTEM]]
- [[UX_COPY]]
- [[02_CURRENT_STATE]]

## Связанные файлы проекта
- `components/AppFlow.tsx`
- `components/BottomTabBar.tsx`
- `flow/types.ts`
- `flow/reducer.ts`
