// Generate AI-powered insights about a user's recent sleep sessions.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    const { data: sessions } = await admin
      .from("sleep_sessions")
      .select("started_at,ended_at,duration_minutes,quality,interruptions,avg_loudness,smart_wake")
      .eq("user_id", userId)
      .not("ended_at", "is", null)
      .order("started_at", { ascending: false })
      .limit(14);

    if (!sessions || sessions.length === 0) {
      return new Response(JSON.stringify({ insight: "Ещё нет завершённых ночей. Запиши несколько сессий — и я расскажу про твои паттерны сна." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lines = sessions.map((s) => {
      const d = new Date(s.started_at).toLocaleDateString("ru", { weekday: "short", day: "numeric", month: "short" });
      const hh = Math.floor((s.duration_minutes ?? 0) / 60);
      const mm = (s.duration_minutes ?? 0) % 60;
      return `${d}: ${hh}ч${mm}м, качество ${s.quality ?? "—"}/5, прерываний ${s.interruptions}, шум ${(Number(s.avg_loudness ?? 0) * 100).toFixed(0)}%`;
    });

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Ты — спокойный sleep-коуч. По данным последних ночей дай: 1) главную мысль о паттерне сна (1 абзац), 2) что хорошо, 3) одну точечную рекомендацию. Без воды, тепло, на 'ты', на русском, ~150 слов.",
          },
          {
            role: "user",
            content: "Последние ночи:\n" + lines.join("\n"),
          },
        ],
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI error", aiResp.status, t);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Лимит AI исчерпан, попробуй позже" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const insight = aiJson.choices?.[0]?.message?.content ?? "";

    return new Response(JSON.stringify({ insight }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[sleep-insights] error", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
