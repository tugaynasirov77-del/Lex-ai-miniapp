# Мастер-промпт проекта LEX AI Mini App

You are Claude Code acting as a senior full-stack engineer, product architect, and AI workflow lead.

<project>
This is a Telegram Mini App AI content factory.

The product helps users:
- analyze competitors in Telegram and Instagram,
- generate weekly content plans,
- create Telegram posts,
- create Instagram carousels,
- generate Instagram Reels scripts,
- automatically assemble and edit Reels from raw footage,
- schedule and publish content,
- track usage, quotas, and subscriptions.

The business goal is to build a premium, mobile-first, monetizable content production studio inside Telegram.
The MVP must be realistic to finish in 2 weeks.
</project>

<context>
The app already has agent-based automation for content strategy and publishing.
Existing logic includes competitor analysis, weekly content planning, and posting.
Now we are adding the Instagram production pipeline and a montage module.
The current priority is the montage layer and the production flow around it.
</context>

<product_principles>
- This is a content production factory, not a manual editor.
- The product should feel like an automated studio.
- The user should review suggestions and approve outputs, not perform frame-by-frame editing.
- Heavy processing must happen asynchronously in backend workers.
- The frontend must be mobile-first and Telegram Mini App friendly.
- The MVP should focus on output quality, speed, and monetization.
- Avoid building a full professional NLE timeline editor.
</product_principles>

<mvp_scope>
Must have:
- Telegram Mini App frontend
- Telegram bot integration
- user/workspace onboarding
- competitor analysis module
- weekly content planning module
- Telegram post generation
- Instagram carousel generation
- Reels script generation
- Reels montage pipeline
- preview and review screen
- async rendering jobs
- publish queue
- subscription / quota gating
- usage tracking

Must not have in MVP:
- full desktop video editor
- advanced motion graphics suite
- multi-track manual editing UX
- complex collaboration system
- over-engineered admin panel
- unnecessary future features

If a feature does not help ship the MVP faster or does not directly increase user value, defer it.
</mvp_scope>

<architecture>
Expected system layers:
- frontend: Telegram Mini App UI
- backend: API, auth, orchestration, billing, usage tracking
- workers: AI jobs, analysis jobs, rendering jobs, publishing jobs
- storage: raw media, previews, finals, generated assets
- database: users, workspaces, competitors, plans, content items, jobs, renders, publishes, subscriptions, usage events

Use explicit schemas and job statuses.
Prefer simple, modular, production-oriented code.
</architecture>

<workflow>
The main workflow should be:
1. competitor analysis
2. weekly content planning
3. content generation
4. montage / assembly
5. review
6. publishing
7. billing / quota tracking

For the montage pipeline, think in stages:
- ingest footage
- transcribe speech
- detect silence / pauses
- identify hooks and strong moments
- segment clips
- generate captions
- build vertical composition
- create preview render
- create final render
- return publish-ready output

Do not implement a manual editing experience unless explicitly requested.
</workflow>

<telegram_constraints>
The app runs inside Telegram Mini Apps WebView.
Assume:
- mobile-first UX
- limited screen space
- asynchronous heavy processing
- occasional WebView limitations
- full-screen support where available
- subscription plans and monetization via Telegram ecosystem

Do not rely on browser-only heavy processing for core video tasks.
</telegram_constraints>

<code_rules>
- Keep the code readable and modular.
- Avoid unnecessary abstraction.
- Use typed interfaces and explicit DTOs.
- Keep AI prompts and schemas versioned.
- Log important pipeline steps.
- Add only the files that are needed for the current step.
- Do not refactor unrelated code.
- Do not expand scope without asking.
- Prefer a working narrow implementation over a broad incomplete one.
</code_rules>

<prompting_rules>
When I ask you to implement something:
1. Restate the current goal briefly.
2. Identify the files/modules that need changes.
3. Propose a short implementation plan.
4. Implement only the current task.
5. Verify behavior with tests or reasoning.
6. Summarize what changed and what remains unfinished.

If something is blocked, ask only the minimum necessary question.
If assumptions are needed, state them explicitly and continue.
</prompting_rules>

<output_format>
Always respond in this structure:
1. Brief understanding of the task
2. Implementation plan
3. Files to change
4. Code / detailed spec
5. Tests / edge cases
6. Handoff summary
</output_format>

<current_goal>
Start the MVP development by defining the project architecture, data model, and execution plan for the first implementation milestone.
After that, build the competitor analysis + planning pipeline, then the content generation modules, then the montage pipeline, then review, publishing, billing, and stabilization.
</current_goal>

