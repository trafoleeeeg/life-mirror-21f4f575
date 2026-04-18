// Определение платформы (web / tauri-desktop / capacitor-native)
import { isTauri } from "@/lib/updater";

export function isCapacitorNative(): boolean {
  if (typeof window === "undefined") return false;
  // Capacitor выставляет window.Capacitor.isNativePlatform()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cap = (window as any).Capacitor;
  return !!(cap && typeof cap.isNativePlatform === "function" && cap.isNativePlatform());
}

export function isDesktop(): boolean {
  return isTauri();
}

export function isNativeApp(): boolean {
  return isDesktop() || isCapacitorNative();
}
