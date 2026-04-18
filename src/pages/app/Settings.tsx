// Settings — только приватные настройки: AI-тон, язык, уведомления, экспорт, удаление.
// Имя/никнейм/био/аватар редактируются в /app/me.
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Download, LogOut, Trash2, User as UserIcon } from "lucide-react";
import { UpdateSection } from "@/components/UpdateSection";

type Tone = "soft" | "hard" | "socratic";
type Lang = "ru" | "en";

const Settings = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [tone, setTone] = useState<Tone>("soft");
  const [language, setLanguage] = useState<Lang>("ru");
  const [emailNotif, setEmailNotif] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("ai_tone, language, email_notifications")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setTone((data.ai_tone as Tone) ?? "soft");
        setLanguage(((data as { language?: Lang }).language ?? "ru"));
        setEmailNotif((data as { email_notifications?: boolean }).email_notifications ?? true);
      });
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ ai_tone: tone, language, email_notifications: emailNotif })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Сохранено");
  };

  const exportData = async () => {
    if (!user) return;
    setExporting(true);
    try {
      const [profile, stats, sessions, messages, checkins] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", user.id),
        supabase.from("glyph_stats").select("*").eq("user_id", user.id),
        supabase.from("chat_sessions").select("*").eq("user_id", user.id),
        supabase.from("chat_messages").select("*").eq("user_id", user.id),
        supabase.from("checkins").select("*").eq("user_id", user.id),
      ]);
      const bundle = {
        exported_at: new Date().toISOString(),
        user_id: user.id,
        email: user.email,
        profile: profile.data,
        glyph_stats: stats.data,
        chat_sessions: sessions.data,
        chat_messages: messages.data,
        checkins: checkins.data,
      };
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `inner-glyph-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Экспорт готов");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось экспортировать");
    } finally {
      setExporting(false);
    }
  };

  const deleteAccount = async () => {
    if (!user) return;
    setDeleting(true);
    try {
      await Promise.all([
        supabase.from("chat_messages").delete().eq("user_id", user.id),
        supabase.from("chat_sessions").delete().eq("user_id", user.id),
        supabase.from("checkins").delete().eq("user_id", user.id),
        supabase.from("glyph_stats").delete().eq("user_id", user.id),
      ]);
      const { data: files } = await supabase.storage.from("avatars").list(user.id);
      if (files?.length) {
        await supabase.storage.from("avatars").remove(files.map((f) => `${user.id}/${f.name}`));
      }
      await signOut();
      toast.success("Данные удалены. До свидания.");
      navigate("/");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка удаления");
    } finally {
      setDeleting(false);
    }
  };

  const logout = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader eyebrow="управляешь зеркалом" title="Настройки" description="Приватность, AI и аккаунт." />

      <div className="space-y-4">
        {/* Профиль вынесен на отдельную страницу */}
        <Card className="ios-card p-5 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="size-10 rounded-xl bg-primary/10 grid place-items-center">
              <UserIcon className="size-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Профиль</h3>
              <p className="text-sm text-muted-foreground">Имя, @username, био, аватар</p>
            </div>
          </div>
          <Button asChild variant="outline" className="rounded-full shrink-0">
            <Link to="/app/me">Открыть</Link>
          </Button>
        </Card>

        <Card className="ios-card p-5 space-y-5">
          <div className="space-y-2">
            <Label>Тон AI-психолога</Label>
            <div className="grid sm:grid-cols-3 gap-2">
              {[
                { id: "soft", label: "Мягкий" },
                { id: "socratic", label: "Сократ" },
                { id: "hard", label: "Жёсткий" },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTone(t.id as Tone)}
                  className={`p-3 rounded-xl border text-sm transition-colors ${
                    tone === t.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Язык интерфейса</Label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "ru", label: "Русский" },
                { id: "en", label: "English" },
              ].map((l) => (
                <button
                  key={l.id}
                  onClick={() => setLanguage(l.id as Lang)}
                  className={`p-3 rounded-xl border text-sm transition-colors ${
                    language === l.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Email-уведомления</Label>
              <p className="text-xs text-muted-foreground">Только важное. Без спама.</p>
            </div>
            <Switch checked={emailNotif} onCheckedChange={setEmailNotif} />
          </div>

          <Button onClick={save} disabled={saving} className="rounded-full w-full sm:w-auto">
            Сохранить
          </Button>
        </Card>

        <Card className="ios-card p-5 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-xl bg-primary/10 grid place-items-center">
                <Bell className="size-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Push-уведомления</h3>
                <p className="text-sm text-muted-foreground">Микро-чек настроения по гибкому расписанию.</p>
              </div>
            </div>
            <Button asChild variant="outline" className="rounded-full shrink-0">
              <Link to="/app/notifications">Настроить</Link>
            </Button>
          </div>
        </Card>

        <UpdateSection />

        <Card className="ios-card p-5 space-y-3">
          <h3 className="font-semibold">Аккаунт</h3>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportData} disabled={exporting} className="rounded-full">
              <Download className="size-4 mr-1.5" />
              {exporting ? "Готовлю…" : "Экспорт данных"}
            </Button>
            <Button variant="secondary" onClick={logout} className="rounded-full">
              <LogOut className="size-4 mr-1.5" />Выйти
            </Button>
          </div>
        </Card>

        <Card className="ios-card p-5 space-y-3 border-destructive/30">
          <h3 className="font-semibold text-destructive">Опасная зона</h3>
          <p className="text-sm text-muted-foreground">
            Удаление навсегда сотрёт твои чек-ины, чаты, статы и аватар.
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={deleting} className="rounded-full">
                <Trash2 className="size-4 mr-1.5" />Удалить аккаунт
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Точно удалить?</AlertDialogTitle>
                <AlertDialogDescription>
                  Это действие необратимо. Все твои данные будут стёрты, ты выйдешь из аккаунта.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Отмена</AlertDialogCancel>
                <AlertDialogAction onClick={deleteAccount} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Удалить навсегда
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        </Card>
      </div>
    </div>
  );
};

export default Settings;
