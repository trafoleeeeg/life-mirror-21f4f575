// Sends Web Push notifications to all users whose schedule window is open.
// Triggered by pg_cron every ~15 minutes. Idempotent per user via last_sent_at.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import webpush from "https://esm.sh/web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:hello@innerglyph.app";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

interface Pref {
  user_id: string;
  enabled: boolean;
  timezone: string;
  start_hour: number;
  end_hour: number;
  interval_minutes: number;
  weekdays: number[]; // 1..7 (mon=1..sun=7)
  last_sent_at: string | null;
  mood_emojis: string[];
}

function inWindow(pref: Pref): boolean {
  const now = new Date();
  // Convert to user's tz
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: pref.timezone || "UTC",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const wkShort = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const map: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  const weekday = map[wkShort] ?? 1;

  if (!pref.weekdays.includes(weekday)) return false;
  if (hour < pref.start_hour || hour >= pref.end_hour) return false;

  // throttle by interval
  if (pref.last_sent_at) {
    const elapsedMin = (now.getTime() - new Date(pref.last_sent_at).getTime()) / 60000;
    if (elapsedMin < pref.interval_minutes - 1) return false;
  }
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Auth: require shared secret (set via CRON_SECRET) — used by pg_cron caller.
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
    const { data: prefs, error } = await admin
      .from("notification_preferences")
      .select("*")
      .eq("enabled", true);
    if (error) throw error;

    let sent = 0;
    let skipped = 0;
    let dropped = 0;

    for (const pref of (prefs ?? []) as Pref[]) {
      if (!inWindow(pref)) {
        skipped++;
        continue;
      }
      const { data: subs } = await admin
        .from("push_subscriptions")
        .select("*")
        .eq("user_id", pref.user_id);
      if (!subs?.length) {
        skipped++;
        continue;
      }

      const emoji =
        pref.mood_emojis?.[Math.floor(Math.random() * pref.mood_emojis.length)] ?? "✨";
      const payload = JSON.stringify({
        title: `${emoji} Как ты сейчас?`,
        body: "30 секунд: настроение и что делал. Это твоё зеркало.",
        url: "/app/ping",
        tag: "mood-ping",
      });

      for (const sub of subs) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
          );
          sent++;
          await admin.from("push_events").insert({
            user_id: pref.user_id,
            subscription_id: sub.id,
            event_type: "sent",
            status_code: 201,
            payload_kind: "mood-ping",
          });
        } catch (err) {
          const status = (err as { statusCode?: number })?.statusCode;
          const msg = (err as Error)?.message ?? String(err);
          await admin.from("push_events").insert({
            user_id: pref.user_id,
            subscription_id: sub.id,
            event_type: "failed",
            status_code: status ?? null,
            error: msg.slice(0, 500),
            payload_kind: "mood-ping",
          });
          if (status === 404 || status === 410) {
            await admin.from("push_subscriptions").delete().eq("id", sub.id);
            dropped++;
          }
        }
      }

      await admin
        .from("notification_preferences")
        .update({ last_sent_at: new Date().toISOString() })
        .eq("user_id", pref.user_id);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("push-send error", e);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
