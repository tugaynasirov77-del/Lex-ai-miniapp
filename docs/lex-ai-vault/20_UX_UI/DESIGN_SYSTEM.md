---
project: LEX AI
type: ui
status: active
updated: 2026-06-19
source_of_truth: true
tags:
  - lex-ai
  - ui
  - design
---

# Design System

## TL;DR
- Тёмная тема, жёлтый акцент. Без формальной токен-системы — стили inline в компонентах.
- Mobile-first под Telegram Mini App WebView.
- Шрифт: Inter (`@fontsource/dm-sans` подключён, но фактически inline `'Inter', system-ui`).
- Базовые радиусы: 14-16px для карточек, 999 для pill-кнопок.

## Когда читать этот файл
При работе с любым UI-компонентом, новым экраном, рефакторингом стилей.

> [!important]
> Единый источник правды по визуалу. Все компоненты должны опираться на эти константы.

## Цвета (де-факто токены)
Дублируются в каждом компоненте — единого `theme.ts` нет (тех-долг, см. [[30_Technical/TECHNICAL_DEBT]]).

| Назначение | HEX/RGBA | Где |
|---|---|---|
| Жёлтый акцент | `#F5E70A` (`YELLOW`) | Primary CTA, активный таб, важные элементы |
| Жёлтый soft (фон) | `rgba(245,231,10,0.06-0.10)` | Подсветка карточек |
| Жёлтый glow shadow | `rgba(245,231,10,0.40)` | Тени primary-кнопок |
| INK (текст) | `#FFFFFF` | Основной текст |
| MUTED | `rgba(255,255,255,0.58)` | Вторичный текст |
| SUB_MUTED | `rgba(255,255,255,0.42)` | Подписи, даты |
| Card BG | `rgba(255,255,255,0.04)` | Тёмные карточки |
| Card border | `rgba(255,255,255,0.10)` | Границы карточек |
| Success | `#5BD66B` | published, success-плашки |
| Warning | `#F39B40` / `#FFC480` | warn-плашки, ошибки публикации |
| Danger | `#FF8B8B` | tone=error в StateBlock |
| Pink (decoder/hook) | `#F58AC0` / `#DD2A7B` | hook-блоки, акцент IG-градиента |
| Cyan (structure) | `#7AC8FF` | storyboard, structure |
| Orange (insights) | `#FFC480` / `#F39B40` | psychotriggers |
| Background page | `#0A0608` | Основной фон |

## Градиенты
- **Primary CTA:** `linear-gradient(135deg, #FFF382 0%, #F5E70A 50%, #E5C500 100%)`.
- **IG-радиальный (Instagram-аккаунты):** `linear-gradient(135deg, #F58529 0%, #DD2A7B 50%, #8134AF 100%)`.
- **Pink hook bar:** `linear-gradient(180deg, #F58529 0%, #DD2A7B 100%)`.

## Типографика
- Шрифт: `'Inter', system-ui, sans-serif` (inline).
- Размеры (де-факто):
  - H1 экрана: 26-28px, `font-weight: 800`, `letter-spacing: -0.02em`.
  - H2 секции: 20-22px, `font-weight: 800`.
  - Body: 14-15px, `line-height: 1.45-1.55`.
  - Small/meta: 11-12px, color `MUTED`/`SUB_MUTED`.
  - Label uppercase: 10-11px, `letter-spacing: 0.06-0.14em`, `text-transform: uppercase`, `font-weight: 700-800`.

## Радиусы
- Card: 14-16px.
- Pill / кнопка-CTA: 999.
- Inner control: 10-12px.
- Status pill: 999.
- Modal-sheet top: 22-24px.

## Отступы (ScreenWrap)
Стандартный шаблон экрана:
```css
padding:
  max(calc(env(safe-area-inset-top) + 56px), 88px)
  18px
  max(calc(env(safe-area-inset-bottom) + 96px), 110px);
```
Нижний клиренс рассчитан под фиксированный `BottomTabBar` высотой ~78px + воздух.

## Кнопки
- **Primary (Pill CTA):** жёлтый градиент, `min-height: 50-56px`, `padding: 14-18px 0`, uppercase, `font-weight: 800`, `box-shadow: 0 14px 32px rgba(245,231,10,0.40)`.
- **Secondary:** прозрачный фон, border `CARD_BORDER`, `color: INK` или `MUTED`.
- **Chip:** `padding: 6-9px 12-14px`, `border-radius: 999`, активный — `border: YELLOW`, `background: rgba(245,231,10,0.10)`, `color: YELLOW`.

## Карточки
- Фон: `CARD_BG`, border `CARD_BORDER`, `border-radius: 14-16`.
- Hover/active подсветка — `border-color: YELLOW`.
- Градиентные карточки (Decoder, генераторы): radial-gradient в углу + linear-gradient фоном.

## Статус-цвета (status pill)
- **Готово к съёмке / approved / scheduled** → жёлтый (`YELLOW`).
- **Опубликовано / published** → зелёный (`#5BD66B`).
- **Черновик / draft / idea / scenario_ready** → серый (`MUTED`).
- **Ошибка / rejected / failed** → оранжевый/красный (`#F39B40` / `#FF8B8B`).

## StateBlock (единый блок пустых/ошибочных состояний)
Компонент: `components/StateBlock.tsx`.
Параметры:
- `emoji` — крупная иконка (📭 / 🔌 / ⚠️ / 🎬).
- `title` — что произошло.
- `body` — что можно сделать.
- `action` — primary-кнопка (жёлтая).
- `secondary` — текстовая ссылка под кнопкой.
- `tone` — `neutral` (default) или `error` (красноватая рамка/заголовок).
- `compact` — меньше отступов для встроенных мест.

Используется в: ContentLibrary, PlanScreen, ReelArchive, PersonalScript, ReelDecoderCard (ошибки).

## Иконки
SVG inline, `stroke="currentColor"`, `strokeWidth=1.7`. Эмодзи в карточках/состояниях — основной визуальный язык, иконок-шрифтов нет.

## Mobile-first правила
- Все экраны — портретная ориентация, ширина WebView ~380-420px.
- Никаких hover-эффектов как primary affordance.
- Тач-таргет ≥ 44px.
- `WebkitOverflowScrolling: 'touch'` на скроллируемых контейнерах.
- `touchAction: 'pan-y'` для горизонтального свайпа (слайдеры).

## Анимации
- `framer-motion` для page-transitions в `AppFlow` (`duration: 0.14`, `ease: [0.4, 0, 0.2, 1]`).
- Локальные CSS-анимации внутри компонентов (Welcome, OnboardingSuccess) — `@keyframes` в `<style>` теге.

## Haptic feedback
- `hapticImpact('light' | 'medium')` — тач по элементу, primary CTA.
- `hapticSelection()` — переключение таба, выбор chip.
- `hapticNotify('success' | 'error')` — после async-операции.

## Рекомендации (не реализовано)
- Вынести цвета в `lib/theme.ts` (constants), но **не** делать React Context — inline быстрее в Mini App.
- Унифицировать `Card`-обёртку (сейчас дублируется в каждом компоненте).
- См. [[30_Technical/TECHNICAL_DEBT]].

## Связанные документы
- [[SCREEN_MAP]]
- [[UX_COPY]]
- [[ASSETS_AND_REFERENCES]]
- [[30_Technical/TECHNICAL_DEBT]]

## Связанные файлы проекта
- `components/StateBlock.tsx`
- `components/BottomTabBar.tsx`
- `components/AppBg.tsx`
- `tailwind.config.ts`
- `app/globals.css`
