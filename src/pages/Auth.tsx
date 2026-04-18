import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import { isTauri } from "@/lib/updater";

type Mode = "signin" | "signup" | "forgot";

const Auth = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const desktop = isTauri();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/app` },
        });
        if (error) throw error;
        toast.success("Аккаунт создан");
        navigate("/app");
      } else if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/app");
      } else {
        // forgot
        const redirectBase =
          desktop || window.location.protocol === "file:"
            ? "https://mirr-demo.lovable.app"
            : window.location.origin;
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${redirectBase}/reset-password`,
        });
        if (error) throw error;
        toast.success("Письмо со ссылкой для сброса отправлено на почту");
        setMode("signin");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/app`,
      });
      if (result.error) throw result.error;
      if (!result.redirected) navigate("/app");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка Google");
      setLoading(false);
    }
  };

  const titleByMode: Record<Mode, string> = {
    signin: "Вход в зеркало",
    signup: "Создать зеркало",
    forgot: "Сброс пароля",
  };

  const submitLabelByMode: Record<Mode, string> = {
    signin: "Войти",
    signup: "Создать аккаунт",
    forgot: "Отправить ссылку",
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <Card className="ios-card w-full max-w-sm p-8 space-y-6">
        <div className="text-center space-y-1">
          <div className="mx-auto size-10 rounded-2xl bg-primary flex items-center justify-center mb-3">
            <span className="text-primary-foreground font-bold text-lg">M</span>
          </div>
          <h1 className="text-2xl font-semibold">Mirr</h1>
          <p className="text-sm text-muted-foreground">{titleByMode[mode]}</p>
        </div>

        {mode !== "forgot" && !desktop && (
          <>
            <Button
              type="button"
              variant="secondary"
              className="w-full h-11 rounded-xl font-medium"
              onClick={google}
              disabled={loading}
            >
              <svg className="size-4 mr-2" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Войти через Google
            </Button>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">или</span>
              <div className="h-px flex-1 bg-border" />
            </div>
          </>
        )}

        {mode !== "forgot" && desktop && (
          <p className="text-xs text-muted-foreground text-center -mt-2">
            Вход через Google пока доступен только в веб-версии
          </p>
        )}

        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 rounded-xl"
              autoComplete="email"
            />
          </div>
          {mode !== "forgot" && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Пароль</Label>
                {mode === "signin" && (
                  <button
                    type="button"
                    onClick={() => setMode("forgot")}
                    className="text-xs text-primary hover:underline"
                  >
                    Забыли пароль?
                  </button>
                )}
              </div>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 rounded-xl"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
            </div>
          )}
          <Button type="submit" className="w-full h-11 rounded-xl font-medium" disabled={loading}>
            {submitLabelByMode[mode]}
          </Button>
        </form>

        {mode === "forgot" ? (
          <button
            type="button"
            onClick={() => setMode("signin")}
            className="w-full text-sm text-primary hover:underline"
          >
            ← К входу
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="w-full text-sm text-primary hover:underline"
          >
            {mode === "signin" ? "Нет аккаунта? Создать" : "Уже есть аккаунт? Войти"}
          </button>
        )}
      </Card>
    </div>
  );
};

export default Auth;
