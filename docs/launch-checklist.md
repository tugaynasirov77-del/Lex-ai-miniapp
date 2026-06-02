# LEX AI — Production Launch Checklist (MVP, RU)

Один оператор, один проход сверху вниз. Если пункт ✅ — едем дальше. Если ❌ — фиксим до запуска.

---

## 1. Pre-launch (за день до запуска)

### Домены и DNS
- [ ] `lex-zavod.ru` — статус Active в Cloudflare, NS пропатчены
- [ ] `upload.lex-zavod.ru` резолвится, `curl -I https://upload.lex-zavod.ru/health` → 200
- [ ] `lex-ai-miniapp.vercel.app` открывается, SSL валиден

### ENV (Vercel production)
- [ ] `ANTHROPIC_API_KEY` — есть, не из dev
- [ ] `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — production проект
- [ ] `TELEGRAM_BOT_TOKEN` — encrypted, для `@Lex_app_bot`
- [ ] `CRON_SECRET` — задан
- [ ] `WORKER_SECRET` — совпадает с `/etc/lex-reels.env` на VPS
- [ ] `UPLOAD_PROXY_URL=https://upload.lex-zavod.ru`

### VPS (`85.239.42.100`)
- [ ] `systemctl is-active lexagents lex-reels lex-upload lex-tunnel` → все 4 `active`
- [ ] `df -h /` — свободно >5 ГБ
- [ ] `free -m` — RAM не в свопе устойчиво
- [ ] whisper.cpp: `/opt/whisper.cpp/build/bin/whisper-cli --help` отвечает
- [ ] FFmpeg 8: `ffmpeg -version | head -1`

### Telegram
- [ ] `@Lex_app_bot` отвечает на `/start`
- [ ] Mini App кнопка ведёт на `https://lex-ai-miniapp.vercel.app`
- [ ] BotFather: Menu Button → корректный URL
- [ ] Bot privacy mode — корректный для use-case

### Supabase
- [ ] Bucket `reels` (public) существует
- [ ] Bucket `raw-uploads` (private) существует
- [ ] RLS на чувствительных таблицах включён или service-role-only доступ подтверждён
- [ ] Free план: storage <800 МБ (запас до 1 ГБ), DB rows в порядке

### Биллинг (Telegram Stars MVP)
- [ ] Tier-конфиг в `lib/tiers.ts` соответствует прайсу
- [ ] Test invoice: создать pro-invoice на dev-юзере, проверить `getStarTransactions` flow
- [ ] `subscriptions` и `billing_events` таблицы доступны
- [ ] Gating: free-юзер с лимитом=0 получает 402/403 на reel создание

### Cron / hardening
- [ ] Vercel cron `cleanup-raw-uploads` (30 3 * * *) активен в Vercel UI
- [ ] `lib/agents.ts.buildAgentSystem()` использует 2 cache_control breakpoints (sanity grep)
- [ ] `/api/cron/cleanup-raw-uploads` отдаёт 401 без `CRON_SECRET`

### Sanity-проход живым юзером
- [ ] Создать TG-проект → разведка → план → драфт → review → approve
- [ ] Создать IG-проект → загрузить 30-сек видео → транскрипт → tap слова → render → проверить video_url играет
- [ ] Создать carousel → review → approve
- [ ] Открыть `/billing` — баланс, лимиты отображаются

---

## 2. Launch sequence

Порядок строго сверху вниз. После каждого шага — verify.

1. **Заморозить деплои на dev.** Последний merge в `main` за 12+ часов до запуска.
2. **Pre-launch чеклист** (выше) — пройти полностью. **NO-GO если есть любой ❌.**
3. **Создать snapshot Supabase** (UI → Database → Backups → manual). Дата в названии.
4. **Тэгнуть релиз:** `git tag -a v1.0.0-mvp -m "MVP launch" && git push --tags`
5. **Запустить дымовой тест** на проде с личного аккаунта (полный IG+TG flow).
6. **Открыть мониторинг-окна:**
   - Vercel Logs (live)
   - `ssh root@85.239.42.100 'journalctl -fu lex-reels lex-upload lex-tunnel'`
   - Supabase Logs + Storage usage
7. **GO/NO-GO решение:**
   - ✅ GO: дымовой тест прошёл, все 4 systemd active, ошибок в логах нет за 10 мин.
   - ❌ NO-GO: любая 5xx в Vercel за 10 мин, любой systemd failed, render не доходит до done.
8. **Анонс юзерам** (пригласительные ссылки, ограниченный круг 5-10 юзеров на первые 24 ч).
9. **Дежурство первые 4 часа** — окна открыты, телефон рядом.

---

## 3. Monitoring (что смотреть)

### Realtime во время запуска
- Vercel Logs: фильтр `error|500|429`
- VPS: `journalctl -fu lex-reels` — rendering phase прогресс
- Supabase: `select status, count(*) from reel_jobs group by status` каждые 15 мин

### Критические паттерны (немедленная реакция)
- `cloudflared: connection refused` → tunnel упал
- `reel_jobs status='claimed'` стоит >5 мин без обновления → воркер залип
- 5xx > 1% на `/api/projects/*/ig/reels/*`
- Anthropic 529/overloaded подряд >3 раза → бэкофф или эскалация
- Supabase storage >950 МБ → срочный cleanup или upgrade Pro

### Не-критические (можно подождать)
- Single 429 от Telegram (rate limit retry)
- Один failed reel_job (auto-recovery подхватит)
- Anthropic latency spike 1-2 раза в час

