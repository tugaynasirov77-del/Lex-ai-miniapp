---
project: LEX AI
type: product
status: active
updated: 2026-06-19
source_of_truth: true
tags:
  - lex-ai
  - product
  - features
---

# Features

## TL;DR
- 5 AI-инструментов (Decoder, Script, Carousel, Caption, Pack) + 2 контекста (Adapted Topics, Personal Script).
- Хранение: Library + Plan + Archive.
- Удержание: уведомления, streak.
- Все генерации — Claude Haiku 4.5, расход трекается в `project_usage`.

## Когда читать этот файл
При работе с любой фичей. Каждая ниже — со своим разделом, ссылкой на UI/API/lib и known issues.

> [!important]
> Единый источник правды по фичам. Не дублируй описания в других заметках.

## Reel Decoder (главная фича)
- **UI:** `components/ReelDecoderCard.tsx`
- **API:** `POST /api/projects/[id]/reel/decode`
- **Lib:** `lib/reelDecoder.ts` (RapidAPI → Whisper → Claude)
- **DTO:** `ReelDecodeDTO`, `ReelAnalysisDTO`
- **Что возвращает:** метаданные ролика, транскрипт, structured analysis (hook, structure, storyboard, why_works, takeaways, shoot_yourself, adapt_to_brand, cta) + квота.
- **Кэш:** разбор того же shortcode возвращает кэш (`cached: true`).
- **Лимит:** `reel_decode` (Free 3/мес, Pro 30, Pro+ 100).
- **Ошибки:** см. `humanizeDecodeError` (невалидная ссылка / не-Reels / приватный / сеть / 402 → paywall).

## Adapted Topics (адаптация под нишу)
- **UI:** `components/AdaptedTopicsBlock.tsx` (рендерится внутри Decoder после разбора).
- **API:** `POST /api/projects/[id]/ig/adapt` (`mode: "topics" | "refine"`).
- **Lib:** `lib/topicAdapter.ts` (`adaptTopics`, `refineUserIdea`).
- **Что возвращает:** 3 темы `{ title, hook, rationale, format, duration_sec }` или 1 усиленная идея.
- **CTA:** «Создать мой Reels» → `PersonalScriptScreen`.

## Personal Script (полный сценарий)
- **UI:** `components/screens/PersonalScriptScreen.tsx`
- **API:** `POST /api/projects/[id]/ig/script`, `POST /api/projects/[id]/ig/script/refine`
- **Lib:** `lib/scriptGenerator.ts` (`generateScript`, `refineScriptBlock`)
- **20 полей `ReelScenarioData`:** title, goal, hook, on_screen_text, voice_over, storyboard[], duration_sec, in_frame, angle, background, light, editing_hints, text_overlays[], music_hint, cta, caption, hashtags[], risks[], alt_hooks[] (2), alt_cta.
- **AI-actions** на блоках hook/voice_over/editing_hints/cta/caption: shorter / sharper / calmer / expert / simpler / alternative.
- **Save:** POST `/api/projects/[id]/drafts` с `content_type='reel'`, `status='scenario_ready'`, `scenario_data`, `source_decode_id`, `source_topic`.
- **План:** модалка → `PATCH /api/drafts/[id]` с `planned_for_date`.

## Reel Script с нуля
- **UI:** `components/ReelScriptGeneratorCard.tsx`
- **API:** `POST /api/projects/[id]/lex/reel`
- **Lib:** `lib/lexAI.ts` → `writeReel`
- **Назначение:** сценарий по теме без референса (когда у юзера нет ссылки на Reels).
- **Поля:** topic, hook, scenes[], music_hint, caption, hashtags.

## Carousel Generator
- **UI:** `components/CarouselGeneratorCard.tsx`
- **API:** `POST /api/projects/[id]/lex/carousel`
- **Lib:** `lib/lexAI.ts` → `writeCarousel`
- **Что возвращает:** 6 слайдов + caption + hashtags + image_prompt.
- **Лимит:** `carousel`.

## Caption Generator
- **UI:** `components/CaptionGeneratorCard.tsx`
- **API:** `POST /api/projects/[id]/ig/caption`
- **Lib:** `lib/captionGenerator.ts` (`generateCaptions`)
- **Что возвращает:** 5 стилей подписей (viral / expert / story / sales / minimal) + 15 хэштегов.
- **Лимит:** `caption`.

