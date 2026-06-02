# Production hardening — операционка

## 1. Cleanup raw-uploads (cron)

**Endpoint**: `/api/cron/cleanup-raw-uploads`
**Расписание**: `30 3 * * *` (каждый день 03:30 UTC = 06:30 МСК)
**Регистрация**: `vercel.json` → `crons[]`

### Что чистит
- Bucket `raw-uploads` (приватный, сырьё клиентов от Mini App)
- Файлы старше **7 дней** по `created_at` из Supabase Storage metadata
- НЕ трогает bucket `reels` (готовые публикационные видео)
- НЕ удаляет файлы, на которые ссылается активный `reel_job` со статусом
  `pending`/`claimed`/`rendering`/`awaiting_approval` — двойная защита

### Идемпотентность
- Один прогон удаляет каждый файл максимум один раз
- Повторный запуск через 5 мин = no-op (новых старых файлов нет)
- Ошибка delete на конкретном файле → продолжаем, не падаем

### Логи
Vercel logs: `[cleanup-raw-uploads] listed=N candidates=N deleted=N skipped_active=N bytes_freed=N errors=N`

### Ручной запуск
```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://lex-ai-miniapp.vercel.app/api/cron/cleanup-raw-uploads
```

## 2. Prompt caching (Anthropic ephemeral)

**Где**: `lib/agents.ts` → `buildAgentSystem()`
**Технология**: Anthropic ephemeral cache (5-минутный TTL)

### 2 cache breakpoints на каждый AI-вызов:
1. `LEX_TEAM_RULES` — общие правила команды, кешируются между всеми агентами
2. `AGENT_DEFS[agentKey].system` — описание конкретного агента, кешируется per-agent

`taskInstructions` (третий блок) НЕ кешируется — часто меняется (retry с
фидбеком, разные topics карусели, и т.п.).

### Экономия
- Cache write: x1.25 от обычной цены input
- Cache hit: x0.10
- Break-even: 2-й вызов с тем же агентом за <5 мин окупает write

Реальная экономия в LEX:
- Все Анна-анализы / Александр-планы / Аркадий-ревью / Алина-генерация
  в течение 5-мин окна = 90% дешевле на системных блоках
- Особенно сильно экономит на pipeline reel: Алина → Аркадий → retry-Алина →
  retry-Аркадий — 4 вызова за минуту, после первого все остальные с cache hit

### Инвалидация
**Автоматическая по содержимому**: любое изменение текста промпта в
`AGENT_DEFS[agentKey].system` или `LEX_TEAM_RULES` = новый кеш-эндпоинт.
Никаких ручных flushes делать не нужно.

### При редактировании промптов
1. Меняешь текст в `lib/agents.ts` или в task-промптах в feature-файлах
2. Если task-промпт — бампай соответствующий `*_PROMPT_VERSION` в том же файле
3. Деплоишь — старый кеш просто не используется, новый прогревается с
   первого вызова

## 3. Counter-cache — НЕ внедрено (отложено)

**Решение**: не делаем. Reasoning:

- Текущий `lib/gating.ts` считает usage через `count()` запросы к Supabase
  на каждый gate-check (~500ms × 4 count'а параллельно = ~500ms total)
- Stress-test показал: 20 concurrent gate-чеков укладываются в 479ms
- Counter-cache в `project_budget` потребовал бы:
  - инкремент на каждом insert content_drafts (триггер или app-side)
  - декремент на reject/delete
  - reset на смене календарного месяца
  - синхронизация при ручных правках/откатах
  - бэкфилл существующих данных
- Риск дрифта между cached counter и реальным `COUNT()` высокий
- Профит: ~400ms экономии на gate-checks. Не критично для MVP

**Когда внедрить**: после первых 100 активных юзеров если латенция gating'а
станет видимой проблемой. Минимальный invasive путь:
1. Добавить `project_budget.reels_used_current_month int default 0` и аналоги
2. Триггер на `content_drafts` insert/delete → инкремент/декремент
3. Cron 1-го числа месяца сбрасывает счётчики
4. `getProjectUsage()` читает из счётчиков вместо count()

## Прочее

- Документация по tunnel: `docs/cloudflare-tunnel.md`
- Stress-test script: `scripts/stress-test.ts`
- Существующие cron-задачи: `vercel.json` → `crons[]`
