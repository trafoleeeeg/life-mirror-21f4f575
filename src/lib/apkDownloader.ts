// Скачивание APK с прогрессом и запуск нативного установщика Android.
// Ключевой момент: FileOpener ожидает абсолютный file://-путь к файлу
// в директории, доступной FileProvider'у Capacitor. Documents/External
// работают надёжнее Cache на Android 10+.
import { Filesystem, Directory, type ProgressStatus } from "@capacitor/filesystem";
import { FileOpener } from "@capacitor-community/file-opener";

export type DownloadProgress = (downloaded: number, total: number | null) => void;

/** Скачивает APK по URL с прогрессом и сохраняет в External directory. */
export async function downloadApk(
  url: string,
  fileName: string,
  onProgress?: DownloadProgress,
): Promise<string> {
  const handle = await Filesystem.addListener("progress", (status: ProgressStatus) => {
    if (status.url !== url) return;
    onProgress?.(status.bytes, status.contentLength ?? null);
  });

  try {
    // Сначала пытаемся External (доступна FileProvider'у), затем Cache как fallback.
    let result;
    try {
      result = await Filesystem.downloadFile({
        url,
        path: fileName,
        directory: Directory.External,
        recursive: true,
        progress: true,
      });
    } catch (e) {
      console.warn("[apkDownloader] External failed, fallback to Cache:", e);
      result = await Filesystem.downloadFile({
        url,
        path: fileName,
        directory: Directory.Cache,
        recursive: true,
        progress: true,
      });
    }
    if (!result.path) throw new Error("Не удалось сохранить файл");
    console.log("[apkDownloader] saved at:", result.path);
    return result.path;
  } finally {
    await handle.remove();
  }
}

/**
 * Открыть скачанный APK через системный установщик.
 * Без таймаут-гонки: FileOpener.open резолвится после показа Intent chooser.
 * Если упадёт — пробрасываем ошибку наверх (UI покажет реальную причину).
 */
export async function openApk(filePath: string): Promise<void> {
  console.log("[apkDownloader] opening APK:", filePath);
  await FileOpener.open({
    filePath,
    contentType: "application/vnd.android.package-archive",
    openWithDefault: true,
  });
}
