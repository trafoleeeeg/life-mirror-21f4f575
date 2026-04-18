// Инициализация нативных плагинов Capacitor (Android/iOS).
// • StatusBar overlay=true → webview занимает всю высоту, мы сами управляем safe-area.
//   Это даёт «edge-to-edge» внешний вид как на iOS, и контент НЕ обрезается,
//   потому что AppShell использует env(safe-area-inset-top) для отступов.
// • Прозрачный фон статус-бара, светлые иконки на тёмной теме.
import { isCapacitorNative } from "./platform";

export async function initNative() {
  if (!isCapacitorNative()) return;
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
    await StatusBar.setStyle({ style: Style.Light }).catch(() => {});
    await StatusBar.setBackgroundColor({ color: "#00000000" }).catch(() => {});
    await StatusBar.show().catch(() => {});
  } catch (e) {
    console.warn("[native] StatusBar init failed:", e);
  }

  // Splash screen: скрыть когда первый paint случился
  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => {});
  } catch {
    /* плагин может быть не установлен — это ок */
  }

  // Аппаратная кнопка "Назад" → history.back, а если корень — сворачиваем приложение
  try {
    const { App } = await import("@capacitor/app");
    App.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack && window.history.length > 1) {
        window.history.back();
      } else {
        App.minimizeApp().catch(() => {});
      }
    });
  } catch {
    /* плагин может отсутствовать */
  }
}
