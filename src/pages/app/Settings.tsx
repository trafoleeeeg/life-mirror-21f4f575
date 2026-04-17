import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Camera, Copy, Download, LogOut, Trash2, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { Textarea } from "@/components/ui/textarea";

type Tone = "soft" | "hard" | "socratic";
type Lang = "ru" | "en";

const Settings = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [tone, setTone] = useState<Tone>("soft");
  const [language, setLanguage] = useState<Lang>("ru");
  const [emailNotif, setEmailNotif] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name, username, bio, ai_tone, language, email_notifications, avatar_url")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setName(data.display_name ?? "");
        setUsername((data as { username?: string | null }).username ?? "");
        setBio((data as { bio?: string | null }).bio ?? "");
        setTone((data.ai_tone as Tone) ?? "soft");
        setLanguage(((data as { language?: Lang }).language ?? "ru"));
        setEmailNotif((data as { email_notifications?: boolean }).email_notifications ?? true);
        setAvatarUrl(data.avatar_url ?? null);
      });
  }, [user]);

  const save = async () => {
    if (!user) return;
    const u = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (u && (u.length < 3 || u.length > 24)) {
      toast.error("Никнейм 3–24 символа: латиница, цифры, _");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: name,
        username: u || null,
        bio: bio.trim() || null,
        ai_tone: tone,
        language,
        email_notifications: emailNotif,
      })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      if (String(error.message).includes("duplicate") || String(error.message).includes("unique")) {
        toast.error("Этот никнейм уже занят");
      } else {
        toast.error(error.message);
      }
    } else {
      setUsername(u);
      toast.success("Сохранено");
    }
  };

  const copyId = async () => {
    if (!user) return;
    await navigator.clipboard.writeText(user.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const onAvatarPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Файл больше 5 МБ");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (upErr) {
      setUploading(false);
      toast.error(upErr.message);
      return;
    }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const url = data.publicUrl;
    await supabase.from("profiles").update({ avatar_url: url }).eq("user_id", user.id);
    setAvatarUrl(url);
    setUploading(false);
    toast.success("Аватар обновлён");
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
      // wipe data we own (RLS lets the user delete their own rows)
      await Promise.all([
        supabase.from("chat_messages").delete().eq("user_id", user.id),
        supabase.from("chat_sessions").delete().eq("user_id", user.id),
        supabase.from("checkins").delete().eq("user_id", user.id),
        supabase.from("glyph_stats").delete().eq("user_id", user.id),
      ]);
      // best-effort: list & remove avatar files
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

  const initials = (name || user?.email || "??").slice(0, 2).toUpperCase();

  return (
    <>
      <PageHeader eyebrow="ты управляешь зеркалом" title="Профиль" description="Прозрачно. Без серых зон." />

      <div className="space-y-4 max-w-2xl">
        <Card className="ios-card p-5 space-y-5">
          <div className="flex items-center gap-4">
            <Avatar className="size-20">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={onAvatarPick}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="rounded-full"
              >
                <Camera className="size-4 mr-1.5" />
                {uploading ? "Загрузка…" : "Сменить фото"}
              </Button>
              <p className="text-xs text-muted-foreground mt-2">JPG/PNG, до 5 МБ</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="name">Имя</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="username">Никнейм</Label>
            <div className="flex items-center gap-2">
              <span className="mono text-muted-foreground text-sm">@</span>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="my_handle"
                className="h-11 rounded-xl flex-1"
                maxLength={24}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              3–24 символа: латиница, цифры, _. Будет твоей публичной страницей{" "}
              {username && (
                <Link to={`/app/u/${username.toLowerCase()}`} className="text-primary underline-offset-2 hover:underline">
                  /u/{username.toLowerCase()}
                </Link>
              )}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bio">О себе</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Коротко о тебе — видно другим участникам"
              rows={2}
              maxLength={160}
              className="resize-none rounded-xl"
            />
            <p className="text-xs text-muted-foreground text-right">{bio.length}/160</p>
          </div>

          <div className="space-y-1.5">
            <Label>ID пользователя</Label>
            <div className="flex items-center gap-2 p-2.5 bg-muted/50 rounded-xl">
              <code className="mono text-xs flex-1 truncate select-all">{user?.id}</code>
              <Button size="sm" variant="ghost" onClick={copyId} className="h-7 shrink-0">
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              </Button>
            </div>
          </div>

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
            <p className="text-xs text-muted-foreground">Полная локализация — на следующих этапах.</p>
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
                <p className="text-sm text-muted-foreground">
                  Микро-чек настроения по гибкому расписанию.
                </p>
              </div>
            </div>
            <Button asChild variant="outline" className="rounded-full shrink-0">
              <Link to="/app/notifications">Настроить</Link>
            </Button>
          </div>
        </Card>

        <Card className="ios-card p-5 space-y-3">
          <h3 className="font-semibold">Аккаунт</h3>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportData} disabled={exporting} className="rounded-full">
              <Download className="size-4 mr-1.5" />
              {exporting ? "Готовлю…" : "Экспорт данных"}
            </Button>
            <Button variant="secondary" onClick={logout} className="rounded-full">
              <LogOut className="size-4 mr-1.5" />
              Выйти
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
                <Trash2 className="size-4 mr-1.5" />
                Удалить аккаунт
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

        <Card className="ios-card p-5">
          <h3 className="font-semibold mb-2">Этика</h3>
          <ul className="text-sm text-muted-foreground space-y-1.5">
            <li>• Все автоматические выводы AI помечены как «гипотеза» и могут быть отклонены.</li>
            <li>• Глиф никогда не «умирает» — только мягкое отражение.</li>
            <li>• Никаких метрик стрика ради стрика. Никаких публичных штрафов.</li>
          </ul>
        </Card>
      </div>
    </>
  );
};

export default Settings;
