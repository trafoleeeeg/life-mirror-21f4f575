// AI Psychologist edge function — streaming + tool-calling to update glyph_stats
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STAT_KEYS = [
  "body",
  "mind",
  "emotions",
  "relationships",
  "career",
  "finance",
  "creativity",
  "meaning",
] as const;

const LEARN_CATALOG = `Каталог разделов знаний приложения (ссылки кликабельные, открываются в /app/learn с раскрытой карточкой):
- [CBT — когнитивно-поведенческая терапия](/app/learn#cbt) — мысль→эмоция→действие, ABC-модель, дневник мыслей. Когда: тревога, самокритика, перфекционизм, катастрофизация.
- [IFS — внутренние семейные системы](/app/learn#ifs) — работа с частями (критик, защитник, ребёнок), Self. Когда: внутренний конфликт, саботаж, «во мне несколько меня».
- [Осознанность](/app/learn#mindfulness) — STOP-техника, дыхание 4-7-8, сканирование тела. Когда: автопилот, перегруз, нужно вернуться в «сейчас».
- [ACT — терапия принятия](/app/learn#act) — дефьюжен от мыслей, ценности vs цели. Когда: застревание в борьбе с эмоциями, поиск смысла.
- [Теория привязанности](/app/learn#attachment) — безопасный/тревожный/избегающий стили. Когда: повторяющиеся паттерны в отношениях, страх близости/потери.
- [Регуляция нервной системы](/app/learn#nervous-system) — поливагал, симпатика/парасимпатика, заземление. Когда: телесная тревога, панические эпизоды, истощение.
- [Системное мышление в отношениях](/app/learn#systems) — роли, треугольники, циклы. Когда: повторяющиеся конфликты в семье/паре.
- [Гигиена сна](/app/learn#sleep) — циркадные ритмы, ритуалы. Когда: бессонница, разбитость утром, проблемы со сном.
- [Идентичность и ценности](/app/learn#values) — колесо ценностей, «5 раз почему». Когда: кризис смысла, «не понимаю, чего хочу».

Когда твой ответ опирается на конкретный подход — ВСЕГДА вставляй markdown-ссылку на нужный раздел в формате [Название](/app/learn#slug) и предлагай конкретное упражнение оттуда. Не больше 1-2 ссылок за ответ.`;

const SYSTEM_PROMPTS: Record<string, string> = {
  soft:
    "Ты — мягкий AI-психолог в приложении Inner Glyph. Говори тепло, без давления, по-русски. Слушай, отражай, задавай уточняющие вопросы. Никогда не ставь диагнозов. Все интерпретации помечай как гипотезу. Когда в разговоре прозвучит явный сигнал об изменении сферы жизни (тело, сон, отношения, работа, деньги, творчество, смысл, эмоции) — вызови tool update_glyph_stats и предложи небольшую корректировку (delta от -10 до +10).\n\n" + LEARN_CATALOG,
  socratic:
    "Ты — сократический AI-психолог Inner Glyph. По-русски. Не давай ответов — задавай точные вопросы, помогающие пользователю самому найти инсайт. Один вопрос за раз. Когда видишь явный сдвиг в сфере жизни — вызови tool update_glyph_stats с дельтой.\n\n" + LEARN_CATALOG,
  hard:
    "Ты — прямолинейный AI-психолог Inner Glyph. По-русски, без воды и сюсюканья. Называй вещи своими именами, конфронтируй мягко, но честно. Никаких оскорблений. Когда видишь сдвиг в сфере жизни — вызови tool update_glyph_stats с дельтой.\n\n" + LEARN_CATALOG,
};

