"use client";
import { useCallback, useEffect, useState } from "react";

type TierConfig = {
  tier: "free" | "pro" | "business";
  label: string;
  priceStars: number;
  priceRub: number;
  reelsPerMonth: number;
  carouselsPerMonth: number;
  plansPerWeek: number;
  analysesPerMonth: number;
  maxProjects: number;
  monthlyCapUsd: number;
  features: string[];
};

type BillingState = {
  tier: TierConfig["tier"];
  current_config: TierConfig;
  subscription: any;
  usage: null | {
    reels: number;
    carousels: number;
    plans_this_week: number;
    analyses: number;
  };
  available_tiers: TierConfig[];
};

function initData(): string {
  if (typeof window === "undefined") return "";
  return (window as any).Telegram?.WebApp?.initData || "";
}

export default function BillingPage() {
  const [state, setState] = useState<BillingState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const projectId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("project_id") : null;

  const load = useCallback(async () => {
    setError(null);
    try {
      const url = projectId ? `/api/billing?project_id=${projectId}` : "/api/billing";
      const r = await fetch(url, { headers: { "x-telegram-init-data": initData() }, cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "fail");
      setState(d);
    } catch (e: any) {
      setError(e.message);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const upgrade = async (tier: "pro" | "business") => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/billing/upgrade", {
        method: "POST",
        headers: { "content-type": "application/json", "x-telegram-init-data": initData() },
        body: JSON.stringify({ tier }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "fail");

      const tg = (window as any).Telegram?.WebApp;
      if (!tg?.openInvoice) {
        // fallback — открываем ссылку напрямую
        window.open(d.invoice_url, "_blank");
        setBusy(false);
        return;
      }
      tg.openInvoice(d.invoice_url, async (status: string) => {
        if (status === "paid") {
          try {
            await fetch("/api/billing/confirm", {
              method: "POST",
              headers: { "content-type": "application/json", "x-telegram-init-data": initData() },
              body: JSON.stringify({ payload: d.payload }),
            });
            await load();
          } catch (e: any) {
            setError("Платёж прошёл, но не удалось подтвердить: " + e.message);
          }
        } else if (status === "failed") {
          setError("Платёж не прошёл");
        } else if (status === "cancelled") {
          /* silent */
        }
        setBusy(false);
      });
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  };

  if (!state) {
    return (
      <div className="min-h-screen bg-black p-4 text-white">
        {error ? <div className="text-rose-300 text-sm">{error}</div> : <div className="text-zinc-500 text-sm">Загружаю…</div>}
      </div>
    );
  }

  const cur = state.current_config;
  const usage = state.usage;
  const sub = state.subscription;

  return (
    <div className="min-h-screen bg-black pb-24 text-white">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-black/95 px-4 py-3 backdrop-blur">
        <h1 className="text-lg font-semibold">Подписка</h1>
        <p className="text-xs text-zinc-400 mt-0.5">Текущий тариф: <b>{cur.label}</b></p>
      </header>

      <main className="px-4 py-3 space-y-4">
        {error && (
          <div className="rounded bg-rose-500/10 p-3 text-sm text-rose-300">{error}</div>
        )}

        {sub && sub.expires_at && (
          <div className="rounded bg-zinc-900 p-3 text-xs">
            <div>Статус: <b>{sub.status}</b></div>
            <div>До: {new Date(sub.expires_at).toLocaleDateString("ru-RU")}</div>
            {sub.amount_stars > 0 && <div>Оплачено: ⭐ {sub.amount_stars}</div>}
          </div>
        )}

        {usage && (
          <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-2">
            <h2 className="text-sm font-semibold mb-2">Использование</h2>
            <UsageRow label="Reels (мес)" used={usage.reels} limit={cur.reelsPerMonth} />
            <UsageRow label="Карусели (мес)" used={usage.carousels} limit={cur.carouselsPerMonth} />
            <UsageRow label="Планы (нед)" used={usage.plans_this_week} limit={cur.plansPerWeek} />
            <UsageRow label="Анализы (мес)" used={usage.analyses} limit={cur.analysesPerMonth} />
          </section>
        )}

        <section className="space-y-3">
          {state.available_tiers.map((t) => (
            <TierCard
              key={t.tier}
              tier={t}
              current={t.tier === state.tier}
              canUpgrade={t.tier !== "free" && t.tier !== state.tier}
              onUpgrade={() => upgrade(t.tier as "pro" | "business")}
              busy={busy}
            />
          ))}
        </section>

        <p className="text-[10px] text-zinc-600 text-center">
          Оплата картой ₽ (ЮKassa) или Telegram Stars. Подписка на 30 дней без автопродления.
        </p>
      </main>
    </div>
  );
}

function UsageRow({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const over = used >= limit;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-zinc-300">{label}</span>
        <span className={over ? "text-rose-400" : "text-zinc-400"}>{used}/{limit >= 999 ? "∞" : limit}</span>
      </div>
      <div className="h-1 rounded bg-zinc-800 overflow-hidden">
        <div
          className={`h-full transition-all ${over ? "bg-rose-500" : "bg-emerald-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function TierCard({
  tier,
  current,
  canUpgrade,
  onUpgrade,
  busy,
}: {
  tier: TierConfig;
  current: boolean;
  canUpgrade: boolean;
  onUpgrade: () => void;
  busy: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 ${current ? "border-emerald-500/40 bg-emerald-500/5" : "border-zinc-800 bg-zinc-900"}`}>
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-base font-semibold">{tier.label}</h3>
        <div className="text-right">
          {tier.priceRub > 0 ? (
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-base font-semibold">
                {tier.priceRub} ₽
                <span className="text-[10px] text-zinc-500 font-normal"> / 30 дн</span>
              </span>
              <span className="text-[10px] text-zinc-500">
                или ⭐ {tier.priceStars}
              </span>
            </div>
          ) : (
            <span className="text-xs text-zinc-500">бесплатно</span>
          )}
        </div>
      </div>
      <ul className="space-y-1 mb-3">
        {tier.features.map((f, i) => (
          <li key={i} className="text-xs text-zinc-300">· {f}</li>
        ))}
      </ul>
      {current && <div className="text-xs text-emerald-400">✓ Текущий тариф</div>}
      {canUpgrade && (
        <button
          disabled={busy}
          onClick={onUpgrade}
          className="w-full rounded-lg bg-emerald-600 py-2 text-sm font-medium disabled:opacity-50"
        >
          {busy ? "Открываю оплату…" : `Оплатить ${tier.priceRub} ₽`}
        </button>
      )}
    </div>
  );
}
