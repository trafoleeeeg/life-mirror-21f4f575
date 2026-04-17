// Builds/refreshes user "personal dossier" — a structured psychological profile
// inferred from chat history, mood pings, check-ins, sleep and graph entities.
// Called on-demand from the Chat sidebar ("Обновить досье").
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface DossierShape {
  summary: string;
  patterns: { title: string; detail: string }[];
  themes: { title: string; detail: string }[];
  triggers: { title: string; detail: string }[];
  resources: { title: string; detail: string }[];
  values_list: { title: string; detail: string }[];
  goals: { title: string; detail: string }[];
  relationships: { title: string; detail: string }[];
  notes: string;
}

const EMPTY: DossierShape = {
  summary: "",
  patterns: [],
  themes: [],
  triggers: [],
  resources: [],
  values_list: [],
  goals: [],
  relationships: [],
  notes: "",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let userId: string | null = null;

    // Cron-mode: service role + user_id in body
    const cronSecret = req.headers.get("x-cron-secret");
    if (cronSecret && cronSecret === Deno.env.get("CRON_SECRET")) {
      const body = await req.json().catch(() => ({}));
      userId = body.user_id ?? null;
    } else {
      // User-mode: validate JWT
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: userData } = await userClient.auth.getUser();
      userId = userData?.user?.id ?? null;
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = { id: userId };

    // Gather context
    const since = new Date();
    since.setDate(since.getDate() - 60);

    const [
      { data: messages },
      { data: pings },
      { data: checkins },
      { data: sleeps },
      { data: entities },
      { data: stats },
      { data: existing },
    ] = await Promise.all([
      admin.from("chat_messages").select("role, content, created_at")
        .eq("user_id", user.id).gte("created_at", since.toISOString())
        .order("created_at", { ascending: true }).limit(400),
      admin.from("mood_pings").select("mood, activities, note, created_at")
        .eq("user_id", user.id).gte("created_at", since.toISOString()).limit(500),
      admin.from("checkins").select("mode, mood, energy, intent, tags, note, created_at")
        .eq("user_id", user.id).gte("created_at", since.toISOString()).limit(200),
      admin.from("sleep_sessions").select("duration_minutes, quality, started_at")
        .eq("user_id", user.id).gte("started_at", since.toISOString()).limit(60),
      admin.from("graph_entities").select("label, type, category, mentions")
        .eq("user_id", user.id).order("mentions", { ascending: false }).limit(40),
      admin.from("glyph_stats").select("body, mind, emotions, relationships, career, finance, creativity, meaning")
        .eq("user_id", user.id).maybeSingle(),
      admin.from("user_dossier").select("*").eq("user_id", user.id).maybeSingle(),
    ]);

    const ctx = {
      stats,
      avg_mood: pings?.length
        ? (pings.reduce((s, p) => s + p.mood, 0) / pings.length).toFixed(2)
        : null,
      mood_pings_count: pings?.length ?? 0,
      checkins_count: checkins?.length ?? 0,
      sleep_avg_hours: sleeps?.length
        ? (sleeps.reduce((s, x) => s + (x.duration_minutes ?? 0), 0) / sleeps.length / 60).toFixed(1)
        : null,
      top_activities: topCounts((pings ?? []).flatMap((p) => p.activities ?? [])),
      top_tags: topCounts((checkins ?? []).flatMap((c) => c.tags ?? [])),
      top_entities: (entities ?? []).slice(0, 25).map((e) => ({
        label: e.label,
        type: e.type,
        category: e.category,
        mentions: e.mentions,
      })),
      recent_intents: (checkins ?? [])
        .filter((c) => c.intent).slice(-15).map((c) => c.intent),
      recent_notes: (checkins ?? [])
        .filter((c) => c.note).slice(-10).map((c) => c.note),
      ping_notes: (pings ?? []).filter((p) => p.note).slice(-15).map((p) => p.note),
      chat_excerpts: (messages ?? [])
        .filter((m) => m.role === "user")
        .slice(-50)
        .map((m) => m.content.slice(0, 300)),
      existing_dossier: existing
        ? {
          summary: existing.summary,
          patterns: existing.patterns,
          themes: existing.themes,
          triggers: existing.triggers,
          resources: existing.resources,
          values: existing.values_list,
          goals: existing.goals,
          relationships: existing.relationships,
        }
        : null,
    };

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `Ты — AI-психолог. На основе контекста пользователя сформируй структурированное «Личное дело» — рабочую карточку клиента, как у живого терапевта. Только факты и наблюдения из контекста, без выдумок. По-русски.

Контекст пользователя (JSON):
${JSON.stringify(ctx, null, 2)}

Верни СТРОГО JSON по схеме:
{
  "summary": "5-8 предложений: кто этот человек прямо сейчас, что в фокусе, общее эмоциональное состояние, ключевая динамика",
  "patterns": [{"title": "короткий заголовок", "detail": "что именно повторяется и как"}],
  "themes": [{"title": "тема", "detail": "что про неё известно"}],
  "triggers": [{"title": "триггер", "detail": "что происходит после"}],
  "resources": [{"title": "ресурс/опора", "detail": "когда и как помогает"}],
  "values_list": [{"title": "ценность", "detail": "из чего видно"}],
  "goals": [{"title": "цель/намерение", "detail": "контекст"}],
  "relationships": [{"title": "имя/роль", "detail": "характер связи, динамика"}],
  "notes": "клинические заметки терапевта одним абзацем: на что обращать внимание в работе"
}

3-7 пунктов в каждом массиве, без воды. Если данных мало — оставь массив пустым.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Возвращай только валидный JSON без markdown-обёртки." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResp.ok) {
      const txt = await aiResp.text();
      return new Response(JSON.stringify({ error: "AI failed", detail: txt.slice(0, 200) }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResp.json();
    const raw = aiData.choices?.[0]?.message?.content ?? "{}";
    let parsed: DossierShape = EMPTY;
    try {
      parsed = { ...EMPTY, ...JSON.parse(raw) };
    } catch {
      // fall back
    }

    const { error: upErr } = await admin
      .from("user_dossier")
      .upsert(
        {
          user_id: user.id,
          summary: parsed.summary ?? "",
          patterns: parsed.patterns ?? [],
          themes: parsed.themes ?? [],
          triggers: parsed.triggers ?? [],
          resources: parsed.resources ?? [],
          values_list: parsed.values_list ?? [],
          goals: parsed.goals ?? [],
          relationships: parsed.relationships ?? [],
          notes: parsed.notes ?? "",
          last_auto_update_at: new Date().toISOString(),
          version: (existing?.version ?? 0) + 1,
        },
        { onConflict: "user_id" },
      );
    if (upErr) {
      return new Response(JSON.stringify({ error: upErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, dossier: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "internal" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

function topCounts(arr: string[]): { label: string; count: number }[] {
  const map = new Map<string, number>();
  for (const x of arr) map.set(x, (map.get(x) ?? 0) + 1);
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([label, count]) => ({ label, count }));
}