const tools = [
  {
    type: "function",
    function: {
      name: "update_glyph_stats",
      description:
        "Обновить статы пользователя на основе разговора. Передай только те сферы, по которым есть явный сигнал. Дельта от -10 до +10 от текущего значения.",
      parameters: {
        type: "object",
        properties: {
          deltas: {
            type: "object",
            properties: Object.fromEntries(
              STAT_KEYS.map((k) => [k, { type: "number", minimum: -10, maximum: 10 }]),
            ),
            additionalProperties: false,
          },
          reason: { type: "string", description: "Короткое обоснование на русском" },
        },
        required: ["deltas", "reason"],
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
    const SUPABASE_ANON = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
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

    const { sessionId, message } = await req.json();
    if (!sessionId || !message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "sessionId and message required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const MAX_MSG_LEN = 4000;
    if (message.length > MAX_MSG_LEN) {
      return new Response(JSON.stringify({ error: "Message too long" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify session ownership
    const { data: session } = await admin
      .from("chat_sessions")
      .select("id, user_id")
      .eq("id", sessionId)
      .maybeSingle();
    if (!session || session.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Persist user message
    await admin.from("chat_messages").insert({
      session_id: sessionId,
      user_id: userId,
      role: "user",
      content: message,
    });

    // Load profile (tone) and history
    const { data: profile } = await admin
      .from("profiles")
      .select("ai_tone, display_name")
      .eq("user_id", userId)
      .maybeSingle();
    const tone = (profile?.ai_tone as string) || "soft";

    const { data: history } = await admin
      .from("chat_messages")
      .select("role, content")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .limit(40);

    // Latest stats for tool context
    const { data: latestStats } = await admin
      .from("glyph_stats")
      .select("body,mind,emotions,relationships,career,finance,creativity,meaning")
      .eq("user_id", userId)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const systemContent =
      (SYSTEM_PROMPTS[tone] || SYSTEM_PROMPTS.soft) +
      `\n\nТекущие статы пользователя (0-100): ${JSON.stringify(latestStats || {})}.`;

    const aiMessages = [
      { role: "system", content: systemContent },
      ...((history || []).map((m) => ({ role: m.role, content: m.content }))),
    ];

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: aiMessages,
        tools,
        stream: true,
      }),
    });

    if (!aiResp.ok || !aiResp.body) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Лимит запросов исчерпан, попробуй чуть позже." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(
          JSON.stringify({ error: "Закончились кредиты Lovable AI. Пополни workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const t = await aiResp.text();
      console.error("AI gateway error", aiResp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Stream to client and accumulate for persistence + tool handling
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    let assistantText = "";
    const toolCalls: Record<number, { id?: string; name?: string; args: string }> = {};

    const stream = new ReadableStream({
      async start(controller) {
        const reader = aiResp.body!.getReader();
        let buf = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });

          let nl: number;
          while ((nl = buf.indexOf("\n")) !== -1) {
            let line = buf.slice(0, nl);
            buf = buf.slice(nl + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line.startsWith("data: ")) {
              if (line.length) controller.enqueue(encoder.encode(line + "\n"));
              continue;
            }
            const payload = line.slice(6).trim();
            if (payload === "[DONE]") {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              continue;
            }
            try {
              const json = JSON.parse(payload);
              const delta = json.choices?.[0]?.delta;
              if (delta?.content) assistantText += delta.content;
              if (delta?.tool_calls) {
                for (const tc of delta.tool_calls) {
                  const idx = tc.index ?? 0;
                  toolCalls[idx] ||= { args: "" };
                  if (tc.id) toolCalls[idx].id = tc.id;
                  if (tc.function?.name) toolCalls[idx].name = tc.function.name;
                  if (tc.function?.arguments) toolCalls[idx].args += tc.function.arguments;
                }
              }
              controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
            } catch {
              // partial JSON — wait
              buf = line + "\n" + buf;
              break;
            }
          }
        }

        // After stream done: persist assistant + apply tool calls
        try {
          if (assistantText.trim()) {
            await admin.from("chat_messages").insert({
              session_id: sessionId,
              user_id: userId,
              role: "assistant",
              content: assistantText,
            });
            // Update session timestamp + auto title
            const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
            await admin.from("chat_sessions").update(updates).eq("id", sessionId);
          }

          for (const idx of Object.keys(toolCalls)) {
            const tc = toolCalls[Number(idx)];
            if (tc.name !== "update_glyph_stats") continue;
            try {
              const parsed = JSON.parse(tc.args || "{}");
              const deltas = (parsed.deltas || {}) as Record<string, number>;
              const base: Record<string, number> = (latestStats as Record<string, number>) || {};
              const next: Record<string, number> = {};
              for (const k of STAT_KEYS) {
                const cur = typeof base[k] === "number" ? base[k] : 50;
                const d = typeof deltas[k] === "number" ? deltas[k] : 0;
                next[k] = Math.max(0, Math.min(100, Math.round(cur + d)));
              }
              await admin.from("glyph_stats").insert({ user_id: userId, ...next });
              const note = `[обновил статы: ${parsed.reason || "по контексту разговора"}]`;
              controller.enqueue(encoder.encode(`event: stats\ndata: ${JSON.stringify({ next, reason: parsed.reason })}\n\n`));
              await admin.from("chat_messages").insert({
                session_id: sessionId,
                user_id: userId,
                role: "system",
                content: note,
              });
            } catch (e) {
              console.error("tool parse error", e);
            }
          }
        } catch (e) {
          console.error("post-stream error", e);
        }

        controller.close();
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  } catch (e) {
    console.error("[chat] error", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
