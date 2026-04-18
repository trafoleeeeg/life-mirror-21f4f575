// Tauri updater wrapper. На вебе — no-op.
export const isTauri = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export interface UpdateInfo {
  version: string;
  notes?: string;
  date?: string;
}

let cachedUpdate: any = null;

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  if (!isTauri()) return null;
  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check();
    if (update?.available) {
      cachedUpdate = update;
      return {
        version: update.version,
        notes: update.body,
        date: update.date,
      };
    }
    return null;
  } catch (e) {
    console.error("[updater] check failed", e);
    return null;
  }
}

export async function downloadAndInstall(
  onProgress?: (downloaded: number, total: number | null) => void
): Promise<void> {
  if (!isTauri() || !cachedUpdate) return;
  let downloaded = 0;
  let total: number | null = null;
  await cachedUpdate.downloadAndInstall((event: any) => {
    if (event.event === "Started") {
      total = event.data.contentLength ?? null;
    } else if (event.event === "Progress") {
      downloaded += event.data.chunkLength;
      onProgress?.(downloaded, total);
    }
  });
  const { relaunch } = await import("@tauri-apps/plugin-process");
  await relaunch();
}