---

## 4. Incident runbook

### Upload-proxy недоступен (юзер не может загрузить видео)
1. `curl https://upload.lex-zavod.ru/health` → если 5xx/timeout:
2. `ssh root@85.239.42.100 'systemctl status lex-upload lex-tunnel'`
3. Если `lex-upload` failed → `journalctl -u lex-upload -n 100` → `systemctl restart lex-upload`
4. Если `lex-tunnel` failed → `systemctl restart lex-tunnel`, проверить `journalctl -u lex-tunnel -n 50` на `connection registered`
5. Если оба ок но не работает — Cloudflare dashboard → Tunnels → status

### Reel render queue застрял
1. `SELECT id, status, phase, claimed_at, attempts FROM reel_jobs WHERE status IN ('claimed','rendering') AND updated_at < now() - interval '5 min';`
2. Auto-recovery должен сбросить эти jobs в `pending` при следующем pull (`/api/ig/reel-jobs/next`).
3. Если не сбрасывает — `ssh ... 'systemctl restart lex-reels'`.
4. Если 3+ job подряд `failed` с одинаковой ошибкой → проверить `error` поле, скорее всего FFmpeg/whisper/storage. Логи: `journalctl -u lex-reels -n 200`.
5. Hard rollback: установить вручную всем зависшим `status='failed'`, юзеру сообщить, разобраться post-mortem.

### Биллинг ошибки
1. Юзер не получает Stars-инвойс → проверить `/api/billing/upgrade` логи в Vercel.
2. Платёж прошёл но tier не обновился → `select * from billing_events where created_at > now() - interval '1 hour'` + проверить `getStarTransactions` ответ.
3. Ручной фикс: `update subscriptions set status='active', tier='pro', expires_at=now()+interval '30 days' where user_id=...`. Записать в `billing_events` ручную пометку.
4. Refund: через Telegram Stars dashboard (manual).

### Cleanup cron failed
1. Vercel → Crons → `cleanup-raw-uploads` → последний run.
2. Если 401 → проверить `CRON_SECRET` совпадает в env и в роуте.
3. Если 500 → логи, скорее всего Supabase API rate limit или auth.
4. Manual cleanup: запустить руками `curl -H "Authorization: Bearer $CRON_SECRET" https://lex-ai-miniapp.vercel.app/api/cron/cleanup-raw-uploads`.
5. Storage >950 МБ — экстренно: удалить старые файлы вручную из bucket `raw-uploads` (sort by date).

### Telegram доступ заблокирован
1. Bot не отвечает → BotFather → проверить токен не revoked.
2. Mini App не открывается → Vercel deployment status + ENV.
3. RU-блок Telegram API (редко) — переждать, retry с экспоненциальным бэкоффом уже в коде.
4. Webhook ошибки → `curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo`.

### Rollback (последний резерв)
1. `git revert <commit>` или `vercel rollback` через CLI/UI на предыдущий деплой.
2. Если миграция БД сломала — restore из снапшота Supabase (созданного в launch step 3).
3. Объявить юзерам maintenance, дать 30 мин.

---

## 5. Maintenance cadence

### Ежедневно (5 мин)
- Vercel Logs за сутки: ошибок 5xx >10? — разобраться.
- `select status, count(*) from reel_jobs where created_at > now() - interval '1 day' group by status` — failed >10%? разобраться.
- Supabase storage usage.
- `systemctl status` всех 4 VPS-сервисов.

### Еженедельно (15 мин)
- `billing_events` за неделю — аномалии в платежах.
- Anthropic usage dashboard — стоимость на трендах.
- Disk на VPS (`df -h`).
- Бэкап Supabase manual snapshot (на всякий).

### Можно игнорить в MVP
- Performance тюнинг агентов (если работают).
- Counter-cache (отложен по rationale).
- Real-time IG scraping (нет в MVP).
- B-roll генерация.

---

## 6. Release scope

### В MVP
- TG-проекты end-to-end (разведка → план → драфт → publish)
- IG-проекты: Reels (user-upload + word-tap karaoke), Carousel generation, Competitor analysis, Weekly plan
- Unified Review Screen
- Аркадий-quality control на TG/Reel/Carousel
- Subscription tiers (free/pro/business) через Telegram Stars
- Cloudflare named tunnel + prompt caching + raw-uploads cleanup cron

### Out of scope (явно НЕ запускаем)
- Виктор-публикатор IG (Graph API) — после launch, нужен IG Business token клиента
- Tribute монетизация — после оформления самозанятого
- Counter-cache на project_budget
- Real IG скрейпинг (только manual notes + AI synthesis)
- Серверный PNG-рендер слайдов карусели
- B-roll AI генерация
- Desktop video editor / multi-track timeline

### Launch assumptions
- Юзеры RU, мобильные, Telegram-first
- Пилотная группа 5-10 юзеров на первые сутки
- Один оператор (Daniil) на дежурстве 24/7 первую неделю
- Supabase Free хватает до ~30 IG-юзеров
- VPS 2GB RAM хватает на текущий load (multi_bot + reels-worker устойчиво)
- Stars-биллинг — временное решение, Tribute заменит после оформления

---

## Контакты / доступы
- VPS: `ssh root@85.239.42.100`
- Supabase: проект `oawpgchdoshuqjvafgvt`
- Vercel: `tugaynasirov77-del`
- Repo: https://github.com/tugaynasirov77-del/Lex-ai-miniapp
- Tunnel UUID: `30a9226f-e275-4fa9-9c8b-4999346530f3`
