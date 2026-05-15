import crypto from "node:crypto";

export interface VerifiedUser {
  id: number;
  first_name?: string;
  username?: string;
}

export interface VerifyResult {
  ok: boolean;
  user?: VerifiedUser;
  error?: string;
}

const MAX_AGE_SEC = 60 * 60 * 24;

export function verifyInitData(initData: string | null | undefined): VerifyResult {
  if (!initData) return { ok: false, error: "missing initData" };
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, error: "TELEGRAM_BOT_TOKEN not set" };

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return { ok: false, error: "no hash" };
  params.delete("hash");

  const dataCheckString = Array.from(params.entries())
    .map(([k, v]) => [k, v] as [string, string])
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(token).digest();
  const expected = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  if (expected !== hash) return { ok: false, error: "bad hash" };

  const authDate = Number(params.get("auth_date"));
  if (!Number.isFinite(authDate)) return { ok: false, error: "no auth_date" };
  const ageSec = Math.floor(Date.now() / 1000) - authDate;
  if (ageSec > MAX_AGE_SEC) return { ok: false, error: "initData expired" };

  const userRaw = params.get("user");
  if (!userRaw) return { ok: false, error: "no user" };
  try {
    const user = JSON.parse(userRaw) as VerifiedUser;
    if (typeof user?.id !== "number") return { ok: false, error: "bad user" };
    return { ok: true, user };
  } catch {
    return { ok: false, error: "user json invalid" };
  }
}
