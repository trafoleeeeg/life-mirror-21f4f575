// Генерирует AI-«дилемму дня» в ленту на основе свежих чек-инов сообщества.
// Запускается по cron каждый час.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CATEGORIES = ["дилемма", "вопрос", "наблюдение"] as const;
const AI_AUTHORS = [
  "AI · Дилемма дня",
  "AI · Вопрос на подумать",
  "AI · Наблюдение",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const CRON_SECRET = Deno.env.get("CRON_SECRET");

    // Простая защита: либо запрос с CRON секретом, либо ручной запуск с тем же
    const auth = req.headers.get("authorization") || "";
    const xCron = req.headers.get("x-cron-secret") || "";
    const isCron = CRON_SECRET && (auth.includes(CRON_SECRET) || xCron === CRON_SECRET);
    if (!isCron) {
      // Разрешим ручной вызов при отсутствии секрета — но только если переменной нет
      if (CRON_SECRET) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Контекст: топ-теги из чек-инов и среднее настроение за 7 дней
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [{ data: checkins }, { data: pings }, { data: entities }] = await Promise.all([
      admin
        .from("checkins")
        .select("tags,note")
        .gte("created_at", since)
        .limit(200),
      admin
        .from("mood_pings")
        .select("mood,activities")
        .gte("created_at", since)
        .limit(500),
      admin
        .from("graph_entities")
        .select("label,mentions,category")
        .order("mentions", { ascending: false })
        .limit(20),
    ]);

    const tagCount = new Map<string, number>();
    (checkins || []).forEach((c) =>
      (c.tags || []).forEach((t: string) => tagCount.set(t, (tagCount.get(t) || 0) + 1)),
    );
    (pings || []).forEach((p) =>
      (p.activities || []).forEach((t: string) => tagCount.set(t, (tagCount.get(t) || 0) + 1)),
    );
    const topTags = [...tagCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([t]) => t);

    const moods = (pings || []).map((p) => p.mood).filter((x: number) => typeof x === "number");
    const avgMood = moods.length ? moods.reduce((a: number, b: number) => a + b, 0) / moods.length : null;

    const topEntities = (entities || []).slice(0, 8).map((e) => e.label);

    // Чтобы не повторяться: последние 6 AI-постов
    const { data: recent } = await admin
      .from("posts")
      .select("content")
      .eq("is_ai", true)
      .order("created_at", { ascending: false })
      .limit(6);
    const recentText = (recent || []).map((r, i) => `${i + 1}. ${r.content.slice(0, 120)}…`).join("\n");

    const cat = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
    const author = AI_AUTHORS[CATEGORIES.indexOf(cat)];

    const sysPrompt = `Ты — анонимный AI-собеседник в приложении самопознания Inner Glyph. Твоя задача — публиковать в общую ленту короткие провокационные тексты в категории «${cat}», которые цепляют, заставляют людей задуматься и хочется ответить.

Правила:
- ТОЛЬКО на русском.
- 2–4 коротких абзаца, всего 60–180 слов.
- Без морали и советов. Только живая ситуация + честный вопрос в конце.
- Никаких клише типа «давайте обсудим», «как вы думаете», «поделитесь в комментариях».
- Без эмодзи и хештегов.
- Тон: умный друг, не коуч и не психолог.
- Не повторяй темы и формулировки из недавних постов.

Категория «${cat}»:
- дилемма: реальная ситуация с двумя плохими/непонятными выборами. Заканчивается «что бы ты выбрал и почему».
- вопрос: один точный вопрос про внутренний опыт, на который сложно ответить сразу.
- наблюдение: короткое замечание про человеческую природу + неожиданный поворот в конце.`;

    const userPrompt = `Контекст сообщества за 7 дней:
- Топ-темы из чек-инов: ${topTags.join(", ") || "(нет данных)"}
- Топ-сущности в графах: ${topEntities.join(", ") || "(нет данных)"}
- Среднее настроение: ${avgMood !== null ? avgMood.toFixed(1) + "/10" : "(нет данных)"}

Недавние AI-посты (НЕ повторяй их темы):
${recentText || "(нет)"}

Сгенерируй ОДИН пост в категории «${cat}». Опирайся на топ-темы, но не упоминай их как "статистику" — переплавь в живую ситуацию. Верни только текст поста, без заголовков и кавычек.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: sysPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI gateway error", aiResp.status, t);
      return new Response(JSON.stringify({ error: "AI error", status: aiResp.status }), {
        status: aiResp.status === 429 || aiResp.status === 402 ? aiResp.status : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const content = (aiJson.choices?.[0]?.message?.content || "").trim();
    if (!content) throw new Error("Empty AI response");

    const { data: inserted, error: insErr } = await admin
      .from("posts")
      .insert({
        user_id: null,
        is_ai: true,
        ai_author: author,
        category: cat,
        content,
      })
      .select("id")
      .single();

    if (insErr) {
      console.error("insert error", insErr);
      throw insErr;
    }

    return new Response(JSON.stringify({ ok: true, id: inserted?.id, category: cat }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[generate-dilemma]", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
