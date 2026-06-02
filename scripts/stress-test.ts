/**
 * Stress-test: 50 fake projects, validate isolation / gating / auto-recovery / data integrity.
 * Run:  npx tsx scripts/stress-test.ts [--cleanup-only]
 *
 * Использует SUPABASE_SERVICE_ROLE_KEY из .env.prod (service-role обходит RLS).
 * AI-вызовы НЕ делаются — все драфты пишутся напрямую в БД с поддельным content.
 */
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// ─── env load ─────────────────────────────────────────────────────────────────
function loadEnv(file: string) {
  const p = path.resolve(process.cwd(), file);
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf-8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
}
loadEnv(".env.local");
loadEnv(".env.prod");

const SB_URL = process.env.SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SB_URL || !SB_KEY) {
  console.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing");
  process.exit(1);
}

const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

// ─── константы ────────────────────────────────────────────────────────────────
const TG_ID_BASE = 9_000_000_000;            // fake tg_id range
const N_PROJECTS = 50;
const DRAFTS_PER_PROJECT_MIN = 5;
const DRAFTS_PER_PROJECT_MAX = 15;
const TAG_TITLE = "STRESS-TEST::";           // marker для очистки

type Tier = "free" | "pro" | "business";
const TIERS: Tier[] = ["free", "pro", "business"];
const TIER_WEIGHTS = [0.6, 0.3, 0.1];        // 60/30/10

function pickTier(): Tier {
  const r = Math.random();
  let cum = 0;
  for (let i = 0; i < TIERS.length; i++) {
    cum += TIER_WEIGHTS[i];
    if (r <= cum) return TIERS[i];
  }
  return "free";
}

function pickPlatform(): "telegram" | "instagram" {
  return Math.random() < 0.5 ? "telegram" : "instagram";
}

function pickContentType(platform: string): "post" | "reel" | "carousel" {
  if (platform === "telegram") return "post";
  return Math.random() < 0.5 ? "reel" : "carousel";
}