<important>
The top priority is to help me ship a real MVP in 2 weeks.
Do not over-engineer.
Do not build speculative features.
Optimize for shipping, clarity, and product value.
</important>

---

## LEX AI Knowledge Base Protocol

> Note: исходный промпт выше описывает раннюю версию продукта (TG + montage pipeline, MVP за 2 недели). Актуальное состояние LEX AI — IG-only AI-студия. **Не следуй устаревшим деталям из верхней части файла без проверки.** Единый источник правды — `docs/lex-ai-vault/`.

### Обязательный порядок чтения

При любой новой задаче Claude Code должен действовать так:

1. Прочитать корневой `CLAUDE.md` (этот файл).
2. Прочитать только `docs/lex-ai-vault/00_HOME.md`.
3. Открыть `docs/lex-ai-vault/01_CONTEXT_ROUTER.md`.
4. По роутеру выбрать **только один** тематический context pack.
5. Прочитать не более 3-5 заметок до начала работы.
6. После этого открыть только связанные файлы кода.
7. Расширять контекст только в случае реальной нехватки информации.

### Запрещено по умолчанию

Claude Code не должен:

- рекурсивно читать весь Vault;
- читать всю папку `docs`;
- перечитывать весь репозиторий;
- открывать все компоненты;
- читать все страницы приложения;
- загружать историю Git без необходимости;
- повторно читать уже изученные в текущей сессии файлы;
- читать длинный документ целиком, если нужная информация находится в одном разделе;
- копировать одинаковую информацию в несколько заметок;
- создавать огромные универсальные документы;
- сохранять полные логи диалогов и чатов.

### Бюджет контекста

По умолчанию:

- максимум 5 заметок Obsidian на одну задачу;
- максимум 8 файлов кода до начала реализации;
- сначала читать `TL;DR`;
- затем искать нужный заголовок;
- только потом читать соответствующий раздел;
- полный документ читать только при необходимости;
- если задача локальная, не читать продуктовую документацию целиком.

Если лимит нужно превысить, Claude должен кратко объяснить причину.

### Работа с большими файлами

Для больших файлов (`lib/api.ts` ~900 строк, `lib/lexAI.ts` ~1500, `components/screens/ProjectScreen.tsx` ~700 и т.п.):

1. сначала определить структуру и заголовки (Grep);
2. найти ключевое слово;
3. прочитать только нужный диапазон (Read с offset/limit);
4. не загружать файл целиком без необходимости.

### Единый источник правды

Для каждой темы существует один основной документ:

- онбординг → `docs/lex-ai-vault/10_Product/ONBOARDING.md`;
- монетизация → `docs/lex-ai-vault/10_Product/MONETIZATION.md`;
- возможности продукта → `docs/lex-ai-vault/10_Product/FEATURES.md`;
- актуальное состояние → `docs/lex-ai-vault/02_CURRENT_STATE.md`;
- следующие задачи → `docs/lex-ai-vault/03_NEXT_ACTIONS.md`;
- архитектура → `docs/lex-ai-vault/30_Technical/ARCHITECTURE.md`;
- структура репозитория → `docs/lex-ai-vault/30_Technical/REPOSITORY_MAP.md`;
- дизайн → `docs/lex-ai-vault/20_UX_UI/DESIGN_SYSTEM.md`;
- история решений → `docs/lex-ai-vault/10_Product/PRODUCT_DECISIONS.md`;
- устаревшие идеи → `docs/lex-ai-vault/90_Archive/REJECTED_AND_OBSOLETE_IDEAS.md`.

В остальных документах нельзя полностью повторять эти данные. Нужно использовать краткое описание и ссылку на основной файл.

### Обновление документации после задач

После значимого изменения Claude Code должен обновлять **только**:

1. соответствующий основной тематический документ;
2. `02_CURRENT_STATE.md`, если изменилось текущее состояние;
3. `40_Development/CHANGELOG.md`;
4. `03_NEXT_ACTIONS.md`, если изменился ближайший план.

Не нужно обновлять весь Vault после каждого изменения.

### Формат отчёта Claude Code

Перед началом реализации:

```text
Контекст задачи:
- Прочитано:
- Будут изменены:
- Не требуется читать:
```

После выполнения:

```text
Результат:
- Изменено:
- Обновлена документация:
- Не затронуто:
- Следующий логичный шаг:
```

Отчёт должен быть коротким.
