import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Share, Plus, ArrowRight, Smartphone } from "lucide-react";
import appIcon from "/app-icon-512.png";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const Install = () => {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if (window.matchMedia("(display-mode: standalone)").matches) setInstalled(true);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <Card className="ios-card w-full max-w-md p-8 space-y-6 text-center">
        <img
          src={appIcon}
          alt="Inner Glyph"
          width={96}
          height={96}
          className="mx-auto rounded-3xl shadow-2xl"
        />
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Установить Inner Glyph</h1>
          <p className="text-sm text-muted-foreground">
            Добавь приложение на главный экран — будет работать как нативное.
          </p>
        </div>

        {installed ? (
          <div className="rounded-xl bg-primary/10 text-primary p-4 text-sm">
            Уже установлено ✓
          </div>
        ) : deferred ? (
          <Button onClick={install} className="w-full h-12 rounded-full">
            <Smartphone className="mr-2 size-4" />
            Установить
          </Button>
        ) : isIOS ? (
          <div className="text-left space-y-3 text-sm">
            <p className="font-medium">На iPhone:</p>
            <ol className="space-y-2 text-muted-foreground">
              <li className="flex gap-2">
                <span className="text-primary mono">1.</span>
                Нажми <Share className="inline size-4 mx-1 text-primary" /> «Поделиться» в Safari
              </li>
              <li className="flex gap-2">
                <span className="text-primary mono">2.</span>
                Выбери <Plus className="inline size-4 mx-1 text-primary" /> «На экран Домой»
              </li>
              <li className="flex gap-2">
                <span className="text-primary mono">3.</span>
                Нажми «Добавить»
              </li>
            </ol>
          </div>
        ) : isAndroid ? (
          <div className="text-left space-y-3 text-sm">
            <p className="font-medium">На Android:</p>
            <ol className="space-y-2 text-muted-foreground">
              <li>1. Открой меню браузера (⋮)</li>
              <li>2. Выбери «Установить приложение» или «На главный экран»</li>
            </ol>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Открой эту страницу с телефона — там появится кнопка «Установить» или инструкция.
          </p>
        )}

        <Button asChild variant="ghost" className="w-full">
          <Link to="/app">
            Продолжить в браузере <ArrowRight className="ml-1 size-4" />
          </Link>
        </Button>
      </Card>
    </div>
  );
};

export default Install;
