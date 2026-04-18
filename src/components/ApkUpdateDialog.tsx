// Брендированное окно обновления APK: скачивание с прогрессом → запуск установщика.
import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Download, CheckCircle2, AlertCircle, Loader2, Sparkles } from "lucide-react";
import { downloadApk, openApk } from "@/lib/apkDownloader";
import type { UpdateInfo } from "@/lib/updateChecker";

type Phase = "idle" | "downloading" | "ready" | "installing" | "error";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  update: UpdateInfo;
}

function formatMB(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(2);
}

export const ApkUpdateDialog = ({ open, onOpenChange, update }: Props) => {
  const [phase, setPhase] = useState<Phase>("idle");
  const [downloaded, setDownloaded] = useState(0);
  const [total, setTotal] = useState<number | null>(null);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  // Сброс при закрытии
  useEffect(() => {
    if (!open) {
      startedRef.current = false;
      setPhase("idle");
      setDownloaded(0);
      setTotal(null);
      setFilePath(null);
      setError(null);
    }
  }, [open]);

  const startDownload = async () => {
    if (!update.apkUrl || startedRef.current) return;
    startedRef.current = true;
    setPhase("downloading");
    setError(null);
    try {
      const fileName = `mirr-${update.latestVersion ?? "update"}.apk`;
      const uri = await downloadApk(update.apkUrl, fileName, (d, t) => {
        setDownloaded(d);
        if (t) setTotal(t);
      });
      setFilePath(uri);
      setPhase("ready");
      // Сразу запустим установщик — пользователь уже кликнул "Установить".
      // handleInstall сам вернёт фазу в "ready" после старта системного диалога,
      // чтобы UI не висел в "installing", если пользователь отменит установку.
      await handleInstall(uri);
    } catch (e) {
      console.error("[ApkUpdateDialog] download failed", e);
      setError(e instanceof Error ? e.message : String(e));
      setPhase("error");
      startedRef.current = false;
    }
  };

  const handleInstall = async (uri?: string) => {
    const path = uri ?? filePath;
    if (!path) return;
    setPhase("installing");
    try {
      await openApk(path);
      // Системный установщик показан — оставляем "ready" чтобы можно было
      // нажать ещё раз если пользователь случайно отменил.
      setPhase("ready");
    } catch (e) {
      console.error("[ApkUpdateDialog] open failed", e);
      const msg = e instanceof Error ? e.message : String(e);
      // Типовая причина: нет разрешения "Установка из неизвестных источников"
      setError(
        msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("denied")
          ? "Разреши установку из неизвестных источников в настройках Android и попробуй снова."
          : `Не удалось открыть установщик: ${msg}`,
      );
      setPhase("error");
    }
  };

  const percent = total ? Math.round((downloaded / total) * 100) : null;
  const canDismiss = phase === "idle" || phase === "error" || phase === "ready" || phase === "installing";

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && !canDismiss) return; // не даём закрыть во время скачивания
        onOpenChange(v);
      }}
    >
      <DialogContent className="ios-card max-w-sm rounded-3xl border-border/60">
        <DialogHeader className="items-center text-center">
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5">
            {phase === "downloading" || phase === "installing" ? (
              <Loader2 className="h-7 w-7 text-primary animate-spin" />
            ) : phase === "error" ? (
              <AlertCircle className="h-7 w-7 text-destructive" />
            ) : phase === "ready" ? (
              <CheckCircle2 className="h-7 w-7 text-primary" />
            ) : (
              <Sparkles className="h-7 w-7 text-primary" />
            )}
          </div>
          <DialogTitle className="text-lg">
            {phase === "downloading" && "Скачиваем обновление…"}
            {phase === "installing" && "Запускаем установку…"}
            {phase === "ready" && "Готово к установке"}
            {phase === "error" && "Не удалось обновить"}
            {phase === "idle" && `Доступна версия ${update.latestVersion}`}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {phase === "idle" && (
              <>
                Текущая: <span className="font-mono">{update.currentVersion}</span> · обновим до{" "}
                <span className="font-mono">{update.latestVersion}</span>
              </>
            )}
            {phase === "downloading" && "Не закрывай приложение"}
            {phase === "installing" && "Подтверди установку в системном окне"}
            {phase === "ready" && "Если установщик не открылся — нажми кнопку ниже"}
            {phase === "error" && error}
          </DialogDescription>
        </DialogHeader>

        {(phase === "downloading" || phase === "installing") && (
          <div className="space-y-2 pt-2">
            <Progress value={percent ?? 0} className="h-1.5" />
            <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
              <span>
                {formatMB(downloaded)} МБ
                {total ? ` из ${formatMB(total)} МБ` : ""}
              </span>
              <span>{percent !== null ? `${percent}%` : "…"}</span>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2 pt-2">
          {phase === "idle" && (
            <Button onClick={startDownload} size="lg" className="rounded-full">
              <Download className="mr-2 h-4 w-4" />
              Скачать и установить
            </Button>
          )}
          {phase === "ready" && (
            <Button onClick={() => handleInstall()} size="lg" className="rounded-full">
              Открыть установщик
            </Button>
          )}
          {phase === "error" && (
            <Button onClick={startDownload} size="lg" className="rounded-full">
              Повторить
            </Button>
          )}
          {canDismiss && (
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-full">
              {phase === "installing" || phase === "ready" ? "Закрыть" : "Позже"}
            </Button>
          )}
        </div>

        {update.notes && phase === "idle" && (
          <div className="mt-2 max-h-32 overflow-y-auto rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground whitespace-pre-wrap">
            {update.notes}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
