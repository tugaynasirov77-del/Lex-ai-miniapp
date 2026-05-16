import { getSupabase } from "./supabase";
import { fetchChannelMeta, fetchChannelPreview } from "./parseTmePreview";

export async function syncCompetitor(projectId: string, username: string) {
  const sb = getSupabase();
  const u = username.replace(/^@/, "").trim();
  if (!u) throw new Error("username required");

  const [meta, posts] = await Promise.all([
    fetchChannelMeta(u),
    fetchChannelPreview(u).catch(() => []),
  ]);

  const top = posts
    .filter((p) => p.views !== null)
    .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))[0];

  const { data, error } = await sb
    .from("competitor_channels")
    .upsert(
      {
        project_id: projectId,
        username: u,
        title: meta.title,
        subscribers: meta.subscribers,
        posts_count: posts.length,
        top_post_message_id: top?.message_id ?? null,
        top_post_views: top?.views ?? null,
        top_post_text: top ? (top.text || "").slice(0, 300) : null,
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: "project_id,username" }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}
