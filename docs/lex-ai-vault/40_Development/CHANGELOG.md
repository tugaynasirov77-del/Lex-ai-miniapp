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

### 2026-06-21
**Визуальная унификация (вся жёлтая палитра вычищена → IG-гамма, эмодзи → line-иконки):**
- Единая палитра везде: BG `#0B0B11`, карточки `#15151E`, бордер `#262630`, текст `#F4F4F8`, MUTED `#9A9AAB`, SUB_MUTED `#6B6B7B`. Бренд-акцент — IG-градиент `#A24FD6→#E84B91→#F88A4A`. ORANGE `#F0944E` = warning/«готово к съёмке», GREEN `#4FD489` = успех. Жёлтый `#F5E70A` и кремовые градиенты (`#FFF382`/`#E5C500`) удалены.
- Эмодзи в UI заменены на line-иконки (stroke 1.7-1.8, currentColor) в: `ReelDecoderCard`, `AdaptedTopicsBlock`, `PersonalScriptScreen`, `PlanScreen`, `CreateHubScreen`, `ProjectScreen`, `ContentLibrary`, `ReelArchive`, `ToolsScreen`, `BillingScreen`, генераторы, `PaywallSheet`. Исключения: `emoji=` пропсы `StateBlock` (emoji-based by design) + редкие декоративные глифы пустых состояний.
- `HomeScreen` перестроен по воронке: приветствие+проект, «Что создаём сегодня?» (CTA «Разобрать и адаптировать»), новый блок «Продолжить работу» (незавершённые), компактная план-сводка с «сегодня», последние материалы, идеи дня внизу. Удалены лендинг-заголовок, «3 фичи», соцпруф «340+ блогеров».

**Функционал:**
- §18 Перенос материала на другой день — `PlanScreen` ActionSheet → инлайн-выбор из 14 дней (`updateDraft` planned_for_date).
- §14 «Сценарий с нуля» (`ReelScriptGeneratorCard`): вилка «есть тема / подскажи идею» (`getDailyIdeas`), мульти-чипы стиля (дописываются в тему-промпт), «Усилить идею» (панель было/стало).
- §20 После публикации (`PostPublishSheet`): ввод ссылки на опубликованный Reels + ручные метрики (просмотры/лайки/комменты).
- §19 Уведомления: тогл в `SettingsScreen` синхронизирован с `user_prefs.reminder_frequency` (раньше только localStorage → крон его не видел).

**Бэкенд:**
- `app/api/billing/yookassa-webhook/route.ts` — ПОЧИНЕН критический баг: `activateSubscription` писал в несуществующие колонки (`yookassa_payment_id`, `amount_rub`) и делал `insert` в `subscriptions` (PK `tg_id`, у юзера уже есть free-строка) → 0 активаций. Теперь: `upsert` по `tg_id`, идемпотентность через `subscription_purchases.payment_id`, `project_budget` по `project_id`, `billing_events` колонки `type/tier/amount_stars/meta`. payment_id хранится в `invoice_payload`.
- `app/api/projects/[id]/ig/refine-idea/route.ts` — НОВЫЙ: усиление сырой идеи без `decode_id` (`lib/topicAdapter.refineIdeaStandalone`).
- `app/api/user/prefs/reminders/route.ts` — НОВЫЙ: GET/POST `reminder_frequency`.
- `app/api/drafts/[id]/route.ts` — PATCH whitelist `ig_post_url` + `published_metrics` (колонки уже были в `content_drafts`).
- `lib/api.ts`: `refineIdeaStandalone`, `getReminderFrequency`/`setReminderFrequency`, `updateDraft` расширен (`ig_post_url`, `published_metrics`).

**Открытые OPS-вопросы (не код):**
- ЮKassa webhook-URL в дашборде должен быть `…/api/billing/yookassa-webhook` (события `payment.succeeded`).
- Покупатель 19.06 (payment `31c72bcf-000f-5000-b000-15d7fe2ef2f2`, Pro 490₽) НЕ активирован старым багом — нужен `tg_id` из metadata, активировать вручную.
- `/api/cron/tick` НЕ в `vercel.json` (рассчитан на внешний планировщик, hourly) — проверить что он настроен, иначе reminders молчат.

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

## 2026-06-19

### Добавлено
- **Динамические «Идеи для Reels на сегодня»** под нишу проекта (замена хардкода).
  - таблица-кэш `project_daily_ideas` (1 набор на проект в день), миграция `supabase/migrations/daily_ideas.sql`
  - генератор `lib/dailyIdeas.ts` (Haiku), endpoint `GET /api/projects/[id]/ideas` с дневным кэшем
  - `lib/api.ts`: `getDailyIdeas` + `DailyIdeaDTO`
  - `HomeScreen`: загрузка идей, skeleton-состояние, фолбэк `FALLBACK_IDEAS`, seed в генератор по `hook`

### Изменено
- Главный экран переведён в **тёмную тему** (раньше светлая); иконки приведены к эталону-референсу, плашки иконок с градиентом/кольцом/свечением
- Таб-бар: акцент жёлтый → розовый (IG-гамма)

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
