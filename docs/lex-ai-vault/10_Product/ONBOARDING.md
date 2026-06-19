---
project: LEX AI
type: product
status: active
updated: 2026-06-19
source_of_truth: true
tags:
  - lex-ai
  - product
  - onboarding
---

# Onboarding

## TL;DR
- Одноразовый: 3 экрана Welcome → Quick Setup → проект готов.
- После первого сохранённого сценария — `OnboardingSuccessScreen`.
- Гейт показа: `localStorage` + `user_prefs.onboarding_completed` + наличие проектов.
- Существующие 341 юзер отсекаются по наличию проектов (welcome им не показывается).

## Когда читать этот файл
При работе с welcome / Quick Setup / OnboardingSuccess. Краткое описание есть в [[USER_JOURNEY]], но детали — здесь.

> [!important]
> Единый источник правды по логике онбординга.

## Состояния пользователя
1. **Новый юзер:** нет проектов, `localStorage['lex_onboarding_completed']` = null, `user_prefs.onboarding_completed` = false. → видит Welcome.
2. **Не завершил онбординг:** Welcome → закрыл приложение. → При возврате снова Welcome (если все три условия гейта валидны).
3. **Завершил Welcome, не создал проект:** localStorage уже выставлен → Welcome не повторится, но и проекта нет → Home показывает «Создайте первый проект».
4. **Создал проект, не сделал первый сценарий:** в `ProjectScreen` обзор с CTA «Открыть инструменты».
5. **Первый сценарий сохранён:** `OnboardingSuccessScreen` → возврат в проект. Дальше Success больше не показывается (`localStorage['lex_first_script_done']`).

## Welcome: 3 слайда
1. Hero: «Преврати любой Reels в готовый сценарий для своего блога».
2-4. Слайды: «LEX разбирает структуру» / «адаптирует под нишу» / «создаёт сценарий».
5. Final: «Начать работу» → `create-project`.

Доп. путь: hero-кнопка «Создать сценарий без референса» → тоже `create-project`.

## Quick Project Setup: 8 полей
| Поле | Тип | Колонка БД | Значения |
|---|---|---|---|
| Название проекта | text | `projects.title` | строка, ≥ 2 симв |
| Тема / ниша блога | text | `projects.niche` | строка, ≥ 2 симв |
| Целевая аудитория | text | `projects.audience` | строка, ≥ 2 симв |
| Главная цель контента | chips | `projects.content_goal` | Охваты / Продажи / Экспертность / Личный бренд / Вовлечение |
| Стиль подачи | chips | `projects.content_style` | Экспертный / Разговорный / Дерзкий / Спокойный / Юмористический / Вдохновляющий |
| Готовы сниматься лицом | chips | `projects.on_camera` | `yes` / `sometimes` / `no` |
| Что продаёте | text (optional) | `projects.what_sells` | строка |
| Язык контента | chips | `projects.content_language` | `ru` (default) / `en` / `other` |

См. [[PROJECT_SETUP]] для разницы между утверждённой моделью и реализацией.

## API онбординга
- `GET /api/user/prefs/onboarding-done` → `{ onboarding_completed: boolean }`.
- `POST /api/user/prefs/onboarding-done` → upsert `user_prefs.onboarding_completed=true`.
- На клиенте параллельно ставится `localStorage['lex_onboarding_completed']`. Если сервер недоступен — UX не блокируется.

## OnboardingSuccess (после первого сценария)
- Триггер: `onSaved(draftId)` в `PersonalScriptScreen` + `localStorage['lex_first_script_done']` ещё не выставлен.
- UI: лого, анимированный жёлтый чек, заголовок «Ваш первый контент готов», pill «Сценарий … сохранён в проекте …», CTA «Перейти на главную».
- Следующий раз: `localStorage['lex_first_script_done']` = '1' → success не показывается, юзер возвращается в проект.

## Возврат без потери данных
- Flow state хранится в `localStorage['lex.flow.v1']` (см. `hooks/useResumeFlow.ts`).
- `useResumeFlow` при mount подгружает `currentScreen`, `format`, `brief`, `projectId`, `draftId` и навигирует. Legacy-экраны (`generate`, `upload`, и т.п.) сбрасываются на `dashboard`.

## Связанные документы
- [[USER_JOURNEY]]
- [[PROJECT_SETUP]]
- [[PRODUCT_DECISIONS]] (DEC-001, DEC-002)
- [[02_CURRENT_STATE]]

## Связанные файлы проекта
- `components/WelcomeScreen.tsx`
- `components/screens/CreateProjectScreen.tsx`
- `components/screens/OnboardingSuccessScreen.tsx`
- `hooks/useWelcomeGate.ts`
- `hooks/useResumeFlow.ts`
- `app/api/user/prefs/onboarding-done/route.ts`
- `supabase/migrations/welcome_onboarding.sql`
- `supabase/migrations/content_plan_and_scenarios.sql`
