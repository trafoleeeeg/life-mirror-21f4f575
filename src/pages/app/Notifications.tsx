import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { enablePush, disablePush, isPushSupported, pushPermissionState } from "@/lib/push";
import { Bell, BellOff, Check, X } from "lucide-react";

const WEEKDAYS = [
  { id: 1, label: "Пн" },
  { id: 2, label: "Вт" },
  { id: 3, label: "Ср" },
  { id: 4, label: "Чт" },
  { id: 5, label: "Пт" },
  { id: 6, label: "Сб" },
  { id: 7, label: "Вс" },
];

const INTERVAL_PRESETS = [
  { v: 30, label: "30 мин" },
  { v: 60, label: "1 ч" },
  { v: 120, label: "2 ч" },
  { v: 180, label: "3 ч" },
  { v: 240, label: "4 ч" },
];

interface Prefs {
  enabled: boolean;
  start_hour: number;
  end_hour: number;
  interval_minutes: number;
  weekdays: number[];
  timezone: string;
  mood_emojis: string[];
  track_mood: boolean;
  track_activity: boolean;
}

const DEFAULTS: Prefs = {
  enabled: true,
  start_hour: 10,
  end_hour: 22,
  interval_minutes: 120,
  weekdays: [1, 2, 3, 4, 5, 6, 7],
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  mood_emojis: ["😞", "😕", "😐", "🙂", "😊", "😄", "😍", "🤩", "🚀", "✨"],
  track_mood: true,
  track_activity: true,
};

