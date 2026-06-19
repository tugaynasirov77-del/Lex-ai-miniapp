---
project: LEX AI
type: product
status: active
updated: 2026-06-19
source_of_truth: true
tags:
  - lex-ai
  - product
  - monetization
---

# Monetization

## TL;DR
- Free: **3 разбора Reels / месяц**, + базовые квоты по другим форматам.
- Pro: **490 ₽/мес** или **3 990 ₽/год** (332 ₽/мес, −32%). 30 разборов/мес.
- Pro+: **1 490 ₽/мес** или **11 900 ₽/год** (992 ₽/мес, −33%). 100 разборов/мес.
- Платежи: ЮKassa (НЕ Apple/Google IAP).
- Принцип: **сначала ценность, потом paywall** — первый разбор бесплатно, без жёсткого payment-блокера.

## Когда читать этот файл
При работе с биллингом, paywall, квотами, тарифами. Цены брать из `lib/tiers.ts` — там источник правды.

> [!important]
> Единый источник правды по монетизации. Цены и лимиты дублируются с `lib/tiers.ts` — при изменении сначала код, потом этот документ.

## Бесплатный уровень (Free)
- 1 IG-проект.
- **3 разбора Reels / месяц** (флагман).
- 5 подписей / месяц.
- 2 поста / 2 карусели / 2 reel-сценария — на неделю.
- Базовая генерация без AI-actions.
- Цель Free: дать ощутить полную ценность за 1-3 разбора.

## Pro (490 ₽/мес или 3 990 ₽/год)
- До 2 IG-проектов.
- **30 разборов Reels / месяц.**
- Безлимит карусели, подписи, посты, reel-сценарии (`UNLIMITED = 9999`).
- Сценарии Reels с нуля под нишу.
- Контент-план на неделю по архиву разборов.
- Приоритет в очереди генерации.

## Pro+ (1 490 ₽/мес или 11 900 ₽/год)
- До 10 IG-проектов.
- **100 разборов Reels / месяц.**
- Сценарии Reels + генерация серий (5 вариаций) — заявлено, не подтверждено.
- AI-сводка ниши, приоритетная поддержка.

## Лимиты по action
Источник правды — `lib/tiers.ts` (`TIERS[tier].limits`):
- `post`, `carousel`, `reel`: Free 2/week, Pro/Pro+ unlimited.
- `reel_decode`: Free 3/month, Pro 30, Pro+ 100.
- `caption`: Free 5/month, Pro/Pro+ unlimited.

Период считается от `QUOTA_EPOCH = 2026-06-13T09:00:00Z` (момент перехода на LEX AI). Драфты до этой даты в счётчик не идут.

## Whitelist (админ-доступ)
`ADMIN_TG_IDS` в `lib/gating.ts` — обходят quota. Сейчас: `5825762433` (основатель), `999482511` (@truekostoev — тест).

## Логика gating
`lib/gating.ts`:
- `getActiveTier(tgId)` — берёт активную подписку из `subscriptions` (status=active, не expired).
- `countUsage(tgId, action, period)` — считает использование за период (week/month).
- `checkQuota` → `{ ok, tier, config, limit, used, reason? }`.
- `enforceQuota` (для API) → возвращает 402 Response с body `{ error, gate: { tier, action, used, limit, period, upgrade_required } }`.

## Paywall (`components/PaywallSheet.tsx`)
- Bottom-sheet, **не fullscreen**, без таймеров и фальшивых скидок.
- 2 варианта показа:
  - `value_moment` — после первого сохранённого сценария.
  - `limit_reached` — при `quota_exceeded` (402).
- Toggle period: month / year (год +32% скидка).
- Pro как primary CTA, Pro+ как secondary якорь.
- analytics: `paywall_opened { variant }`.

## Точки показа paywall
- **Decoder** → 402 quota → `PaywallSheet` (`limit_reached`).
- **OnboardingSuccess** → опционально `value_moment` (TBD).
- **TODO для других генераторов** — сейчас 402 в них показывается текстом, см. [[03_NEXT_ACTIONS]] пункт 5.

## Планируемое (не реализовано)
- **Lite-пакет 390 ₽ за 10 разборов** — разовая покупка через ЮKassa без подписки. Бэк не подключён. См. [[03_NEXT_ACTIONS]] пункт 6.
- **Прогресс-бар ценности ●○○** в результатах разбора (показывает 1/3 free).

## Риски слишком раннего paywall
- Юзер не увидел полной ценности → жёсткое «купи» → отток.
- Free-юзеры с 0 разборов не получают `value_moment` → монетизация не запускается.
- Поэтому: paywall на limit_reached **после** хотя бы одного разбора, не до.

## Что пока не решено
- Bundle цен на Lite-пакет (390 ₽ — гипотеза, проверить с владельцем).
- Должен ли value_moment paywall показываться **всегда** после 1-го сценария или только Free-юзерам.
- Подсказки апсейла на других генераторах (пакет, карусель) — нужно ли вообще, или только Decoder продаёт.

## Связанные документы
- [[USER_JOURNEY]] (точки активации/монетизации)
- [[FEATURES]] (лимиты внутри каждого инструмента)
- [[50_Marketing/PRODUCT_FUNNEL]]
- [[PRODUCT_DECISIONS]] (DEC-003, DEC-004)

## Связанные файлы проекта
- `lib/tiers.ts`
- `lib/gating.ts`
- `lib/yookassa.ts`
- `components/PaywallSheet.tsx`
- `components/screens/BillingScreen.tsx`
- `app/api/billing/{route,upgrade,yookassa-checkout,yookassa-webhook,confirm}/route.ts`
