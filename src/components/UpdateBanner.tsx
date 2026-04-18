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

/**
 * Тихий баннер: видим только когда реально доступно обновление.
 * Проверка делается фоном раз в час; статусы checking/uptodate/error не показываем.
 */
export const UpdateBanner = () => {
  const [status, setStatus] = useState<UpdaterStatus>({ kind: "idle" });
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;
    const unsub = subscribeUpdaterStatus(setStatus);
    let cancelled = false;
    const run = async () => {
      if (!cancelled) await checkForUpdate();
    };
    const t = setTimeout(run, 2000);
    const i = setInterval(run, 60 * 60 * 1000);
    return () => {
      cancelled = true;
      clearTimeout(t);
      clearInterval(i);
      unsub();
    };
  }, []);

  const handleInstall = async () => {
    setInstalling(true);
    setProgress(0);
    try {
      await downloadAndInstall((d, total) => {
        if (total) setProgress(Math.round((d / total) * 100));
      });
    } catch (e: any) {
      toast.error("Не удалось обновить", { description: e?.message });
      setInstalling(false);
      setProgress(null);
    }
  };

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
        onClick={handleInstall}
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