const Notifications = () => {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [emojiInput, setEmojiInput] = useState("");

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setPrefs({
          enabled: data.enabled,
          start_hour: data.start_hour,
          end_hour: data.end_hour,
          interval_minutes: data.interval_minutes,
          weekdays: data.weekdays as number[],
          timezone: data.timezone,
          mood_emojis: data.mood_emojis as string[],
          track_mood: data.track_mood,
          track_activity: data.track_activity,
        });
      }
      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("id")
        .eq("user_id", user.id);
      setHasSubscription((subs?.length ?? 0) > 0);
      setPermission(await pushPermissionState());
    })();
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("notification_preferences").upsert(
      {
        user_id: user.id,
        ...prefs,
      },
      { onConflict: "user_id" },
    );
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Настройки сохранены");
  };

  const turnOn = async () => {
    setBusy(true);
    const res = await enablePush();
    setBusy(false);
    if (!res.ok) {
      toast.error(res.reason ?? "Не удалось");
      return;
    }
    setHasSubscription(true);
    setPermission("granted");
    toast.success("Push-уведомления включены");
  };

  const turnOff = async () => {
    setBusy(true);
    await disablePush();
    setBusy(false);
    setHasSubscription(false);
    toast.success("Push выключены");
  };

  const toggleDay = (id: number) => {
    setPrefs((p) => ({
      ...p,
      weekdays: p.weekdays.includes(id)
        ? p.weekdays.filter((d) => d !== id)
        : [...p.weekdays, id].sort((a, b) => a - b),
    }));
  };

  const addEmoji = () => {
    const e = emojiInput.trim();
    if (!e) return;
    if (prefs.mood_emojis.includes(e)) {
      toast.error("Уже есть");
      return;
    }
    setPrefs((p) => ({ ...p, mood_emojis: [...p.mood_emojis, e] }));
    setEmojiInput("");
  };

  const removeEmoji = (e: string) => {
    setPrefs((p) => ({ ...p, mood_emojis: p.mood_emojis.filter((x) => x !== e) }));
  };

  const supported = isPushSupported();
  const inIframeOrPreview = (() => {
    try {
      const inIframe = window.self !== window.top;
      const preview =
        location.hostname.includes("id-preview--") ||
        location.hostname.includes("lovableproject.com");
      return inIframe || preview;
    } catch {
      return true;
    }
  })();

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader
        eyebrow="живой трекинг"
        title="Уведомления"
        description="Гибкое окно, свой ритм. Без спама и стрессовых триггеров."
      />

      <div className="space-y-4">
        <Card className="ios-card p-5 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                {hasSubscription ? (
                  <Bell className="size-4 text-primary" />
                ) : (
                  <BellOff className="size-4 text-muted-foreground" />
                )}
                <h3 className="font-semibold">
                  {hasSubscription ? "Push включён" : "Push выключен"}
                </h3>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Часовой пояс: <span className="font-mono">{prefs.timezone}</span>
              </p>
              {permission === "denied" && (
                <p className="text-xs text-destructive mt-1">
                  Разрешение запрещено в браузере. Открой настройки сайта и разреши уведомления.
                </p>
              )}
              {!supported && (
                <p className="text-xs text-destructive mt-1">
                  Браузер не поддерживает Web Push.
                </p>
              )}
              {inIframeOrPreview && (
                <p className="text-xs text-muted-foreground mt-1">
                  Push работает в опубликованной версии или установленном PWA. На iPhone — добавь
                  приложение на главный экран (iOS 16.4+).
                </p>
              )}
            </div>
            {hasSubscription ? (
              <Button variant="outline" onClick={turnOff} disabled={busy} className="rounded-full">
                Выключить
              </Button>
            ) : (
              <Button
                onClick={turnOn}
                disabled={busy || !supported}
                className="rounded-full"
              >
                Включить
              </Button>
            )}
          </div>
        </Card>

        <Card className="ios-card p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Активны</Label>
              <p className="text-xs text-muted-foreground">Глобальный выключатель напоминаний</p>
            </div>
            <Switch
              checked={prefs.enabled}
              onCheckedChange={(v) => setPrefs((p) => ({ ...p, enabled: v }))}
            />
          </div>

          <div className="space-y-3">
            <Label className="text-sm">
              Окно: {String(prefs.start_hour).padStart(2, "0")}:00 — {String(prefs.end_hour).padStart(2, "0")}:00
              {prefs.end_hour <= prefs.start_hour && (
                <span className="ml-2 text-[11px] text-primary">(через полночь)</span>
              )}
            </Label>
            <p className="text-[11px] text-muted-foreground -mt-1">
              Можно задать ночное окно — например, с 17 до 03. Если конец ≤ начала, окно переходит на следующий день.
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-16">Начало</span>
                <Slider
                  value={[prefs.start_hour]}
                  min={0}
                  max={23}
                  step={1}
                  onValueChange={(v) =>
                    setPrefs((p) => ({ ...p, start_hour: v[0] ?? 10 }))
                  }
                />
                <span className="text-sm font-mono w-10 text-right">
                  {String(prefs.start_hour).padStart(2, "0")}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-16">Конец</span>
                <Slider
                  value={[prefs.end_hour]}
                  min={0}
                  max={23}
                  step={1}
                  onValueChange={(v) =>
                    setPrefs((p) => ({ ...p, end_hour: v[0] ?? 22 }))
                  }
                />
                <span className="text-sm font-mono w-10 text-right">
                  {String(prefs.end_hour).padStart(2, "0")}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Частота</Label>
            <div className="flex flex-wrap gap-2">
              {INTERVAL_PRESETS.map((p) => (
                <button
                  key={p.v}
                  type="button"
                  onClick={() => setPrefs((s) => ({ ...s, interval_minutes: p.v }))}
                  className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
                    prefs.interval_minutes === p.v
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  {p.label}
                </button>
              ))}
              <div className="flex items-center gap-2 ml-1">
                <Input
                  type="number"
                  min={15}
                  max={720}
                  value={prefs.interval_minutes}
                  onChange={(e) =>
                    setPrefs((p) => ({
                      ...p,
                      interval_minutes: Math.max(15, Math.min(720, Number(e.target.value) || 60)),
                    }))
                  }
                  className="w-20 h-9"
                />
                <span className="text-xs text-muted-foreground">мин</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Примерно {(() => {
                const span = prefs.end_hour > prefs.start_hour
                  ? prefs.end_hour - prefs.start_hour
                  : 24 - prefs.start_hour + prefs.end_hour;
                return Math.max(0, Math.floor((span * 60) / prefs.interval_minutes));
              })()} пингов в активный день
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Дни недели</Label>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((d) => {
                const on = prefs.weekdays.includes(d.id);
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => toggleDay(d.id)}
                    className={`size-10 rounded-full border text-sm font-medium transition-colors ${
                      on
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Эмодзи в уведомлениях</Label>
            <div className="flex flex-wrap gap-1.5">
              {prefs.mood_emojis.map((e) => (
                <Badge
                  key={e}
                  variant="secondary"
                  className="text-base px-2.5 py-1 cursor-pointer group"
                  onClick={() => removeEmoji(e)}
                >
                  {e}
                  <X className="size-3 ml-1 opacity-40 group-hover:opacity-100" />
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={emojiInput}
                onChange={(e) => setEmojiInput(e.target.value.slice(0, 4))}
                onKeyDown={(e) => e.key === "Enter" && addEmoji()}
                placeholder="🌊"
                className="w-24"
              />
              <Button size="sm" variant="outline" onClick={addEmoji} className="rounded-full">
                Добавить
              </Button>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="flex items-center justify-between rounded-xl border p-3">
              <div>
                <Label className="text-sm">Трекать настроение</Label>
              </div>
              <Switch
                checked={prefs.track_mood}
                onCheckedChange={(v) => setPrefs((p) => ({ ...p, track_mood: v }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-xl border p-3">
              <div>
                <Label className="text-sm">Трекать действия</Label>
              </div>
              <Switch
                checked={prefs.track_activity}
                onCheckedChange={(v) => setPrefs((p) => ({ ...p, track_activity: v }))}
              />
            </div>
          </div>

          <Button onClick={save} disabled={saving} className="rounded-full w-full sm:w-auto">
            <Check className="size-4 mr-1.5" />
            {saving ? "Сохраняю…" : "Сохранить"}
          </Button>
        </Card>
      </div>
    </div>
  );
};

export default Notifications;
