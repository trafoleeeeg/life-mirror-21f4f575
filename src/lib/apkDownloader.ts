// Скачивание APK с прогрессом во временное хранилище и запуск установки.
// Используем нативный Filesystem.downloadFile — это обходит CORS WebView
// и работает с GitHub Release редиректами на objects.githubusercontent.com.
import { Filesystem, Directory, type ProgressStatus } from "@capacitor/filesystem";
import { FileOpener } from "@capacitor-community/file-opener";

export type DownloadProgress = (downloaded: number, total: number | null) => void;

/** Скачивает APK по URL с прогрессом и сохраняет в Cache directory. */
export async function downloadApk(
  url: string,
  fileName: string,
  onProgress?: DownloadProgress,
): Promise<string> {
  // Подписка на прогресс ДО старта загрузки
  const handle = await Filesystem.addListener("progress", (status: ProgressStatus) => {
    if (status.url !== url) return;
    onProgress?.(status.bytes, status.contentLength ?? null);
  });

  try {
    const result = await Filesystem.downloadFile({
      url,
      path: fileName,
      directory: Directory.Cache,
      recursive: true,
      progress: true,
    });
    if (!result.path) throw new Error("Не удалось сохранить файл");
    return result.path; // абсолютный file:// путь
  } finally {
    await handle.remove();
  }
}

/**
 * Открыть скачанный APK — Android покажет нативный диалог установки.
 * ВАЖНО: на части устройств промис от FileOpener не резолвится, потому что
 * Android уводит фокус на системный установщик. Поэтому делаем гонку с таймаутом:
 * если за 2.5с не упало — считаем, что установщик стартовал успешно.
 */
export async function openApk(filePath: string): Promise<void> {
  const open = FileOpener.open({
    filePath,
    contentType: "application/vnd.android.package-archive",
    openWithDefault: true,
  });
  await Promise.race([
    open,
    new Promise<void>((resolve) => setTimeout(resolve, 2500)),
  ]);
}
