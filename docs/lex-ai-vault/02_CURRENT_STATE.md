---
project: LEX AI
type: state
status: active
updated: 2026-06-19
source_of_truth: true
tags:
  - lex-ai
  - state
---

# Текущее состояние

## TL;DR
- 4 вкладки нав-бара работают: Главная / Создать / План / Профиль.
- Welcome → Quick Project Setup (8 полей) → Decoder → AdaptedTopics → PersonalScript → Save → OnboardingSuccess — end-to-end собран.
- ContentLibrary, PlanScreen, ContentPack, PaywallSheet — в проде.
- Метрики: 341 юзер, 271 IG-проект, 0 платящих. Главная цель — конверсия в платёж.
- Свежие фичи: streak за полезные действия, аналитика 27+ событий, уведомления-напоминания, post-publish loop.

## Когда читать этот файл
Каждый раз в начале новой задачи. Здесь — что есть сейчас, что в работе, что критически расходится с продуктовой моделью.

> [!important]
> Этот документ — единый источник правды по текущей реализации. История решений → [[10_Product/PRODUCT_DECISIONS]], план → [[03_NEXT_ACTIONS]].

## Статус по областям

| Область | Статус | Что есть сейчас | Что должно быть (если иначе) | Связанные файлы |
|---|---|---|---|---|
| Welcome onboarding | Готово | 3 слайда + переход в Quick Setup, флаг в `user_prefs.onboarding_completed` + localStorage | — | `components/WelcomeScreen.tsx`, `hooks/useWelcomeGate.ts` |
| Quick Project Setup | Готово | 8 полей (название, ниша, аудитория, цель, стиль, on_camera, what_sells, язык) | — | `components/screens/CreateProjectScreen.tsx` |
| Нижняя навигация | Готово | 4 таба, активный — жёлтый | — | `components/BottomTabBar.tsx` |
| Главная (Home) | Готово | Greeting + ввод ссылки + быстрые actions + прогресс недели + последние материалы | Чужая зона главного разработчика | `components/HomeScreen.tsx` |
| «Создать» (хаб) | Готово | 6 карточек → `ToolsScreen` с табами на каждый инструмент | — | `components/screens/CreateHubScreen.tsx`, `ToolsScreen.tsx` |
| План | Готово | Недельный план с переключателем недель, прогресс, статусы, action-sheet | — | `components/screens/PlanScreen.tsx` |
| Профиль (Dashboard) | Готово | Список проектов, billing pill, streak | — | `components/screens/DashboardScreen.tsx` |
| Reel Decoder | Готово | Ввод ссылки → RapidAPI/Whisper/Claude → разбор + AdaptedTopicsBlock | — | `components/ReelDecoderCard.tsx`, `lib/reelDecoder.ts`, `app/api/projects/[id]/reel/decode/route.ts` |
| Адаптация под нишу | Готово | 3 темы + «У меня есть своя идея» (refine) | — | `components/AdaptedTopicsBlock.tsx`, `lib/topicAdapter.ts`, `app/api/projects/[id]/ig/adapt/route.ts` |
| Personal Script | Готово | 20 полей сценария, AI-actions (6 действий) на 5 блоках, save/план/copy | — | `components/screens/PersonalScriptScreen.tsx`, `lib/scriptGenerator.ts`, `app/api/projects/[id]/ig/script/*` |
| Reel Script с нуля | Готово | Тема → сценарий без референса | — | `components/ReelScriptGeneratorCard.tsx`, `lib/lexAI.ts` |
| Carousel Generator | Готово | Тема → 6 слайдов + caption + hashtags | — | `components/CarouselGeneratorCard.tsx`, `app/api/projects/[id]/lex/carousel/route.ts` |
| Caption Generator | Готово | 5 стилей подписей + 15 хэштегов | — | `components/CaptionGeneratorCard.tsx`, `lib/captionGenerator.ts`, `app/api/projects/[id]/ig/caption/route.ts` |
| Контент-пакет | Готово | 1 идея → Reel-сценарий + карусель + подпись с общим `content_pack_id` | — | `components/ContentPackCard.tsx`, `lib/contentPack.ts`, `app/api/projects/[id]/ig/pack/route.ts` |
| Архив разборов | Готово | Список разборов проекта с раскрытием + демо-карточка | — | `components/ReelArchive.tsx` |
| Content Library | Готово | Все материалы проекта с фильтрами по типу/статусу | — | `components/ContentLibrary.tsx` |
| Onboarding Success | Готово | Лого + анимированный чек + переход на главную после 1-го сценария | — | `components/screens/OnboardingSuccessScreen.tsx` |
| Paywall | Готово | Bottom-sheet, открывается на `value_moment` / `limit_reached`, без таймеров | — | `components/PaywallSheet.tsx` |
| Биллинг (ЮKassa) | Готово | Monthly/yearly toggle, FAQ, checkout | — | `components/screens/BillingScreen.tsx`, `lib/yookassa.ts`, `app/api/billing/*` |
| Tiers / gating | Готово | Free 3/мес, Pro 30/мес 490₽, Pro+ 100/мес 1490₽; admin whitelist | — | `lib/tiers.ts`, `lib/gating.ts` |
| Streak | Готово | По полезным действиям (analytics events ∪ content_drafts) | — | `app/api/streak/route.ts` |
| Analytics events | Готово | 27+ событий, батч-аплоад | — | `lib/analytics.ts`, `app/api/analytics/route.ts` |
| Уведомления (cron) | Готово | Reminders по плану, утренний дайджест | — | `app/api/cron/reminders/route.ts`, `lib/reminderTexts.ts` |
| StateBlock (unified) | Готово | Единый блок empty/error везде | — | `components/StateBlock.tsx` |

