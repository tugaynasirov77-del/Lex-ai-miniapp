// Парсер публичной превью-страницы t.me/s/CHANNEL — бесплатно, без MTProto
// Возвращает массив последних постов с просмотрами

export type ParsedPost = {
  message_id: number;
  text: string;
  views: number | null;
  has_media: boolean;
  published_at: string | null;
  forwarded_from: string | null;
};

function parseViews(s: string): number | null {
  const t = s.trim().toUpperCase();
  const m = t.match(/^([\d.,]+)\s*([KMB]?)/);
  if (!m) return null;
  const base = parseFloat(m[1].replace(",", "."));
  if (isNaN(base)) return null;
  const mult = m[2] === "K" ? 1_000 : m[2] === "M" ? 1_000_000 : m[2] === "B" ? 1_000_000_000 : 1;
  return Math.round(base * mult);
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

export type ChannelMeta = {
  title: string | null;
  subscribers: number | null;
  description: string | null;
};

export async function fetchChannelMeta(username: string): Promise<ChannelMeta> {
  const res = await fetch(`https://t.me/${encodeURIComponent(username)}`, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; LEX-AI-Scout/1.0)" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`t.me meta HTTP ${res.status}`);
  const html = await res.text();

  const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
  const descMatch = html.match(/<meta property="og:description" content="([^"]+)"/);
  const subsMatch = html.match(/<div class="tgme_page_extra">([^<]+)<\/div>/);

  let subscribers: number | null = null;
  if (subsMatch) {
    const txt = subsMatch[1].replace(/[ \s]+/g, " ").trim();
    const m = txt.match(/([\d\s,.]+)\s*(?:subscriber|подписчик|members|участник)/i);
    if (m) subscribers = parseInt(m[1].replace(/[^\d]/g, ""), 10) || null;
  }

  return {
    title: titleMatch ? titleMatch[1].trim() : null,
    subscribers,
    description: descMatch ? descMatch[1].trim() : null,
  };
}

export async function fetchChannelPreview(username: string): Promise<ParsedPost[]> {
  const url = `https://t.me/s/${encodeURIComponent(username)}`;
  const res = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; LEX-AI-Analyst/1.0)",
      "accept-language": "ru,en;q=0.9",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`t.me HTTP ${res.status}`);
  const html = await res.text();

  const posts: ParsedPost[] = [];
  const startRe = /<div class="tgme_widget_message_wrap[^"]*"[^>]*>/g;
  const starts: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = startRe.exec(html))) starts.push(m.index);

  for (let i = 0; i < starts.length; i++) {
    const from = starts[i];
    const to = i + 1 < starts.length ? starts[i + 1] : html.length;
    const chunk = html.slice(from, to);

    const idMatch = chunk.match(/data-post="[^/"]+\/(\d+)"/);
    if (!idMatch) continue;
    const message_id = parseInt(idMatch[1], 10);

    const textMatch = chunk.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<div class="tgme_widget_message_(?:footer|reply|info)|<time)/);
    const text = textMatch ? stripHtml(textMatch[1]) : "";

    const viewsMatch = chunk.match(/<span class="tgme_widget_message_views">([^<]+)<\/span>/);
    const views = viewsMatch ? parseViews(viewsMatch[1]) : null;

    const dateMatch = chunk.match(/<time[^>]+datetime="([^"]+)"/);
    const published_at = dateMatch ? dateMatch[1] : null;

    const has_media =
      /tgme_widget_message_photo_wrap|tgme_widget_message_video|tgme_widget_message_document/.test(chunk);

    const fwdMatch = chunk.match(/tgme_widget_message_forwarded_from_name[^"]*"[^>]*href="https?:\/\/t\.me\/([^/"?#]+)/);
    const forwarded_from = fwdMatch ? fwdMatch[1] : null;

    posts.push({ message_id, text: text.slice(0, 4000), views, has_media, published_at, forwarded_from });
  }

  return posts;
}
