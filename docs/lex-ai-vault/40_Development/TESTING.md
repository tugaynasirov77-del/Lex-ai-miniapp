---
project: LEX AI
type: dev
status: active
updated: 2026-06-19
tags:
  - lex-ai
  - dev
  - testing
---

# Testing

## TL;DR
- Автотестов в проекте сейчас **нет**.
- Базовая проверка PR — `npx tsc --noEmit` (типы).
- Ручная проверка: deploy preview + ручной флоу через TG Mini App.

## Когда читать этот файл
Перед коммитом, перед мержем, при добавлении новой логики.

## Что проверяем сейчас

### 1. Типы
```bash
npx tsc --noEmit
```
Обязательно. Без чистого tsc PR не мержится.

### 2. Линт
```bash
npm run lint
```
Раньше не критично; не всегда блокирует, но желательно.

### 3. Build
Vercel автоматически проверяет `next build` на preview-деплое.

### 4. Ручная проверка
Минимальная для каждого PR:
- Запустить нужный сценарий на проде (после merge).
- Проверить, что нет JS-ошибок в DevTools.
- Проверить, что нет 4xx/5xx в Vercel Functions logs.

## Что нужно (планируется)

### Unit-тесты
- `flow/reducer.ts` — все actions, edge cases.
- `lib/gating.ts` — checkQuota по тарифам.
- `lib/tiers.ts` — TIERS константы.
- `lib/contentPack.ts` / `scriptGenerator.ts` — парсинг JSON-ответа Claude.
- `humanizeDecodeError` — все ветки ошибок.

### Integration
- API routes с моком Supabase + verifyInitData.

### E2E
- Playwright + mock TG initData → флоу Welcome → Setup → Decoder → Save.

См. [[40_Development/BACKLOG]] раздел Testing.

## Definition of Done (по типам PR)
См. [[40_Development/DEFINITION_OF_DONE]].

## Связанные документы
- [[DEFINITION_OF_DONE]]
- [[BACKLOG]]
- [[30_Technical/DEPLOYMENT]]

## Связанные файлы проекта
- `package.json` (scripts)
- `tsconfig.json`
