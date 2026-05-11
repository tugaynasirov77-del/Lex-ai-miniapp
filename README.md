# Lex AI — Telegram Mini App

Дашборд управления командой из 8 AI-агентов.

## Стек
- Next.js 15 (App Router) + React 19 + TypeScript
- Tailwind CSS
- Деплой: Vercel

## Запуск
```bash
npm install
npm run dev
```

## Экраны
- `/` — Команда (8 агентов, статус, кнопка "Написать")
- `/projects` — активные проекты
- `/history` — лента выполненных задач
- `/analytics` — метрики команды

Данные — mock (`lib/mockData.ts`). Подключение реального API — следующий шаг.
