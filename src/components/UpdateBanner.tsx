// Баннер апдейтов:
//  • Desktop (Tauri) — через встроенный updater
//  • Android (Capacitor) — через GitHub Releases: тап → открываем APK в браузере → Android установит поверх
import { useEffect, useState } from "react";
import { Download, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  checkForUpdate,
  downloadAndInstall,
  isTauri,
  subscribeUpdaterStatus,
  type UpdaterStatus,
} from "@/lib/updater";
import { isCapacitorNative } from "@/lib/platform";
import { checkForApkUpdate, type UpdateInfo } from "@/lib/updateChecker";

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // раз в час
const FIRST_CHECK_DELAY_MS = 4000;

export const UpdateBanner = () => {
  // ---------- Tauri (desktop) ----------
  const [status, setStatus] = useState<UpdaterStatus>({ kind: "idle" });
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // ---------- Android (Capacitor) ----------
  const [apkUpdate, setApkUpdate] = useState<UpdateInfo | null>(null);
  const [apkOpening, setApkOpening] = useState(false);

  // Tauri updater
  useEffect(() => {
    if (!isTauri()) return;
    const unsub = subscribeUpdaterStatus(setStatus);
    let cancelled = false;
    const run = async () => { if (!cancelled) await checkForUpdate(); };
    const t = setTimeout(run, 2000);
    const i = setInterval(run, CHECK_INTERVAL_MS);
    return () => { cancelled = true; clearTimeout(t); clearInterval(i); unsub(); };
  }, []);

  // Android APK updater (опрос GitHub Releases)
  useEffect(() => {
    if (!isCapacitorNative()) return;
    let cancelled = false;
    const run = async () => {
      const info = await checkForApkUpdate();
      if (!cancelled && info.available) setApkUpdate(info);
    };
    const t = setTimeout(run, FIRST_CHECK_DELAY_MS);
    const i = setInterval(run, CHECK_INTERVAL_MS);
    return () => { cancelled = true; clearTimeout(t); clearInterval(i); };
  }, []);

  const handleTauriInstall = async () => {
    setInstalling(true);
    setProgress(0);
    try {
      await downloadAndInstall((d, total) => {
        if (total) setProgress(Math.round((d / total) * 100));
      });
    } catch (e) {
      toast.error("Не удалось обновить", {
        description: e instanceof Error ? e.message : String(e),
      });
      setInstalling(false);
      setProgress(null);
    }
  };

  const handleApkInstall = async () => {
    if (!apkUpdate?.apkUrl) return;
    setApkOpening(true);
    try {
      // Открываем системный браузер — Android сам скачает .apk и предложит установить
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url: apkUpdate.apkUrl });
    } catch (e) {
      // fallback — обычный window.open
      window.open(apkUpdate.apkUrl, "_blank");
      console.warn("[UpdateBanner] Browser.open failed, fallback used:", e);
    } finally {
      setApkOpening(false);
    }
  };

  // ---------- РЕНДЕР: Android-баннер имеет приоритет ----------
  if (isCapacitorNative() && apkUpdate?.available && !dismissed) {
    return (
      <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] md:bottom-4 right-4 left-4 md:left-auto z-50 md:w-80 rounded-2xl border border-border bg-card p-4 shadow-lg animate-slide-up">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">Доступно обновление</h3>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Новая версия {apkUpdate.latestVersion}
              {apkUpdate.currentVersion !== "0.0.0" && (
                <span className="opacity-70"> · текущая {apkUpdate.currentVersion}</span>
              )}
            </p>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-muted-foreground hover:text-foreground shrink-0"
            aria-label="Закрыть"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <Button
          onClick={handleApkInstall}
          disabled={apkOpening}
          size="sm"
          className="mt-3 w-full rounded-full"
        >
          {apkOpening ? (
            <><RefreshCw className="h-3 w-3 mr-2 animate-spin" /> Открываем…</>
          ) : (
            "Скачать и установить"
          )}
        </Button>
        <p className="text-[10px] text-muted-foreground mt-2 text-center">
          Откроется браузер · разреши установку из неизвестных источников
        </p>
      </div>
    );
  }

  // ---------- Tauri-баннер ----------
  if (!isTauri() || dismissed) return null;
  if (status.kind !== "available") return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-lg border border-border bg-card p-4 shadow-lg">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Доступно обновление</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Версия {status.info.version} готова к установке
          </p>
        </div>
        {!installing && (
          <button
            onClick={() => setDismissed(true)}
            className="text-muted-foreground hover:text-foreground shrink-0"
            aria-label="Закрыть"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {installing && progress !== null && (
        <div className="mt-3">
          <Progress value={progress} className="h-1" />
          <p className="text-xs text-muted-foreground mt-1">{progress}%</p>
        </div>
      )}

      <Button
        onClick={handleTauriInstall}
        disabled={installing}
        size="sm"
        className="mt-3 w-full"
      >
        {installing ? (
          <>
            <RefreshCw className="h-3 w-3 mr-2 animate-spin" />
            Устанавливаем...
          </>
        ) : (
          "Обновить и перезапустить"
        )}
      </Button>
    </div>
  );
};
