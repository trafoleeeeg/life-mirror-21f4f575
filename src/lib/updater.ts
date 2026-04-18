// Tauri updater wrapper. На вебе — no-op.
export const isTauri = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export interface UpdateInfo {
  version: string;
  notes?: string;
  date?: string;
}

export type UpdaterStatus =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "uptodate"; currentVersion?: string }
  | { kind: "available"; info: UpdateInfo }
  | { kind: "error"; message: string };

let cachedUpdate: any = null;
let lastStatus: UpdaterStatus = { kind: "idle" };
const listeners = new Set<(s: UpdaterStatus) => void>();

export function subscribeUpdaterStatus(cb: (s: UpdaterStatus) => void): () => void {
  listeners.add(cb);
  cb(lastStatus);
  return () => listeners.delete(cb);
}

function setStatus(s: UpdaterStatus) {
  lastStatus = s;
  console.log("[updater] status:", s);
  listeners.forEach((cb) => cb(s));
}

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  if (!isTauri()) return null;
  setStatus({ kind: "checking" });
  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    const { getVersion } = await import("@tauri-apps/api/app");
    const currentVersion = await getVersion().catch(() => undefined);
    console.log("[updater] current version:", currentVersion);
    const update = await check();
    console.log("[updater] check result:", update);
    if (update?.available) {
      cachedUpdate = update;
      const info: UpdateInfo = {
        version: update.version,
        notes: update.body,
        date: update.date,
      };
      setStatus({ kind: "available", info });
      return info;
    }
    setStatus({ kind: "uptodate", currentVersion });
    return null;
  } catch (e: any) {
    const message = e?.message ?? String(e);
    console.error("[updater] check failed", e);
    setStatus({ kind: "error", message });
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
