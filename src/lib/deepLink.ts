// Подписка на deep-link mirr://callback?code=... в Tauri.
// На вебе — no-op.
import { isTauri } from "@/lib/updater";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const WEB_ORIGIN = "https://mirr-demo.lovable.app";
const FUNCTIONS_URL =
  import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "") + "/functions/v1";

let initialized = false;
let onSignedInCb: (() => void) | null = null;

export function setOnDesktopSignIn(cb: () => void) {
  onSignedInCb = cb;
}

async function exchangeCode(code: string) {
  try {
    const res = await fetch(`${FUNCTIONS_URL}/desktop-auth-exchange?action=consume`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Не удалось обменять код");
    if (!data?.access_token || !data?.refresh_token) {
      throw new Error("Сервер не вернул токены");
    }
    const { error } = await supabase.auth.setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    });
    if (error) throw error;
    toast.success("Вы вошли через Google");
    onSignedInCb?.();
  } catch (e) {
    console.error("[deep-link] exchange error", e);
    toast.error(e instanceof Error ? e.message : "Ошибка входа");
  }
}

function parseAndHandle(url: string) {
  try {
    const u = new URL(url);
    if (u.protocol !== "mirr:") return;
    if (u.host !== "callback" && u.pathname !== "/callback") {
      // mirr://callback?code=xxx → host=callback
      // на всякий случай поддержим оба
    }
    const code = u.searchParams.get("code");
    if (code) {
      exchangeCode(code);
    }
  } catch (e) {
    console.error("[deep-link] parse error", e, url);
  }
}

export async function initDeepLink() {
  if (initialized || !isTauri()) return;
  initialized = true;
  try {
    const { onOpenUrl, getCurrent } = await import("@tauri-apps/plugin-deep-link");
    // Если приложение запущено по deep-link — заберём начальный URL
    try {
      const initial = await getCurrent();
      if (initial && initial.length > 0) {
        for (const u of initial) parseAndHandle(u);
      }
    } catch {
      // ignore
    }
    // Слушаем последующие deep-link
    await onOpenUrl((urls) => {
      for (const u of urls) parseAndHandle(u);
    });
  } catch (e) {
    console.error("[deep-link] init error", e);
  }
}

export async function openDesktopAuthInBrowser() {
  if (!isTauri()) {
    // на вебе просто переходим
    window.location.href = `${WEB_ORIGIN}/desktop-auth`;
    return;
  }
  try {
    const { open } = await import("@tauri-apps/plugin-shell");
    await open(`${WEB_ORIGIN}/desktop-auth`);
  } catch (e) {
    console.error("[deep-link] open browser error", e);
    toast.error("Не удалось открыть браузер");
  }
}
