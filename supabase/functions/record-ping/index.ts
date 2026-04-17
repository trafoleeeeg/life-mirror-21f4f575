import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PingBody {
  mood: number;
  emoji?: string;
  activities?: string[];
  note?: string;
  source?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "no auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as PingBody;
    const mood = Number(body?.mood);
    if (!Number.isFinite(mood) || mood < 1 || mood > 10) {
      return new Response(JSON.stringify({ error: "mood 1..10 required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const activities = Array.isArray(body.activities)
      ? body.activities.slice(0, 12).map((s) => String(s).slice(0, 60))
      : [];
    const note = body.note ? String(body.note).slice(0, 500) : null;
    const emoji = body.emoji ? String(body.emoji).slice(0, 8) : null;
    const source = body.source ? String(body.source).slice(0, 30) : "manual";

    const { data, error } = await supabase
      .from("mood_pings")
      .insert({
        user_id: user.id,
        mood,
        emoji,
        activities,
        note,
        source,
      })
      .select()
      .single();
    if (error) throw error;

    // bump quick_actions usage
    if (activities.length) {
      await supabase.rpc("noop").catch(() => undefined); // no-op placeholder
      for (const label of activities) {
        await supabase
          .from("quick_actions")
          .upsert(
            { user_id: user.id, label, emoji: "✨", use_count: 1 },
            { onConflict: "user_id,label", ignoreDuplicates: false },
          );
      }
    }

    return new Response(JSON.stringify({ ok: true, ping: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[record-ping] error", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