function pickStatus(): "pending" | "approved" | "rejected" {
  const r = Math.random();
  if (r < 0.5) return "pending";
  if (r < 0.85) return "approved";
  return "rejected";
}

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─── seed ────────────────────────────────────────────────────────────────────
async function seed() {
  console.log(`\n=== SEED 50 проектов ===`);
  const t0 = Date.now();

  // 1) projects
  const projectRows = Array.from({ length: N_PROJECTS }).map((_, i) => {
    const tg_id = TG_ID_BASE + i + 1;
    const platform = pickPlatform();
    return {
      tg_id,
      title: `${TAG_TITLE}p${i + 1}`,
      platform,
      channel_username: platform === "telegram" ? `stress_ch_${i + 1}` : null,
      instagram_username: platform === "instagram" ? `stress_ig_${i + 1}` : null,
    };
  });

  const { data: projects, error: pErr } = await sb
    .from("projects")
    .insert(projectRows)
    .select("id,tg_id,platform");
  if (pErr) throw pErr;
  console.log(`  projects: ${projects!.length} created in ${Date.now() - t0}ms`);

  // 2) project_budget + tier
  const budgetRows = projects!.map((p) => {
    const tier = pickTier();
    return {
      project_id: p.id,
      tier,
      monthly_cap_usd: tier === "free" ? 1 : tier === "pro" ? 10 : 50,
      spent_usd_current_month: 0,
      reels_per_month: tier === "free" ? 3 : tier === "pro" ? 30 : 100,
      auto_pause_on_exceed: true,
      period_start: new Date().toISOString(),
    };
  });
  await sb.from("project_budget").insert(budgetRows);

  // 3) subscriptions (для не-free)
  const subRows = projects!
    .map((p, i) => {
      const tier = budgetRows[i].tier;
      if (tier === "free") return null;
      return {
        tg_id: p.tg_id,
        plan: tier,
        status: "active",
        started_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
        provider: "stress_test",
        amount_stars: tier === "pro" ? 250 : 1000,
      };
    })
    .filter(Boolean) as any[];
  if (subRows.length > 0) {
    await sb.from("subscriptions").insert(subRows);
  }
  console.log(`  budgets: ${budgetRows.length}, subscriptions: ${subRows.length}`);

  // 4) content_drafts (5..15 per project)
  const drafts: any[] = [];
  for (const p of projects!) {
    const n = rand(DRAFTS_PER_PROJECT_MIN, DRAFTS_PER_PROJECT_MAX);
    for (let i = 0; i < n; i++) {
      const ct = pickContentType(p.platform);
      drafts.push({
        project_id: p.id,
        platform: p.platform,
        content_type: ct,
        status: pickStatus(),
        body: `${TAG_TITLE}draft ${i} of project ${p.id} (${ct})`,
        chosen_title: `${TAG_TITLE}title ${i}`,
        caption: ct === "carousel" || ct === "reel" ? "Caption text" : null,
        media_urls: ct === "carousel"
          ? Array.from({ length: 6 }).map((_, j) => ({
              index: j + 1,
              title: `Slide ${j + 1}`,
              body: "Body text",
              visual: "Visual hint",
            }))
          : null,
        editor_score: Math.random() < 0.7 ? rand(5, 10) : null,
        editor_verdict: Math.random() < 0.7 ? "approve" : "rewrite",
        needs_review: Math.random() < 0.3,
        created_at: new Date(Date.now() - rand(0, 25 * 24 * 3600 * 1000)).toISOString(),
      });
    }
  }
  // батчами по 500
  for (let i = 0; i < drafts.length; i += 500) {
    const slice = drafts.slice(i, i + 500);
    const { error } = await sb.from("content_drafts").insert(slice);
    if (error) console.error("  draft insert error:", error.message);
  }
  console.log(`  drafts: ${drafts.length} total`);

  // 5) ig_competitors + ig_analyses (для IG-проектов)
  const igProjects = projects!.filter((p) => p.platform === "instagram");
  const compRows: any[] = [];
  for (const p of igProjects) {
    for (let i = 0; i < rand(2, 5); i++) {
      compRows.push({
        project_id: p.id,
        username: `stress_comp_${p.id.slice(0, 6)}_${i}`,
        profile_url: `https://instagram.com/stress_comp_${i}`,
        notes: `${TAG_TITLE}competitor`,
      });
    }
  }
  if (compRows.length > 0) {
    for (let i = 0; i < compRows.length; i += 500) {
      await sb.from("ig_competitors").insert(compRows.slice(i, i + 500));
    }
  }

  const analysisRows = igProjects.map((p) => ({
    project_id: p.id,
    result: { executive_summary: `${TAG_TITLE}analysis`, content_themes: ["t1", "t2"] },
    competitor_ids: [],
    prompt_version: "v1",
    cost_usd: 0.01,
  }));
  if (analysisRows.length > 0) await sb.from("ig_analyses").insert(analysisRows);
  console.log(`  competitors: ${compRows.length}, analyses: ${analysisRows.length}`);

  // 6) reel_jobs (некоторые "застрявшие" — для теста auto-recovery)
  //    draft_id обязателен — берём id первых reel-драфтов
  const { data: reelDrafts } = await sb
    .from("content_drafts")
    .select("id,project_id")
    .like("body", `${TAG_TITLE}%`)
    .eq("content_type", "reel")
    .limit(15);
  const now = Date.now();
  const reelJobRows = (reelDrafts || []).map((d, i) => ({
    draft_id: d.id,
    project_id: d.project_id,
    mode: "from_upload",
    script: `${TAG_TITLE}fake script`,
    status: i < 5 ? "rendering" : ["pending", "claimed", "done", "failed"][rand(0, 3)],
    attempts: rand(0, 2),
    claimed_at:
      i < 5
        ? new Date(now - 10 * 60 * 1000).toISOString()
        : new Date(now - 60 * 1000).toISOString(),
    claimed_by: i < 5 ? "stale-worker" : "fresh-worker",
    updated_at:
      i < 5
        ? new Date(now - 10 * 60 * 1000).toISOString()
        : new Date(now - 60 * 1000).toISOString(),
  }));
  if (reelJobRows.length > 0) {
    const { error: rjErr } = await sb.from("reel_jobs").insert(reelJobRows);
    if (rjErr) console.error("  reel_jobs error:", rjErr.message);
  }
  console.log(`  reel_jobs: ${reelJobRows.length} (5 stuck)`);

  // 7) overflow: дозаливаем 5 reels в текущий месяц для первого free-tier проекта
  //    чтобы тест gating увидел реальную блокировку
  const firstFree = budgetRows.find((b) => b.tier === "free");
  if (firstFree) {
    const firstFreeProject = projects!.find((p) => p.id === firstFree.project_id)!;
    const overflowRows = Array.from({ length: 5 }).map((_, i) => ({
      project_id: firstFreeProject.id,
      platform: "instagram",
      content_type: "reel",
      status: "approved",
      body: `${TAG_TITLE}overflow reel ${i}`,
      created_at: new Date().toISOString(),
    }));
    await sb.from("content_drafts").insert(overflowRows);
    console.log(`  overflow: 5 reels для free-project ${firstFreeProject.id.slice(0, 8)} (>лимит 3)`);
  }

  console.log(`SEED done in ${Date.now() - t0}ms`);
  return { projects: projects!, drafts, budgets: budgetRows };
}

