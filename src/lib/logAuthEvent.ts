// Логируем событие входа в auth_events. IP получаем из публичного ipify.
import { supabase } from "@/integrations/supabase/client";

export async function logAuthEvent(userId: string, eventType: "login" | "logout" | "session") {
  try {
    let ip: string | null = null;
    try {
      const r = await fetch("https://api.ipify.org?format=json", { cache: "no-store" });
      const j = await r.json();
      ip = j?.ip ?? null;
    } catch {
      /* ignore */
    }
    await supabase.from("auth_events").insert({
      user_id: userId,
      event_type: eventType,
      ip,
      user_agent: navigator.userAgent,
    });
  } catch (e) {
    // best-effort, не валим UI
    console.warn("logAuthEvent failed", e);
  }
}
