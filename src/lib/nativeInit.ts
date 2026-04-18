// Инициализация нативных плагинов Capacitor (Android/iOS).
// Настраивает StatusBar так, чтобы webview НЕ залезал под него и часы/иконки были видны.
import { isCapacitorNative } from "./platform";

export async function initNative() {
  if (!isCapacitorNative()) return;
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    // НЕ overlay: webview сдвигается ниже status bar — контент не обрезается
    await StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
    await StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
    await StatusBar.setBackgroundColor({ color: "#000000" }).catch(() => {});
  } catch (e) {
    console.warn("[native] StatusBar init failed:", e);
  }
}
