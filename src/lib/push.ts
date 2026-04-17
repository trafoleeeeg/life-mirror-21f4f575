import { supabase } from "@/integrations/supabase/client";

// VAPID public key — safe to ship in client bundle.
export const VAPID_PUBLIC_KEY =
  "BGuzn0irP5634fW6RSkuw9yX51y06ORnIfRHV-cmaHMdPSGG1sMkccFG94-I09G3_7-IZuIFDfi4zjhaQMyRDOM";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** Register SW + ask permission + subscribe + persist on backend. */
export async function enablePush(): Promise<{ ok: boolean; reason?: string }> {
  if (!isPushSupported()) return { ok: false, reason: "Браузер не поддерживает push" };

  // Avoid registering inside Lovable preview iframes (they'll cache stale HTML).
  const inIframe = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();
  const isPreviewHost =
    location.hostname.includes("id-preview--") ||
    location.hostname.includes("lovableproject.com");
  if (inIframe || isPreviewHost) {
    return {
      ok: false,
      reason:
        "Push работает только в опубликованной версии или установленном PWA — не в редакторе Lovable.",
    };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: "Разрешение не выдано" };

  const reg = await navigator.serviceWorker.register("/sw-push.js", { scope: "/" });
  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    });
  }

  const json = sub.toJSON() as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    return { ok: false, reason: "Не удалось получить подписку" };
  }

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const { error } = await supabase.functions.invoke("register-push", {
    body: {
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      user_agent: navigator.userAgent,
    },
    headers: { "x-tz": tz },
  });
  if (error) return { ok: false, reason: error.message };

  // store tz in prefs too (in case row already existed)
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase
      .from("notification_preferences")
      .update({ timezone: tz })
      .eq("user_id", user.id);
  }
  return { ok: true };
}

export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker?.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await supabase
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  }
}

export async function pushPermissionState(): Promise<NotificationPermission> {
  if (!isPushSupported()) return "denied";
  return Notification.permission;
}
