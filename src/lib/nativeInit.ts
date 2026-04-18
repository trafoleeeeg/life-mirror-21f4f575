// Инициализация нативных плагинов Capacitor (Android/iOS).
// • StatusBar НЕ overlay → webview сдвигается ниже системной шапки, контент не обрезается.
// • Скрываем splash как только UI готов (без зависшего лого).
// • Меняем цвет адресной строки/нав-бара под тёмную тему.
import { isCapacitorNative } from "./platform";

export async function initNative() {
  if (!isCapacitorNative()) return;
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    // КРИТИЧНО: overlay=false — иначе системные часы/батарея перекрывают шапку приложения.
    // На некоторых Android-устройствах overlay по умолчанию true.
    await StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
    await StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
    await StatusBar.setBackgroundColor({ color: "#000000" }).catch(() => {});
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
