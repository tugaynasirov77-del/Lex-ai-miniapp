const TOKEN = () => process.env.TELEGRAM_BOT_TOKEN;
const BASE = () => `https://api.telegram.org/bot${TOKEN()}`;

async function call<T>(method: string, payload?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${BASE()}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: payload ? JSON.stringify(payload) : undefined,
    cache: "no-store",
  });
  const j = await res.json();
  if (!j.ok) throw new Error(j.description || `tg api ${method} failed`);
  return j.result as T;
}

export type TgChat = {
  id: number;
  type: string;
  title?: string;
  username?: string;
};

export type TgChatMember = {
  status: "creator" | "administrator" | "member" | "restricted" | "left" | "kicked";
  user: { id: number; username?: string; is_bot?: boolean };
};

export async function getChat(usernameOrId: string | number): Promise<TgChat> {
  const chat_id = typeof usernameOrId === "string" && !usernameOrId.startsWith("@") ? `@${usernameOrId}` : usernameOrId;
  return call<TgChat>("getChat", { chat_id });
}

export async function getChatMembersCount(chatId: number | string): Promise<number> {
  return call<number>("getChatMemberCount", { chat_id: chatId });
}

export async function getMe(): Promise<{ id: number; username?: string }> {
  return call<{ id: number; username?: string }>("getMe");
}

export async function getChatMember(chatId: number | string, userId: number): Promise<TgChatMember> {
  return call<TgChatMember>("getChatMember", { chat_id: chatId, user_id: userId });
}

export function normalizeUsername(input: string): string {
  let s = input.trim();
  if (s.startsWith("https://t.me/")) s = s.slice("https://t.me/".length);
  if (s.startsWith("t.me/")) s = s.slice("t.me/".length);
  if (s.startsWith("@")) s = s.slice(1);
  return s.replace(/\/$/, "");
}
