export type AgentStatus = "online" | "offline";

export interface Agent {
  id: string;
  name: string;
  role: string;
  emoji: string;
  avatar: string;
  status: AgentStatus;
  lastActive: string; // human-readable
  botUsername: string; // tg username for deep link
}

export const AGENTS: Agent[] = [
  { id: "andrey", name: "Андрей", role: "Оркестратор — координирует команду", emoji: "🧠", avatar: "/agents/andrey.jpg", status: "online", lastActive: "только что", botUsername: "orkestrator1_bot" },
  { id: "milena", name: "Милена", role: "Маркетолог — стратегия и кампании", emoji: "📣", avatar: "/agents/milena.jpg", status: "online", lastActive: "5 мин назад", botUsername: "milena_mark1_bot" },
  { id: "alexander", name: "Александр", role: "Стратег — долгосрочное планирование", emoji: "♟️", avatar: "/agents/alexander.jpg", status: "online", lastActive: "12 мин назад", botUsername: "Strateg_alex_bot" },
  { id: "alina", name: "Алина", role: "Копирайтер — тексты и сторителлинг", emoji: "✍️", avatar: "/agents/alina.jpg", status: "offline", lastActive: "1 час назад", botUsername: "Alina_write1_bot" },
  { id: "mikhail", name: "Михаил", role: "Кодер — разработка и автоматизация", emoji: "💻", avatar: "/agents/mikhail.jpg", status: "online", lastActive: "2 мин назад", botUsername: "Misha_koder1_bot" },
  { id: "nikolay", name: "Николай", role: "Аналитик — данные и метрики", emoji: "📊", avatar: "/agents/nikolay.jpg", status: "online", lastActive: "20 мин назад", botUsername: "Researcher11_bot" },
  { id: "viktor", name: "Виктор", role: "Продажи — лиды и переговоры", emoji: "🤝", avatar: "/agents/viktor.jpg", status: "offline", lastActive: "3 часа назад", botUsername: "viktor_prodashi1_bot" },
  { id: "arkadiy", name: "Аркадий", role: "Критик — проверка и качество", emoji: "🔍", avatar: "/agents/arkadiy.jpg", status: "online", lastActive: "8 мин назад", botUsername: "critik_arkasha_bot" },
];

export type ProjectStatus = "in_progress" | "done" | "paused";

export interface Project {
  id: string;
  title: string;
  status: ProjectStatus;
  agents: string[]; // agent ids who participated
  createdAt: string;
  progress: number; // 0..100
}

export const PROJECTS: Project[] = [
  { id: "p1", title: "Запуск Telegram-воронки", status: "in_progress", agents: ["andrey", "mikhail", "milena"], createdAt: "Сегодня, 14:20", progress: 60 },
  { id: "p2", title: "Контент-план на май", status: "done", agents: ["alina", "milena", "arkadiy"], createdAt: "Вчера", progress: 100 },
  { id: "p3", title: "Анализ 12 конкурентов", status: "in_progress", agents: ["nikolay", "alexander", "arkadiy"], createdAt: "28 апр", progress: 45 },
  { id: "p4", title: "Лендинг для B2B продукта", status: "in_progress", agents: ["alexander", "alina", "mikhail"], createdAt: "25 апр", progress: 35 },
  { id: "p5", title: "Аудит воронки продаж", status: "paused", agents: ["nikolay", "viktor"], createdAt: "20 апр", progress: 50 },
];

export type Feedback = "up" | "down" | null;

export interface TaskHistoryItem {
  id: string;
  agentId: string;
  description: string;
  finishedAt: string; // human readable
  durationMin: number;
  feedback: Feedback;
}

export const HISTORY: TaskHistoryItem[] = [
  { id: "t1", agentId: "alina", description: "Написала 3 поста для Instagram", finishedAt: "10 мин назад", durationMin: 8, feedback: "up" },
  { id: "t2", agentId: "nikolay", description: "Собрал отчёт по конверсии за неделю", finishedAt: "32 мин назад", durationMin: 12, feedback: "up" },
  { id: "t3", agentId: "mikhail", description: "Починил баг в форме регистрации", finishedAt: "1 час назад", durationMin: 25, feedback: "up" },
  { id: "t4", agentId: "milena", description: "Подготовила бриф для рекламы", finishedAt: "2 часа назад", durationMin: 15, feedback: null },
  { id: "t5", agentId: "viktor", description: "Обработал 4 входящих лида", finishedAt: "3 часа назад", durationMin: 20, feedback: "down" },
  { id: "t6", agentId: "arkadiy", description: "Проверил тексты лендинга", finishedAt: "4 часа назад", durationMin: 7, feedback: "up" },
  { id: "t7", agentId: "alexander", description: "Подготовил roadmap на квартал", finishedAt: "вчера", durationMin: 45, feedback: "up" },
  { id: "t8", agentId: "andrey", description: "Разрулил конфликт задач между агентами", finishedAt: "вчера", durationMin: 5, feedback: "up" },
  { id: "t9", agentId: "alina", description: "Переписала email-рассылку", finishedAt: "2 дня назад", durationMin: 18, feedback: "up" },
  { id: "t10", agentId: "nikolay", description: "Сделал когортный анализ", finishedAt: "2 дня назад", durationMin: 30, feedback: null },
];

export interface ActiveTask {
  id: string;
  agentId: string;
  description: string;
  progress: number;
}

export const ACTIVE_TASKS: ActiveTask[] = [
  { id: "a1", agentId: "nikolay", description: "Подготовка анализа конкурентов", progress: 68 },
];

export const ANALYTICS = {
  totalTasks: 247,
  todayTasks: 18,
  weekTasks: 96,
  topAgentId: "alina",
  avgResponseSec: 14,
};

export function getAgent(id: string) {
  return AGENTS.find((a) => a.id === id);
}
