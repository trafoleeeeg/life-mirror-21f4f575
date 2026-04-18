// Подписка на deep-link mirr://callback?code=... в Tauri (десктоп) и Capacitor (Android/iOS).
// На обычном вебе — no-op.
import { isTauri } from "@/lib/updater";
import { isCapacitorNative } from "@/lib/platform";
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
    const code = u.searchParams.get("code");
    if (code) {
      // Закрываем браузер на Capacitor (если открыт in-app)
      if (isCapacitorNative()) {
        import("@capacitor/browser").then(({ Browser }) => {
          Browser.close().catch(() => {});
        });
      }
      exchangeCode(code);
    }
  } catch (e) {
    console.error("[deep-link] parse error", e, url);
  }
}

async function initTauriDeepLink() {
  try {
    const { onOpenUrl, getCurrent } = await import("@tauri-apps/plugin-deep-link");
    try {
      const initial = await getCurrent();
      if (initial && initial.length > 0) {
        for (const u of initial) parseAndHandle(u);
      }
    } catch {
      // ignore
    }
    await onOpenUrl((urls) => {
      for (const u of urls) parseAndHandle(u);
    });
  } catch (e) {
    console.error("[deep-link] tauri init error", e);
  }
}

async function initCapacitorDeepLink() {
  try {
    const { App } = await import("@capacitor/app");
    // Если приложение открыли уже по deep-link
    try {
      const launch = await App.getLaunchUrl();
      if (launch?.url) parseAndHandle(launch.url);
    } catch {
      // ignore
    }
    App.addListener("appUrlOpen", (event) => {
      if (event?.url) parseAndHandle(event.url);
    });
  } catch (e) {
    console.error("[deep-link] capacitor init error", e);
  }
}

export async function initDeepLink() {
  if (initialized) return;
  if (isTauri()) {
    initialized = true;
    await initTauriDeepLink();
  } else if (isCapacitorNative()) {
    initialized = true;
    await initCapacitorDeepLink();
  }
}

export async function openDesktopAuthInBrowser() {
  const url = `${WEB_ORIGIN}/desktop-auth`;
  if (isTauri()) {
    try {
      const { open } = await import("@tauri-apps/plugin-shell");
      await open(url);
    } catch (e) {
      console.error("[deep-link] tauri open browser error", e);
      toast.error("Не удалось открыть браузер");
    }
    return;
  }
  if (isCapacitorNative()) {
    try {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url, presentationStyle: "popover" });
    } catch (e) {
      console.error("[deep-link] capacitor open browser error", e);
      toast.error("Не удалось открыть браузер");
    }
    return;
  }
  // веб
  window.location.href = url;
}
