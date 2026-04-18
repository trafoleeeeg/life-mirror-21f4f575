import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase автоматически разбирает hash с recovery-токеном и создаёт сессию
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });
    // Если уже есть активная сессия (юзер открыл ссылку из письма) — тоже ок
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Пароль должен быть минимум 6 символов");
      return;
    }
    if (password !== confirm) {
      toast.error("Пароли не совпадают");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Пароль обновлён");
      navigate("/app");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <Card className="ios-card w-full max-w-sm p-8 space-y-6">
        <div className="text-center space-y-1">
          <div className="mx-auto size-10 rounded-2xl bg-primary flex items-center justify-center mb-3">
            <span className="text-primary-foreground font-bold text-lg">M</span>
          </div>
          <h1 className="text-2xl font-semibold">Новый пароль</h1>
          <p className="text-sm text-muted-foreground">
            {ready ? "Введите новый пароль для вашего аккаунта" : "Проверяем ссылку…"}
          </p>
        </div>

        {ready && (
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="password">Новый пароль</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 rounded-xl"
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Повторите пароль</Label>
              <Input
                id="confirm"
                type="password"
                required
                minLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="h-11 rounded-xl"
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" className="w-full h-11 rounded-xl font-medium" disabled={loading}>
              Сохранить пароль
            </Button>
          </form>
        )}

        <button
          type="button"
          onClick={() => navigate("/auth")}
          className="w-full text-sm text-primary hover:underline"
        >
          ← К входу
        </button>
      </Card>
    </div>
  );
};

export default ResetPassword;
