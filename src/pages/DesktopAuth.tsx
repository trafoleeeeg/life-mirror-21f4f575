import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

/**
 * Веб-страница для desktop-OAuth handoff.
 *
 * Flow:
 * 1. Desktop-приложение открывает в системном браузере: https://mirr-demo.lovable.app/desktop-auth
 * 2. Если юзер не залогинен — кнопка "Войти через Google" запускает обычный OAuth с redirectTo сюда же.
 * 3. После возврата с Google здесь уже есть сессия → запрашиваем у edge function одноразовый код.
 * 4. Редиректим браузер на mirr://callback?code=XYZ — Windows пробросит это в .exe.
 * 5. .exe ловит deep-link, вызывает desktop-auth-exchange?action=consume и получает токены.
 */
const DesktopAuth = () => {
  const [step, setStep] = useState<"loading" | "needs_login" | "issuing" | "redirecting" | "done" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const redirectUrl = `${window.location.origin}/desktop-auth`;

  useEffect(() => {
    let cancelled = false;

    const issueCodeAndRedirect = async (accessToken: string, refreshToken: string) => {
      setStep("issuing");
      try {
        const { data, error } = await supabase.functions.invoke("desktop-auth-exchange?action=create", {
          body: { access_token: accessToken, refresh_token: refreshToken },
        });
        if (error) throw error;
        if (!data?.code) throw new Error("Сервер не вернул код");
        if (cancelled) return;
        setStep("redirecting");
        // Редирект в desktop-приложение через protocol handler
        const deepLink = `mirr://callback?code=${encodeURIComponent(data.code)}`;
        window.location.href = deepLink;
        // Через 2 сек показываем "готово" — если браузер не смог открыть .exe, юзер увидит подсказку
        setTimeout(() => {
          if (!cancelled) setStep("done");
        }, 2000);
      } catch (e) {
        console.error("[desktop-auth] issue error", e);
        setErrorMsg(e instanceof Error ? e.message : "Не удалось выдать код");
        setStep("error");
      }
    };

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      const s = data.session;
      if (s?.access_token && s?.refresh_token) {
        issueCodeAndRedirect(s.access_token, s.refresh_token);
      } else {
        setStep("needs_login");
      }
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startGoogle = async () => {
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: redirectUrl,
      });
      if (result.error) throw result.error;
      // если result.redirected — браузер сам уйдёт на Google
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка Google");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <Card className="ios-card w-full max-w-md p-8 space-y-5 text-center">
        <div className="mx-auto size-12 rounded-2xl bg-primary flex items-center justify-center mb-2">
          <span className="text-primary-foreground font-bold text-xl">M</span>
        </div>
        <h1 className="text-2xl font-semibold">Вход в Mirr Desktop</h1>

        {step === "loading" && (
          <p className="text-sm text-muted-foreground">Проверяем сессию…</p>
        )}

        {step === "needs_login" && (
          <>
            <p className="text-sm text-muted-foreground">
              Войдите в свой аккаунт. После этого вы автоматически вернётесь в приложение.
            </p>
            <Button onClick={startGoogle} className="w-full h-11 rounded-xl font-medium">
              Войти через Google
            </Button>
            <p className="text-xs text-muted-foreground">
              Можно также войти по email на{" "}
              <a href="/auth" className="text-primary hover:underline">обычной странице входа</a>,
              затем вернуться сюда.
            </p>
          </>
        )}

        {step === "issuing" && (
          <p className="text-sm text-muted-foreground">Выдаём код для приложения…</p>
        )}

        {step === "redirecting" && (
          <p className="text-sm text-muted-foreground">Открываем Mirr Desktop…</p>
        )}

        {step === "done" && (
          <>
            <p className="text-sm">✅ Готово. Если приложение не открылось автоматически — закройте эту вкладку и откройте Mirr вручную, вы уже залогинены.</p>
            <Button onClick={() => window.close()} variant="secondary" className="w-full h-11 rounded-xl">
              Закрыть вкладку
            </Button>
          </>
        )}

        {step === "error" && (
          <>
            <p className="text-sm text-destructive">Ошибка: {errorMsg}</p>
            <Button onClick={() => window.location.reload()} className="w-full h-11 rounded-xl">
              Попробовать снова
            </Button>
          </>
        )}
      </Card>
    </div>
  );
};

export default DesktopAuth;