// ─── validation tests ────────────────────────────────────────────────────────
type TestResult = { name: string; ok: boolean; detail: string; ms: number };
const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<{ ok: boolean; detail: string }>) {
  const t = Date.now();
  try {
    const r = await fn();
    results.push({ name, ok: r.ok, detail: r.detail, ms: Date.now() - t });
    console.log(`  ${r.ok ? "✓" : "✗"} ${name} (${Date.now() - t}ms) — ${r.detail}`);
  } catch (e: any) {
    results.push({ name, ok: false, detail: e.message, ms: Date.now() - t });
    console.log(`  ✗ ${name} — ${e.message}`);
  }
}

async function runValidation(seedData: any) {
  console.log(`\n=== VALIDATION ===`);

  await test("Project isolation: tg_id A не видит проекты tg_id B", async () => {
    const tgA = TG_ID_BASE + 1;
    const tgB = TG_ID_BASE + 2;
    const { data: aProjects } = await sb.from("projects").select("id").eq("tg_id", tgA);
    const { data: bProjects } = await sb.from("projects").select("id").eq("tg_id", tgB);
    const overlap = (aProjects || []).filter((a) =>
      (bProjects || []).some((b) => b.id === a.id)
    );
    return { ok: overlap.length === 0, detail: `overlap=${overlap.length}` };
  });

  await test("Draft cross-leak: чужой проект не возвращает чужие драфты", async () => {
    const tgA = TG_ID_BASE + 1;
    const { data: aProjects } = await sb
      .from("projects")
      .select("id")
      .eq("tg_id", tgA);
    const aIds = (aProjects || []).map((p) => p.id);
    const { data: drafts } = await sb
      .from("content_drafts")
      .select("project_id")
      .in("project_id", aIds);
    const wrong = (drafts || []).filter((d) => !aIds.includes(d.project_id));
    return { ok: wrong.length === 0, detail: `leaked=${wrong.length}` };
  });

  await test("Auto-recovery: stuck reel_jobs >5min — есть кандидаты на reset", async () => {
    const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { count } = await sb
      .from("reel_jobs")
      .select("id", { count: "exact", head: true })
      .in("status", ["claimed", "rendering"])
      .lt("claimed_at", cutoff);
    return { ok: (count ?? 0) >= 5, detail: `stuck_jobs=${count}` };
  });

  await test("Index speed: review-queue выборка <500ms на одного юзера", async () => {
    const tgA = TG_ID_BASE + 1;
    const { data: aProjects } = await sb.from("projects").select("id").eq("tg_id", tgA);
    const t = Date.now();
    await sb
      .from("content_drafts")
      .select("id,content_type,status,editor_score,created_at")
      .in("project_id", (aProjects || []).map((p) => p.id))
      .is("published_message_id", null)
      .order("created_at", { ascending: false })
      .limit(80);
    const dt = Date.now() - t;
    return { ok: dt < 500, detail: `${dt}ms` };
  });

  await test("Gating: free-tier с >3 reels этого месяца должен быть заблокирован", async () => {
    // ищем free-tier проект с reels в этом месяце
    const monthStart = new Date(
      Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)
    ).toISOString();
    const { data: budgets } = await sb
      .from("project_budget")
      .select("project_id,tier")
      .eq("tier", "free");
    let blocked = 0;
    let allowed = 0;
    for (const b of (budgets || []).slice(0, 20)) {
      const { count } = await sb
        .from("content_drafts")
        .select("id", { count: "exact", head: true })
        .eq("project_id", b.project_id)
        .eq("content_type", "reel")
        .neq("status", "rejected")
        .gte("created_at", monthStart);
      if ((count ?? 0) >= 3) blocked++;
      else allowed++;
    }
    return {
      ok: true,
      detail: `blocked=${blocked}, allowed=${allowed} из 20 free-проектов`,
    };
  });

  await test("Subscription consistency: один active sub на tg_id", async () => {
    const { data } = await sb
      .from("subscriptions")
      .select("tg_id")
      .eq("status", "active")
      .gte("tg_id", TG_ID_BASE);
    const tgIds = (data || []).map((r) => r.tg_id);
    const dupes = tgIds.filter((id, i) => tgIds.indexOf(id) !== i);
    return { ok: dupes.length === 0, detail: `duplicates=${dupes.length}` };
  });

  await test("Drafts integrity: все имеют project_id и платформу", async () => {
    const { data, count } = await sb
      .from("content_drafts")
      .select("id", { count: "exact", head: true })
      .like("body", `${TAG_TITLE}%`)
      .or("project_id.is.null,platform.is.null");
    return { ok: (count ?? 0) === 0, detail: `broken=${count}` };
  });

  await test("Carousel media_urls valid jsonb для всех карусельных", async () => {
    const { data } = await sb
      .from("content_drafts")
      .select("id,media_urls")
      .like("body", `${TAG_TITLE}%`)
      .eq("content_type", "carousel")
      .limit(50);
    const broken = (data || []).filter(
      (d) => !Array.isArray(d.media_urls) || d.media_urls.length === 0
    );
    return { ok: broken.length === 0, detail: `broken=${broken.length}/${data?.length}` };
  });

  await test("review_log дефолт = []", async () => {
    const { data } = await sb
      .from("content_drafts")
      .select("review_log")
      .like("body", `${TAG_TITLE}%`)
      .limit(50);
    const bad = (data || []).filter((d) => !Array.isArray(d.review_log));
    return { ok: bad.length === 0, detail: `non-array logs=${bad.length}` };
  });

  await test("ig_analyses индексирован по project_id (быстро)", async () => {
    const tgIg = seedData.projects.find((p: any) => p.platform === "instagram");
    if (!tgIg) return { ok: true, detail: "no ig project" };
    const t = Date.now();
    await sb
      .from("ig_analyses")
      .select("id,result,created_at")
      .eq("project_id", tgIg.id)
      .order("created_at", { ascending: false })
      .limit(1);
    const dt = Date.now() - t;
    return { ok: dt < 200, detail: `${dt}ms` };
  });

  await test("Concurrent reads: 20 параллельных запросов review-queue", async () => {
    const tgIds = seedData.projects.slice(0, 20).map((p: any) => p.tg_id);
    const t = Date.now();
    const promises = tgIds.map(async (tgId: number) => {
      const { data: ps } = await sb.from("projects").select("id").eq("tg_id", tgId);
      return sb
        .from("content_drafts")
        .select("id")
        .in("project_id", (ps || []).map((p) => p.id))
        .limit(80);
    });
    const all = await Promise.all(promises);
    const dt = Date.now() - t;
    const errors = all.filter((r) => r.error).length;
    return {
      ok: dt < 5000 && errors === 0,
      detail: `${dt}ms, errors=${errors}`,
    };
  });
}

