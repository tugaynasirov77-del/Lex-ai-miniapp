import Anthropic from "@anthropic-ai/sdk";
import type { BrandKit } from "./lexAI";
import type { ProjectContext } from "./topicAdapter";

const MODEL = "claude-haiku-4-5-20251001";

export type DailyIdea = {
  title: string;     // короткая идея для Reels (как на карточке)
  category: string;  // под-ниша / рубрика (1-2 слова)
  tag: string;       // "Популярно" | "Тренд" | "Высокий охват" | ...
  hook: string;      // фраза первой секунды (seed для генератора сценария)
};

const TAGS = ["Популярно", "Тренд", "Высокий охват"];

function buildPrompt(brand: BrandKit | null, ctx: ProjectContext): string {
  const niche = ctx.niche || brand?.short_description || "Instagram-блог";
  const audience = ctx.audience || brand?.audience || "широкая аудитория";
  const style = ctx.content_style || brand?.voice || "не задано";
  const goal = ctx.content_goal || (brand?.goals || []).join(", ") || "рост охватов";

  return `Ты — креативный директор для Instagram-блогеров. Придумай 3 свежие идеи для Reels на сегодня под конкретный проект.

Проект автора:
- Ниша: ${niche}
- Аудитория: ${audience}
- Стиль подачи: ${style}
- Цель: ${goal}

ЗАДАЧА:
Дай 3 РАЗНЫХ идеи Reels, которые автор может снять сегодня. Идеи должны быть конкретными под нишу, не банальными, цепляющими. Каждая использует рабочий вирусный формат (ошибка/провал, закулисье процесса, быстрые советы, разрушение мифа, до-после и т.п.) — но переложи на нишу автора.

Правила полей:
- title — короткая формулировка идеи, как на карточке (4-9 слов, без кавычек)
- category — рубрика 1-2 слова под нишу (например "Бизнес", "Личный бренд", "Лайфстайл")
- hook — фраза первой секунды Reels, которую автор скажет/покажет (8-18 слов, цепляет сразу)

Верни СТРОГО JSON без markdown:
{
  "ideas": [
    { "title": "...", "category": "...", "hook": "..." },
    { "title": "...", "category": "...", "hook": "..." },
    { "title": "...", "category": "...", "hook": "..." }
  ]
}`;
}

export async function generateDailyIdeas(args: {
  brand: BrandKit | null;
  projectCtx: ProjectContext;
}): Promise<DailyIdea[]> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const prompt = buildPrompt(args.brand, args.projectCtx);

  const r = await client.messages.create({
    model: MODEL,
    max_tokens: 900,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = r.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("AI вернул некорректный ответ");

  const parsed = JSON.parse(m[0]) as { ideas: Omit<DailyIdea, "tag">[] };
  const ideas = (parsed.ideas || []).slice(0, 3).map((t, i) => ({
    title: String(t.title || "").trim(),
    category: String(t.category || "").trim(),
    hook: String(t.hook || "").trim(),
    tag: TAGS[i % TAGS.length],
  }));

  if (ideas.length < 1) throw new Error("AI не вернул ни одной идеи");
  return ideas;
}
