---
project: LEX AI
type: ui
status: active
updated: 2026-06-19
tags:
  - lex-ai
  - ui
  - assets
---

# Assets and References

## TL;DR
- Логотип: `public/logo.jpg` (компонент `LexLogo` inline в нескольких файлах).
- Слайды Home: `public/slide-*.jpg`.
- Шрифты: Inter (Google Fonts через `next/font` или CDN). `@fontsource/dm-sans` подключён в `package.json`, но фактически используется Inter.

## Когда читать этот файл
При работе с медиа-ассетами, иконками, заменой логотипа.

## Логотип
- Файл: `public/logo.jpg`.
- Использование: компонент `LexLogo` (повторяется в `HomeScreen.tsx`, `WelcomeScreen.tsx`, `OnboardingSuccessScreen.tsx`). Не вынесен в отдельный компонент — небольшая копипаста.
- Стиль: квадратное изображение с `border-radius` ~32% от высоты + текст «LEX AI» рядом (LEX белый, AI жёлтый).

## Фоновые изображения
- `public/slide-team.jpg`, `public/slide-reels.jpg`, `public/slide-plan.jpg`, `public/slide-formats.jpg` — старый презентационный BannerCarousel (legacy, см. [[90_Archive/REJECTED_AND_OBSOLETE_IDEAS]]). В новой Home не используются.

## Иконки
SVG inline в компонентах. Нет отдельной библиотеки. Иконки нав-бара: `HomeIcon`, `PlusIcon`, `CalendarIcon`, `UserIcon` в `BottomTabBar.tsx`.

## Эмодзи
Основной визуальный язык карточек и пустых состояний:
- 🎬 — reel / видео.
- 🖼 — карусель.
- ✏️ — подпись.
- 💡 — идея.
- 📝 — пост (legacy).
- 🔍 — разбор / decoder.
- 📦 — пакет.
- ✨ — новое / сценарий.
- 📅 — план.
- 🔌 — ошибка сети.
- ⚠️ — ошибка / риск.
- 🔒 — приватный/недоступный.
- 🗓 — план / неделя.
- 📭 — пусто.
- 🛠 — инструменты.

## Шрифты
- Основной: `'Inter', system-ui, sans-serif` — inline в каждом компоненте.
- `@fontsource/dm-sans` подключён, но фактически не используется в UI Lex AI (предположительно legacy зависимость).

## Внешние референсы
- Дизайн вдохновлён: тёмные финтех-приложения, IG, NotionCalendar (для PlanScreen).
- Палитра: жёлтый акцент против тёмного фона — отсылка к IG-сториз/Reels-нативному визуалу.

## Связанные документы
- [[DESIGN_SYSTEM]]
- [[SCREEN_MAP]]

## Связанные файлы проекта
- `public/`
- `components/WelcomeScreen.tsx` (LexLogo)
- `components/HomeScreen.tsx` (LexLogo)
- `components/OnboardingSuccessScreen.tsx` (LexLogo)
- `components/BottomTabBar.tsx` (нав-иконки)