## Content Pack
- **UI:** `components/ContentPackCard.tsx`
- **API:** `POST /api/projects/[id]/ig/pack`
- **Lib:** `lib/contentPack.ts` (`generateContentPack`)
- **Что возвращает:** `{ reel, carousel, caption }` + 3 строки в `content_drafts` с общим `content_pack_id`, статус `scenario_ready`.
- **Расход:** `agent_role='content_pack'`, 0.06.

## Content Library
- **UI:** `components/ContentLibrary.tsx`
- **API:** `GET /api/projects/[id]/drafts?status=all`
- **Фильтры:** по типу (reel / carousel / caption / idea) + по статусу (черновик / готово / опубликовано).
- **Карточки:** иконка + название (title или source_topic) + status pill + дата + plashka «📅 запланировано».

## Reel Archive
- **UI:** `components/ReelArchive.tsx`
- **API:** `GET /api/projects/[id]/reel/decode` (list)
- **Назначение:** все разборы проекта с раскрытием полного analysis.
- **Демо-карточка:** `lib/demoReelDecode.ts` показывается в пустом архиве (dismiss → localStorage).

## Plan (контент-план недели)
- **UI:** `components/screens/PlanScreen.tsx`
- **API:** `GET /api/projects/[id]/plan` (или встроено в lib/api.ts `getWeekPlan`)
- **DTO:** `WeekPlanDTO` `{ week_start, week_end, days[], summary }`.
- **Интерактив:** переключатель недель, action-sheet на материале (отметить готовым / опубликованным / убрать из плана).
- **Сводка:** прогресс-бар + цифры (запланировано / готово / опубликовано).

## Streak
- **API:** `GET /api/streak` → `{ current, longest, today }`.
- **Источник «активного дня»:** объединение `analytics_events` (script_saved / script_added_to_plan / content_status_changed / content_marked_published / project_created) + `content_drafts` (created_at + updated_at, status ≠ rejected).
- **UI:** `StreakBadge` на `DashboardScreen`. Текст: «N дней создаёте контент».

## Analytics events
- **Lib:** `lib/analytics.ts` (`track(event, props)`), батч-аплоад в `/api/analytics`.
- **27+ известных событий:** `app_opened`, `onboarding_started/completed`, `project_created`, `reels_link_entered`, `reels_analysis_started/completed/failed`, `adaptation_viewed/topic_selected`, `own_idea_entered`, `script_generation_started/generated/saved/copied/added_to_plan`, `content_status_changed/marked_published`, `archive_opened`, `paywall_opened`, `single_analysis_purchased`, `subscription_started`, `user_returned_day_1/7`, `caption_generated`, `carousel_generated`, `plan_opened`, `library_opened`.

## Уведомления-напоминания
- **Cron:** `app/api/cron/reminders/route.ts`
- **Тексты:** `lib/reminderTexts.ts`
- **Триггеры:** `draft_unfinished` > `streak_kept|broken` > `after_publish` > `inactive_2d`.
- **Frequency:** из `user_prefs.reminder_frequency` (off → skip).

## Связанные документы
- [[USER_JOURNEY]]
- [[MONETIZATION]]
- [[02_CURRENT_STATE]]
- [[30_Technical/ARCHITECTURE]]
- [[30_Technical/INTEGRATIONS]]

## Связанные файлы проекта
- `lib/{reelDecoder,topicAdapter,scriptGenerator,captionGenerator,contentPack,lexAI,analytics}.ts`
- `app/api/projects/[id]/{reel/decode,ig/adapt,ig/script,ig/caption,ig/pack,lex/carousel,lex/reel,drafts}/route.ts`
- `app/api/{streak,analytics,cron/reminders}/route.ts`
- `components/{ReelDecoderCard,AdaptedTopicsBlock,ContentLibrary,ReelArchive,ContentPackCard,CaptionGeneratorCard,CarouselGeneratorCard,ReelScriptGeneratorCard}.tsx`
- `components/screens/{PersonalScriptScreen,PlanScreen}.tsx`