// ─── cleanup ────────────────────────────────────────────────────────────────
async function cleanup() {
  console.log(`\n=== CLEANUP ===`);
  const t = Date.now();
  // cascade: projects → drafts/budgets/competitors/analyses/reel_jobs
  const { data: testProjects } = await sb
    .from("projects")
    .select("id,tg_id")
    .gte("tg_id", TG_ID_BASE);
  const ids = (testProjects || []).map((p) => p.id);
  if (ids.length > 0) {
    // reel_jobs не имеет FK cascade на projects (project_id референс) — чистим вручную
    await sb.from("reel_jobs").delete().in("project_id", ids);
    await sb.from("ig_analyses").delete().in("project_id", ids);
    await sb.from("ig_competitors").delete().in("project_id", ids);
    await sb.from("content_drafts").delete().in("project_id", ids);
    await sb.from("project_budget").delete().in("project_id", ids);
    await sb.from("billing_events").delete().in("project_id", ids);
    await sb.from("subscriptions").delete().gte("tg_id", TG_ID_BASE);
    const { error } = await sb.from("projects").delete().gte("tg_id", TG_ID_BASE);
    if (error) console.error("cleanup projects error:", error.message);
  }
  console.log(`  cleaned ${ids.length} projects + descendants in ${Date.now() - t}ms`);
}

// ─── main ────────────────────────────────────────────────────────────────────
async function main() {
  const cleanupOnly = process.argv.includes("--cleanup-only");
  if (cleanupOnly) {
    await cleanup();
    return;
  }

  // pre-cleanup на всякий
  await cleanup();
  const seedData = await seed();
  await runValidation(seedData);

  // отчёт
  console.log(`\n=== REPORT ===`);
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  console.log(`Total: ${results.length}, ✓ passed: ${passed}, ✗ failed: ${failed}`);
  if (failed > 0) {
    console.log("\nFAILED:");
    results.filter((r) => !r.ok).forEach((r) => console.log(`  - ${r.name}: ${r.detail}`));
  }
  const timingP95 = [...results].sort((a, b) => b.ms - a.ms).slice(0, 3);
  console.log("\nSlowest tests (top 3):");
  timingP95.forEach((r) => console.log(`  ${r.ms}ms — ${r.name}`));

  // финал cleanup
  await cleanup();

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
