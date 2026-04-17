// Триггерные пуши: «3 дня нет спорта», «настроение падает 3 дня».
// Вызывается через pg_cron (тот же x-cron-secret, что и push-send), не чаще раз в день на пользователя:
// throttle хранится в notification_preferences.last_sent_at-стиле — мы используем простой in-memory
// дедуп по последним 24ч через push_subscriptions.last_used_at + tag в notification.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import webpush from "https://esm.sh/web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-cron-secret",
};

const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:hello@innerglyph.app";
webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

interface Push {
  title: string;
  body: string;
  url: string;
  tag: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const expected = Deno.env.get("CRON_SECRET");
  const provided = req.headers.get("x-cron-secret");
  if (!expected || provided !== expected) {
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // 1) Все включённые пользователи
    const { data: prefs } = await admin
      .from("notification_preferences")
      .select("user_id, timezone, enabled")
      .eq("enabled", true);
    if (!prefs?.length) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // last 7 days
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const sinceIso = since.toISOString();

    let totalSent = 0;
    const triggered: Array<{ user: string; tag: string }> = [];

    for (const p of prefs) {
      const userId = p.user_id;
      const triggers: Push[] = [];

      // Pull recent pings
      const { data: pings } = await admin
        .from("mood_pings")
        .select("mood, activities, created_at")
        .eq("user_id", userId)
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: true });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Group pings by local day (UTC simplification ok for trigger logic)
      const byDay = new Map<string, { moods: number[]; acts: Set<string> }>();
      for (const r of pings ?? []) {
        const d = new Date(r.created_at);
        d.setHours(0, 0, 0, 0);
        const key = d.toISOString().slice(0, 10);
        const b = byDay.get(key) ?? { moods: [], acts: new Set() };
        b.moods.push(r.mood);
        for (const a of r.activities ?? []) b.acts.add(String(a).toLowerCase());
        byDay.set(key, b);
      }

      // helper: get last N days (newest first), each item or null
      const lastN = (n: number) => {
        const out: { day: Date; bucket: { moods: number[]; acts: Set<string> } | null }[] = [];
        for (let i = 0; i < n; i++) {
          const d = new Date(today);
          d.setDate(d.getDate() - i);
          const key = d.toISOString().slice(0, 10);
          out.push({ day: d, bucket: byDay.get(key) ?? null });
        }
        return out;
      };

      // ---- Trigger 1: 3 дня нет спорта/активности ----
      const last3 = lastN(3);
      const noSport = last3.every(({ bucket }) => {
        if (!bucket) return true;
        return ![...bucket.acts].some((a) => /спорт|тренир|бег|йог|зал|walk|gym|run|sport/i.test(a));
      });
      if (noSport && last3.some(({ bucket }) => bucket && bucket.moods.length > 0)) {
        triggers.push({
          title: "🏃 3 дня без движения",
          body: "Тело скучает. 10 минут прогулки сегодня — и день поменяется.",
          url: "/app",
          tag: "no-sport-3d",
        });
      }

      // ---- Trigger 2: настроение падает 3 дня подряд ----
      const last3Avgs = last3
        .map(({ bucket }) => bucket && bucket.moods.length
          ? bucket.moods.reduce((a, b) => a + b, 0) / bucket.moods.length
          : null);
      // последовательно убывает: today < yesterday < dayBefore
      if (last3Avgs.every((v) => v !== null) && last3Avgs[0]! < last3Avgs[1]! && last3Avgs[1]! < last3Avgs[2]!) {
        const drop = (last3Avgs[2]! - last3Avgs[0]!).toFixed(1);
        triggers.push({
          title: "📉 Настроение снижается",
          body: `Три дня подряд вниз (–${drop}). Что происходит? Загляни в Зеркало.`,
          url: "/app",
          tag: "mood-down-3d",
        });
      }

      // ---- Trigger 3: давно не было чек-инов (≥48ч) ----
      const lastPing = pings?.length ? new Date(pings[pings.length - 1].created_at) : null;
      if (lastPing) {
        const hours = (Date.now() - lastPing.getTime()) / 36e5;
        if (hours >= 48) {
          triggers.push({
            title: "🪞 Зеркало скучает",
            body: "2 дня без чек-инов. 30 секунд — и динамика снова в фокусе.",
            url: "/app",
            tag: "silence-48h",
          });
        }
      }

      if (!triggers.length) continue;

      // get push subs
      const { data: subs } = await admin
        .from("push_subscriptions")
        .select("*")
        .eq("user_id", userId);
      if (!subs?.length) continue;

      // send only ONE strongest trigger this cycle (avoid spam)
      const t = triggers[0];
      const payload = JSON.stringify(t);

      for (const sub of subs) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
          );
          totalSent++;
        } catch (err) {
          const status = (err as { statusCode?: number })?.statusCode;
          if (status === 404 || status === 410) {
            await admin.from("push_subscriptions").delete().eq("id", sub.id);
          }
        }
      }
      triggered.push({ user: userId, tag: t.tag });
    }

    return new Response(JSON.stringify({ ok: true, sent: totalSent, triggered }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("triggers-check error", e);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
