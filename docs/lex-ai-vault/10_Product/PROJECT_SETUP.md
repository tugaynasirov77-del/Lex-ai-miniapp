---
project: LEX AI
type: product
status: active
updated: 2026-06-19
source_of_truth: true
tags:
  - lex-ai
  - product
  - setup
---

# Project Setup (расширенный)

## TL;DR
- В коде сейчас 8 полей Quick Setup (см. [[ONBOARDING]]).
- Утверждённая продуктовая модель шире — 12 полей. Разница ниже.
- Дополнительные поля можно хранить в `lex_brand_kit` jsonb (уже используется агентами) без миграции схемы.

## Когда читать этот файл
Перед расширением Quick Setup или работой с `projects.*` колонками.

## Реализовано (8 полей)
| Поле | Колонка | Тип |
|---|---|---|
| Название | `title` | text |
| Ниша | `niche` | text |
| Аудитория | `audience` | text |
| Главная цель | `content_goal` | chips |
| Стиль подачи | `content_style` | chips |
| Готовы сниматься лицом | `on_camera` | chips (yes/sometimes/no) |
| Что продаёте | `what_sells` | text optional |
| Язык контента | `content_language` | chips (ru/en/other) |

## Утверждённая продуктовая модель (12 полей)
Дополнительно к реализованным:
- **Формат контента** (видео / карусель / текст / смешанное).
- **Площадки публикации** (Instagram / другие). → Сейчас фиксирован Instagram после IG-only pivot.
- **Уровень опыта** (новичок / средний / эксперт). **Не реализовано.**
- **Ограничения** (нельзя показывать лицо / тематика NSFW / нельзя промо алкоголя и т.п.). **Не реализовано.**
- **Желаемая частота публикаций** (3/нед / 5/нед / ежедневно). **Не реализовано.**

## Расхождения и почему
- **Площадка** не спрашивается, потому что pivot завершён → всегда Instagram.
- **Формат контента** косвенно покрывается `on_camera` + `content_style`, но явного поля нет.
- Остальные 3 поля не реализованы — добавить в Quick Setup или в Settings проекта позже. Сейчас их нет в Roadmap.

## Где хранить дополнительные данные
Если расширять без миграции — `projects.lex_brand_kit` jsonb (уже используется `lib/lexAI.ts` → `getBrandKitFromProject`). Структура:
```json
{
  "channel_title": "...",
  "short_description": "...",
  "voice": "...",
  "audience": "...",
  "goals": ["..."],
  "reference_posts": ["..."]
}
```

## Как поля используются
- `lib/topicAdapter.ts` (адаптация Reels) — все 8 + brand_kit.
- `lib/scriptGenerator.ts` (Personal Script) — все 8.
- `lib/contentPack.ts` (Pack) — все 8.
- `lib/lexAI.ts` (`writeCarousel`, `writeReel`) — преимущественно `lex_brand_kit`.

## Связанные документы
- [[ONBOARDING]]
- [[02_CURRENT_STATE]]
- [[FEATURES]]

## Связанные файлы проекта
- `components/screens/CreateProjectScreen.tsx`
- `app/api/projects/route.ts`
- `supabase/migrations/content_plan_and_scenarios.sql`
- `lib/lexAI.ts`
