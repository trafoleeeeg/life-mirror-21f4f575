// Секция в настройках: показать текущую версию + кнопка ручной проверки апдейта.
// Видна только в Tauri (десктоп). На вебе компонент возвращает null.
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, Download, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  checkForUpdate,
  downloadAndInstall,
  isTauri,
  subscribeUpdaterStatus,
  type UpdaterStatus,
} from "@/lib/updater";

export const UpdateSection = () => {
  const [status, setStatus] = useState<UpdaterStatus>({ kind: "idle" });
  const [currentVersion, setCurrentVersion] = useState<string>("—");
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  useEffect(() => {
    if (!isTauri()) return;
    const unsub = subscribeUpdaterStatus(setStatus);
    // Запросим текущую версию один раз
    (async () => {
      try {
        const { getVersion } = await import("@tauri-apps/api/app");
        setCurrentVersion(await getVersion());
      } catch {
        /* ignore */
      }
    })();
    return () => unsub();
  }, []);

  // Подхватим версию из статуса uptodate, если она оттуда придёт
  useEffect(() => {
    if (status.kind === "uptodate" && status.currentVersion) {
      setCurrentVersion(status.currentVersion);
    }
  }, [status]);

  const handleCheck = async () => {
    const info = await checkForUpdate();
    if (!info) {
      // если статус стал uptodate — toast будет лишним; покажем только если ошибки нет
      // (статус сам отрендерится ниже)
    }
  };

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

  if (!isTauri()) return null;

  return (
    <Card className="ios-card p-5 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold">Версия приложения</h3>
          <p className="text-sm text-muted-foreground">
            Текущая: <span className="font-mono">{currentVersion}</span>
          </p>
        </div>
        <Button
          variant="outline"
          className="rounded-full shrink-0"
          onClick={handleCheck}
          disabled={status.kind === "checking" || installing}
        >
          {status.kind === "checking" ? (
            <>
              <Loader2 className="size-4 mr-1.5 animate-spin" />
              Проверяю…
            </>
          ) : (
            <>
              <RefreshCw className="size-4 mr-1.5" />
              Проверить обновления
            </>
          )}
        </Button>
      </div>

      {status.kind === "uptodate" && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="size-4 text-primary" />
          У вас последняя версия
        </div>
      )}

      {status.kind === "error" && (
        <div className="flex items-start gap-2 text-sm text-destructive">
          <AlertCircle className="size-4 mt-0.5 shrink-0" />
          <span className="break-words">{status.message}</span>
        </div>
      )}

      {status.kind === "available" && (
        <div className="space-y-3 pt-2 border-t border-border/50">
          <div className="flex items-center gap-2 text-sm">
            <Download className="size-4 text-primary" />
            <span>
              Доступна версия <span className="font-mono">{status.info.version}</span>
            </span>
          </div>
          {installing && progress !== null && (
            <div>
              <Progress value={progress} className="h-1" />
              <p className="text-xs text-muted-foreground mt-1">{progress}%</p>
            </div>
          )}
          <Button
            onClick={handleInstall}
            disabled={installing}
            size="sm"
            className="rounded-full"
          >
            {installing ? (
              <>
                <RefreshCw className="size-3 mr-2 animate-spin" />
                Устанавливаем…
              </>
            ) : (
              "Обновить и перезапустить"
            )}
          </Button>
        </div>
      )}
    </Card>
  );
};
