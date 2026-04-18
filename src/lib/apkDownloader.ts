// Скачивание APK с прогрессом во временное хранилище и запуск установки
// через нативный FileOpener (Android покажет системный установщик).
import { Filesystem, Directory } from "@capacitor/filesystem";
import { FileOpener } from "@capacitor-community/file-opener";

export type DownloadProgress = (downloaded: number, total: number | null) => void;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunk)) as unknown as number[],
    );
  }
  return btoa(binary);
}

/** Скачивает APK по URL с прогрессом и сохраняет в Cache directory. */
export async function downloadApk(
  url: string,
  fileName: string,
  onProgress?: DownloadProgress,
): Promise<string> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

  const totalHeader = res.headers.get("Content-Length");
  const total = totalHeader ? parseInt(totalHeader, 10) : null;

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.length;
      onProgress?.(received, total);
    }
  }

  const blob = new Blob(chunks);
  const buffer = await blob.arrayBuffer();
  const base64 = arrayBufferToBase64(buffer);

  // Сохраняем в Cache (не требует разрешений). Перезаписываем, если есть.
  const written = await Filesystem.writeFile({
    path: fileName,
    data: base64,
    directory: Directory.Cache,
    recursive: true,
  });

  return written.uri; // file://...
}

/** Открыть скачанный APK — Android покажет нативный диалог установки. */
export async function openApk(filePath: string): Promise<void> {
  await FileOpener.open({
    filePath,
    contentType: "application/vnd.android.package-archive",
    openWithDefault: true,
  });
}
