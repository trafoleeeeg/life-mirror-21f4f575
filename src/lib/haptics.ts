// Haptic feedback (вибрация) для мобильных устройств.
// Безопасно вызывается на вебе/десктопе — там просто no-op.
import { isCapacitorNative } from "./platform";

type Strength = "light" | "medium" | "heavy" | "selection" | "success" | "warning" | "error";

let cached: typeof import("@capacitor/haptics") | null = null;
let loadFailed = false;

async function getMod() {
  if (loadFailed) return null;
  if (cached) return cached;
  try {
    cached = await import("@capacitor/haptics");
    return cached;
  } catch {
    loadFailed = true;
    return null;
  }
}

/** Лёгкая тактильная отдача. На вебе пробует navigator.vibrate как fallback. */
export async function haptic(strength: Strength = "light"): Promise<void> {
  if (!isCapacitorNative()) {
    // Web fallback — короткая вибрация если поддерживается
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      const ms = strength === "heavy" ? 25 : strength === "medium" ? 15 : 8;
      try { navigator.vibrate(ms); } catch { /* ignore */ }
    }
    return;
  }
  const mod = await getMod();
  if (!mod) return;
  try {
    if (strength === "selection") {
      await mod.Haptics.selectionChanged();
      return;
    }
    if (strength === "success" || strength === "warning" || strength === "error") {
      const map = { success: mod.NotificationType.Success, warning: mod.NotificationType.Warning, error: mod.NotificationType.Error };
      await mod.Haptics.notification({ type: map[strength] });
      return;
    }
    const styleMap = { light: mod.ImpactStyle.Light, medium: mod.ImpactStyle.Medium, heavy: mod.ImpactStyle.Heavy };
    await mod.Haptics.impact({ style: styleMap[strength] });
  } catch {
    /* ignore */
  }
}
