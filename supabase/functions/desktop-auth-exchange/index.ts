// Desktop OAuth handoff:
//  - action=create: вызывается из браузера авторизованным юзером, генерирует одноразовый код и сохраняет токены
//  - action=consume: вызывается из .exe (без auth), обменивает код на access/refresh токены
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function genCode(): string {
  // 32 символа base64url
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // best-effort cleanup
    admin.rpc("cleanup_expired_desktop_codes").then(() => {}).catch(() => {});

    if (action === "create") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "no auth" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Получаем user_id из JWT
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: userRes } = await userClient.auth.getUser();
      const user = userRes?.user;
      if (!user) {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await req.json().catch(() => ({}));
      const access_token: string | undefined = body?.access_token;
      const refresh_token: string | undefined = body?.refresh_token;
      if (!access_token || !refresh_token) {
        return new Response(JSON.stringify({ error: "missing tokens" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const code = genCode();
      const { error } = await admin.from("desktop_auth_codes").insert({
        code,
        user_id: user.id,
        access_token,
        refresh_token,
      });
      if (error) throw error;

      return new Response(JSON.stringify({ code }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "consume") {
      const body = await req.json().catch(() => ({}));
      const code: string | undefined = body?.code;
      if (!code || typeof code !== "string" || code.length < 16) {
        return new Response(JSON.stringify({ error: "bad code" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await admin
        .from("desktop_auth_codes")
        .select("id, access_token, refresh_token, expires_at, consumed_at")
        .eq("code", code)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        return new Response(JSON.stringify({ error: "code not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (data.consumed_at) {
        return new Response(JSON.stringify({ error: "code already used" }), {
          status: 410,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (new Date(data.expires_at).getTime() < Date.now()) {
        return new Response(JSON.stringify({ error: "code expired" }), {
          status: 410,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Помечаем как использованный и удаляем (одноразовый)
      await admin.from("desktop_auth_codes").delete().eq("id", data.id);

      return new Response(
        JSON.stringify({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ error: "unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[desktop-auth-exchange] error", e);
    return new Response(JSON.stringify({ error: "internal" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
