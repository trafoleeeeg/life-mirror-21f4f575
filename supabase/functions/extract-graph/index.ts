// Extract entities (people, events, topics, emotions) and edges from
// recent check-ins and chat messages, persist them into graph_entities/graph_edges.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type EntityType = "person" | "event" | "topic" | "emotion";
interface ExtractedEntity {
  type: EntityType;
  label: string;
}
interface ExtractedEdge {
  a: string; // label of A
  b: string; // label of B
  strength: number; // 0..1
}

const tools = [
  {
    type: "function",
    function: {
      name: "save_graph",
      description:
        "Извлеки именованные сущности и связи из текстов пользователя. Только реальные люди (имена), события (короткое название с датой/контекстом), темы (1-2 слова), эмоции (1 слово).",
      parameters: {
        type: "object",
        properties: {
          entities: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["person", "event", "topic", "emotion"] },
                label: { type: "string", maxLength: 60 },
              },
              required: ["type", "label"],
              additionalProperties: false,
            },
          },
          edges: {
            type: "array",
            items: {
              type: "object",
              properties: {
                a: { type: "string", maxLength: 60 },
                b: { type: "string", maxLength: 60 },
                strength: { type: "number", minimum: 0.1, maximum: 1 },
              },
              required: ["a", "b", "strength"],
              additionalProperties: false,
            },
          },
        },
        required: ["entities", "edges"],
        additionalProperties: false,
      },
    },
  },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON =
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Gather last 30 days of signal: check-ins + chat (user only).
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

    const [{ data: checkins }, { data: chats }] = await Promise.all([
      admin
        .from("checkins")
        .select("created_at, mode, intent, note, tags")
        .eq("user_id", userId)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(60),
      admin
        .from("chat_messages")
        .select("created_at, role, content")
        .eq("user_id", userId)
        .eq("role", "user")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(60),
    ]);

    const corpusParts: string[] = [];
    for (const c of checkins || []) {
      const d = new Date(c.created_at).toLocaleDateString("ru", { day: "numeric", month: "short" });
      const tags = (c.tags || []).join(", ");
      const text = [c.intent, c.note].filter(Boolean).join(" · ");
      if (text || tags) corpusParts.push(`[${d} ${c.mode}] ${text}${tags ? ` (теги: ${tags})` : ""}`);
    }
    for (const m of chats || []) {
      const d = new Date(m.created_at).toLocaleDateString("ru", { day: "numeric", month: "short" });
      corpusParts.push(`[${d} чат] ${m.content}`);
    }

    if (corpusParts.length === 0) {
      return new Response(JSON.stringify({ entities: 0, edges: 0, message: "Нет данных" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const corpus = corpusParts.slice(0, 80).join("\n");

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "Ты — экстрактор графа жизни пользователя. Из текстов вытаскивай: имена реальных людей (person), события (event, короткое название), темы жизни (topic, 1-2 слова на русском), эмоции (emotion, 1 слово). Не придумывай. Связи — только если в одном тексте упомянуты оба узла. Дубликаты схлопывай по нижнему регистру.",
          },
          {
            role: "user",
            content:
              "Тексты пользователя за последние 30 дней (каждый с своей строки):\n\n" + corpus,
          },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "save_graph" } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Лимит AI исчерпан, попробуй позже" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Закончились кредиты Lovable AI" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await aiResp.text();
      console.error("AI error", aiResp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const tc = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    if (!tc) {
      return new Response(JSON.stringify({ entities: 0, edges: 0, message: "Нет извлечений" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsed: { entities: ExtractedEntity[]; edges: ExtractedEdge[] } = { entities: [], edges: [] };
    try {
      parsed = JSON.parse(tc.function?.arguments || "{}");
    } catch {
      // ignore
    }

    // Dedup labels, normalize
    const norm = (s: string) => s.trim().toLowerCase();
    const entityMap = new Map<string, { type: EntityType; label: string }>();
    for (const e of parsed.entities || []) {
      if (!e?.label || !e?.type) continue;
      const key = `${e.type}:${norm(e.label)}`;
      if (!entityMap.has(key)) entityMap.set(key, { type: e.type, label: e.label.trim() });
    }

    // Upsert entities (manual: try insert, on conflict bump mentions)
    const labelToId = new Map<string, string>(); // norm(label) -> id
    for (const ent of entityMap.values()) {
      const { data: existing } = await admin
        .from("graph_entities")
        .select("id, mentions")
        .eq("user_id", userId)
        .eq("type", ent.type)
        .eq("label", ent.label)
        .maybeSingle();
      if (existing) {
        await admin
          .from("graph_entities")
          .update({ mentions: (existing.mentions || 1) + 1, last_seen_at: new Date().toISOString() })
          .eq("id", existing.id);
        labelToId.set(norm(ent.label), existing.id);
      } else {
        const { data: ins } = await admin
          .from("graph_entities")
          .insert({ user_id: userId, type: ent.type, label: ent.label })
          .select("id")
          .single();
        if (ins) labelToId.set(norm(ent.label), ins.id);
      }
    }

    // Edges
    let edgeCount = 0;
    for (const e of parsed.edges || []) {
      const aId = labelToId.get(norm(e.a || ""));
      const bId = labelToId.get(norm(e.b || ""));
      if (!aId || !bId || aId === bId) continue;
      // canonical order
      const [x, y] = aId < bId ? [aId, bId] : [bId, aId];
      const strength = Math.max(0.1, Math.min(1, e.strength ?? 0.5));
      const { data: existing } = await admin
        .from("graph_edges")
        .select("id, strength")
        .eq("user_id", userId)
        .eq("a_id", x)
        .eq("b_id", y)
        .maybeSingle();
      if (existing) {
        await admin
          .from("graph_edges")
          .update({
            strength: Math.min(1, Number(existing.strength) + strength * 0.3),
            last_seen_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        await admin.from("graph_edges").insert({ user_id: userId, a_id: x, b_id: y, strength });
      }
      edgeCount++;
    }

    return new Response(
      JSON.stringify({
        entities: entityMap.size,
        edges: edgeCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[extract-graph] error", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