## Главный пользовательский сценарий (сейчас)
1. Новый юзер → Welcome (3 слайда) → Quick Setup (8 полей) → проект создан.
2. Сразу попадает в «Обзор» проекта с CTA «Открыть инструменты».
3. В Tools / Decoder вставляет Reels → разбор готов → выбирает 1 из 3 адаптированных тем.
4. Personal Script (генерация + редактирование 20 полей + AI-actions).
5. Save → OnboardingSuccess (если первый раз) → главная / проект.
6. План недели наполняется через «Добавить в план» из сценария.
7. Возврат: Home показывает прогресс + последние материалы + ввод ссылки.

## Критические расхождения (код vs утверждённая модель)
- **Корневой `CLAUDE.md`** описывает старый продукт (TG + montage pipeline, MVP за 2 недели). Реальное состояние: IG-only AI-студия. → При работе опирайся на этот Vault, не на старый `CLAUDE.md`-промпт.
- **Поля Quick Setup** в коде совпадают с утверждённой моделью, но не все из брифа: «уровень опыта», «ограничения», «частота публикаций» — **не реализованы**. См. [[10_Product/PROJECT_SETUP]].
- **«Своя идея»** есть, но как `refineUserIdea` в контексте разбора (см. `AdaptedTopicsBlock`). Отдельной самостоятельной вкладки «Своя идея с нуля» нет — `ReelScriptGeneratorCard` принимает тему. → [[10_Product/FEATURES]].
- **PersonalScreenScreen** запускается только из адаптации (требует `topic`). «С нуля» собирается через `ReelScriptGeneratorCard` — это сознательное продуктовое решение.
- **Полный сценарий** (раздел 7.7 брифа): все элементы реализованы кроме явного блока «Референсы» в UI (storyboard есть, ссылка на исходный Reels хранится в `source_decode_id`).

## Что может сломаться
- Без миграции `welcome_onboarding.sql` POST `/api/user/prefs/onboarding-done` возвращает 500 — но welcome закроется через localStorage.
- ContentLibrary `status=all` отдаёт всё кроме `rejected` — если бэкенд изменит дефолт, фильтры на клиенте могут не покрыть.
- ЮKassa в `PaywallSheet` открывается через `Telegram.WebApp.openLink` — вне TG откроет `window.open`.

## Ближайшая продуктовая цель
Конверсия 0 → первые платящие. Драйверы: paywall на value-moment, контент-пакет как upsell, streak / план / уведомления удерживают активных.

## Связанные документы
- [[00_HOME]]
- [[03_NEXT_ACTIONS]]
- [[10_Product/PRODUCT_DECISIONS]]
- [[10_Product/FEATURES]]
- [[30_Technical/REPOSITORY_MAP]]

## Связанные файлы проекта
- `components/AppFlow.tsx`
- `flow/types.ts`
- `lib/tiers.ts`
- `lib/gating.ts`
