/**
 * Расчёт времени публикации для одобренного черновика.
 *
 * Если у черновика есть plan_day (пн/вт/.../вс) — берём ближайшее
 * совпадение этого дня недели начиная с СЕГОДНЯ и плюсуем publish_time
 * проекта в его таймзоне. Если плана нет — публикуем сегодня в
 * следующее окно publish_time (если оно уже прошло — завтра).
 */

const DAY_KEYS: Record<string, number> = {
  пн: 1, вт: 2, ср: 3, чт: 4, пт: 5, сб: 6, вс: 0,
};

function normalizeDay(s: string): string {
  return s.toLowerCase().replace(/\.$/, "").trim();
}

/**
 * Возвращает unix-метку (мс) в UTC для следующего срабатывания (HH:MM в указанной таймзоне)
 * для конкретного дня недели (0=вс..6=сб). Если planDay не задан — ближайшее окно сегодня/завтра.
 */
export function computeScheduledAt(
  publishTime: string,
  publishTimezone: string,
  planDay: string | null | undefined,
  now: Date = new Date()
): Date {
  const [hStr, mStr] = (publishTime || "10:00").split(":");
  const hour = Math.max(0, Math.min(23, parseInt(hStr, 10) || 10));
  const minute = Math.max(0, Math.min(59, parseInt(mStr, 10) || 0));

  // Вычисляем смещение таймзоны для текущего момента через Intl
  const tzOffsetMin = timezoneOffsetMinutes(publishTimezone, now);
  // tzOffsetMin: сколько минут таймзона ВПЕРЕДИ UTC (для Europe/Moscow = 180)

  const target = planDay ? DAY_KEYS[normalizeDay(planDay)] : undefined;

  // Текущая локальная дата в целевой таймзоне
  const localNow = new Date(now.getTime() + tzOffsetMin * 60_000);
  const localY = localNow.getUTCFullYear();
  const localM = localNow.getUTCMonth();
  const localD = localNow.getUTCDate();
  const localDow = localNow.getUTCDay();

  let daysToAdd: number;
  if (target === undefined) {
    // Без plan_day: сегодня если ещё не прошло, иначе завтра
    const candidateMin = hour * 60 + minute;
    const nowMin = localNow.getUTCHours() * 60 + localNow.getUTCMinutes();
    daysToAdd = nowMin >= candidateMin ? 1 : 0;
  } else {
    daysToAdd = (target - localDow + 7) % 7;
    if (daysToAdd === 0) {
      // Сегодня нужный день — публикуем, если время не прошло
      const candidateMin = hour * 60 + minute;
      const nowMin = localNow.getUTCHours() * 60 + localNow.getUTCMinutes();
      if (nowMin >= candidateMin) daysToAdd = 7;
    }
  }

  // Собираем UTC-метку: локальное время минус смещение
  const utcMs = Date.UTC(localY, localM, localD + daysToAdd, hour, minute, 0) - tzOffsetMin * 60_000;
  return new Date(utcMs);
}

/**
 * Сколько минут указанная таймзона впереди UTC в данный момент.
 * Учитывает летнее время.
 */
function timezoneOffsetMinutes(tz: string, at: Date): number {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false,
    });
    const parts = dtf.formatToParts(at);
    const get = (t: string) => parseInt(parts.find((p) => p.type === t)?.value ?? "0", 10);
    const tzAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") === 24 ? 0 : get("hour"), get("minute"), get("second"));
    return Math.round((tzAsUtc - at.getTime()) / 60_000);
  } catch {
    return 180; // дефолт: МСК
  }
}

const DAY_RU: Record<number, string> = { 1: "пн", 2: "вт", 3: "ср", 4: "чт", 5: "пт", 6: "сб", 0: "вс" };

/** Формат «вт 10:00» в таймзоне канала — для UI. */
export function formatScheduledLabel(d: Date, tz: string): string {
  try {
    const dtf = new Intl.DateTimeFormat("ru-RU", {
      timeZone: tz,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = dtf.formatToParts(d);
    const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
    const hour = parts.find((p) => p.type === "hour")?.value ?? "";
    const min = parts.find((p) => p.type === "minute")?.value ?? "";
    return `${weekday} ${hour}:${min}`;
  } catch {
    const wd = DAY_RU[d.getUTCDay()];
    return `${wd} ${d.toISOString().slice(11, 16)}`;
  }
}
