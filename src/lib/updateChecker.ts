// Проверка обновлений APK через GitHub Releases.
// Сравнивает текущую версию (VITE_APP_VERSION) с тегом latest-release.
// Возвращает прямую ссылку на APK-asset для скачивания/установки.

export interface UpdateInfo {
  available: boolean;
  currentVersion: string;
  latestVersion: string | null;
  apkUrl: string | null;
  releaseUrl: string | null;
  notes: string | null;
}

const REPO = (import.meta.env.VITE_GITHUB_REPO as string | undefined) || "trafoleeeeg/life-mirror-21f4f575"; // "owner/repo"
const CURRENT = (import.meta.env.VITE_APP_VERSION as string | undefined) || "0.0.0";

// Семвер-сравнение: "1.2.10" > "1.2.9"
function cmpVer(a: string, b: string): number {
  const pa = a.replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export async function checkForApkUpdate(): Promise<UpdateInfo> {
  const empty: UpdateInfo = {
    available: false,
    currentVersion: CURRENT,
    latestVersion: null,
    apkUrl: null,
    releaseUrl: null,
    notes: null,
  };

  if (!REPO) {
    console.warn("[updateChecker] VITE_GITHUB_REPO not set");
    return empty;
  }

  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!r.ok) return empty;
    const j = await r.json() as {
      tag_name: string;
      html_url: string;
      body: string | null;
      assets: Array<{ name: string; browser_download_url: string }>;
    };
    const apk = j.assets?.find((a) => a.name.toLowerCase().endsWith(".apk"));
    const latest = j.tag_name;
    const isNewer = cmpVer(latest, CURRENT) > 0;
    return {
      available: isNewer && !!apk,
      currentVersion: CURRENT,
      latestVersion: latest,
      apkUrl: apk?.browser_download_url ?? null,
      releaseUrl: j.html_url,
      notes: j.body,
    };
  } catch (e) {
    console.warn("[updateChecker] failed:", e);
    return empty;
  }
}

export const APP_VERSION = CURRENT;
