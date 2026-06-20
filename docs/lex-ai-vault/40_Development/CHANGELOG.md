---
project: LEX AI
type: dev
status: active
updated: 2026-06-19
tags:
  - lex-ai
  - dev
  - changelog
---

# Changelog

## TL;DR
- История изменений в коде (подтверждена Git) + журнал утверждённых продуктовых решений.
- Новый формат для будущих записей — внизу шаблон.

## Когда читать этот файл
При проверке «когда что-то добавили». История решений и причин → [[10_Product/PRODUCT_DECISIONS]].

> [!important]
> Единый источник правды по истории изменений.

## Подтверждено по репозиторию

### 2026-06-20
- Hard paywall на 402 во всех 4 генераторах: `ReelScriptGeneratorCard`, `CarouselGeneratorCard`, `CaptionGeneratorCard`, `ContentPackCard`. При `ApiError.status === 402` открывается `PaywallSheet` вместо текстовой ошибки (паттерн как в `ReelDecoderCard`).
- В `ReelDecoderCard` добавлен `QuotaDots` — визуальный прогресс ●○○ для Free-тарифа над текстовой строкой квоты.
- `PlanScreen`: inline-ошибка «не удалось обновить план» переведена с текстовой плашки на compact `StateBlock` с action «Обновить» — DoD по empty/error states закрыт.

### 2026-06-19
- Merge: PR #14 — реорганизация «Создать» → `ToolsScreen` с табами (Decoder/Сценарий/Карусель/Подпись/Пакет). С «Обзора» проекта генераторы убраны.
- Merge: PR #13 — финальная полировка UI Этапа 3 (StateBlock везде, IG-копи в DashboardScreen).
- feat: post-publish loop (Этап 3 раздел 20).
- feat: уведомления-напоминания под контент-план (`lib/reminderTexts.ts`, `app/api/cron/reminders/route.ts`).

### 2026-06-18
- feat: новая рабочая Home (вместо рекламной презентации).
- feat: контент-пакет (1 идея → Reel + Carousel + Caption, общий `content_pack_id`).
- feat: PlanScreen — недельный план с action-sheet, прогрессом, переключателем недель.
- feat: 4 вкладки нав-бара (Главная / Создать / План / Профиль).
- feat: 4 вкладки ProjectScreen (Обзор / Контент / Разборы / Настройки).
- feat: ContentLibrary с фильтрами по типу/статусу.
- feat: OnboardingSuccessScreen — финальный дизайн.

### 2026-06-17
- feat: Welcome onboarding + WelcomeGate.
- feat: Quick Project Setup (8 полей: name/niche/audience/content_goal/content_style/on_camera/what_sells/content_language).
- feat: PersonalScriptScreen (20 полей сценария, AI-actions: shorter/sharper/calmer/expert/simpler/alternative).
- feat: AdaptedTopicsBlock (3 темы + refine своей идеи).
- feat: аналитика — 27+ событий через `lib/analytics.ts` + `/api/analytics`.
- feat: streak за полезные действия (`/api/streak`).
- feat: StateBlock — единый блок пустых/ошибочных состояний.
- feat: PaywallSheet (value_moment / limit_reached).

### Ранее 2026-06
- feat: IG-only pivot (`QUOTA_EPOCH = 2026-06-13T09:00:00Z`).
- feat: Reel Decoder (RapidAPI + Whisper + Claude).
- feat: ReelArchive + демо-карточка.
- feat: Caption / Carousel / ReelScript генераторы.
- feat: Billing (ЮKassa) — Pro 490₽/мес, Pro+ 1490₽/мес.
- feat: годовые цены + FAQ в Billing.

## Продуктовые решения, принятые ранее
Полный список → [[10_Product/PRODUCT_DECISIONS]]. Кратко:
- DEC-001 — Одноразовый onboarding.
- DEC-002 — Рабочая Home после onboarding.
- DEC-003 — Первый разбор бесплатно.
- DEC-004 — Демонстрация ценности до paywall.
- DEC-005 — 2-3 бесплатных разбора с полной ценностью.
- DEC-006 — Разовая покупка + подписка.
- DEC-007 — Возможность модернизировать свою идею.
- DEC-008 — Интерактивный недельный план.
- DEC-009 — Отказ от старой «Открыть полный сценарий».
- DEC-010 — Отказ от логики со «скрепкой».
- DEC-011 — IG-only pivot.
- DEC-012 — 4 вкладки нав-бара.
- DEC-013 — «Создать» = хаб + Tools с табами.
- DEC-014 — Streak за полезные действия.

## Шаблон для будущих записей

```markdown
## YYYY-MM-DD

### Добавлено
- ...

### Изменено
- ...

### Исправлено
- ...

### Документация
- ...
```

## Связанные документы
- [[02_CURRENT_STATE]]
- [[10_Product/PRODUCT_DECISIONS]]
- [[03_NEXT_ACTIONS]]

## Связанные файлы проекта
- `package.json`
- Git log
