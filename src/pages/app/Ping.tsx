import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Plus, X, Sparkles } from "lucide-react";
import { computeStatsFromCheckins } from "@/lib/stats";
import { defaultGlyphState } from "@/components/glyph/GlyphAvatar";

const DEFAULT_EMOJIS = ["😞", "😕", "😐", "🙂", "😊", "😄", "😍", "🤩", "🚀", "✨"];
const MOOD_LABELS = [
  "На дне",
  "Тяжело",
  "Туман",
  "Серединка",
  "Норм",
  "Хорошо",
  "Отлично",
  "Кайф",
  "Полёт",
  "Космос",
];

interface QA {
  id: string;
  label: string;
  emoji: string;
  use_count: number;
}

const DEFAULT_QA: { label: string; emoji: string }[] = [
  { label: "Работа", emoji: "💻" },
  { label: "Спорт", emoji: "🏋️" },
  { label: "Еда", emoji: "🍳" },
  { label: "Прогулка", emoji: "🚶" },
  { label: "Чтение", emoji: "📖" },
  { label: "Друзья", emoji: "👥" },
  { label: "Семья", emoji: "🏡" },
  { label: "Отдых", emoji: "🛋️" },
];

const Ping = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const source = params.get("source") || "manual";

  const [mood, setMood] = useState(6);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [actions, setActions] = useState<QA[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [newEmoji, setNewEmoji] = useState("✨");
  const [showCustom, setShowCustom] = useState(false);
  const [saving, setSaving] = useState(false);

  const moodEmoji = useMemo(() => DEFAULT_EMOJIS[Math.max(0, Math.min(9, mood - 1))], [mood]);
  const moodLabel = useMemo(() => MOOD_LABELS[Math.max(0, Math.min(9, mood - 1))], [mood]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await supabase
        .from("quick_actions")
        .select("*")
        .eq("user_id", user.id)
        .order("use_count", { ascending: false })
        .order("position", { ascending: true });
      if (data && data.length) {
        setActions(data as QA[]);
      } else {
        // seed defaults locally — no DB write until user actually picks one
        setActions(
          DEFAULT_QA.map((q, i) => ({
            id: `seed-${i}`,
            label: q.label,
            emoji: q.emoji,
            use_count: 0,
          })),
        );
      }
    })();
  }, [user]);

  const toggle = (label: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  };

  const addCustom = async () => {
    const label = newLabel.trim();
    if (!label || !user) return;
    if (actions.some((a) => a.label.toLowerCase() === label.toLowerCase())) {
      toast.error("Уже есть такой");
      return;
    }
    const emoji = newEmoji || "✨";
    const { data, error } = await supabase
      .from("quick_actions")
      .insert({ user_id: user.id, label, emoji, position: actions.length })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    setActions((prev) => [data as QA, ...prev]);
    setSelected((prev) => new Set(prev).add(label));
    setNewLabel("");
    setNewEmoji("✨");
    setShowCustom(false);
  };

  const removeAction = async (a: QA) => {
    if (a.id.startsWith("seed-")) {
      setActions((prev) => prev.filter((x) => x.id !== a.id));
      return;
    }
    await supabase.from("quick_actions").delete().eq("id", a.id);
    setActions((prev) => prev.filter((x) => x.id !== a.id));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(a.label);
      return next;
    });
  };

  const submit = async () => {
    if (!user) return;
    setSaving(true);
    const activities = Array.from(selected);

    // Persist any seeded actions the user actually used
    for (const label of activities) {
      const a = actions.find((x) => x.label === label);
      if (a?.id.startsWith("seed-")) {
        await supabase
          .from("quick_actions")
          .insert({
            user_id: user.id,
            label: a.label,
            emoji: a.emoji,
            use_count: 1,
          })
          .select()
          .single()
          .then(({ data }) => {
            if (data) {
              setActions((prev) =>
                prev.map((x) => (x.id === a.id ? (data as QA) : x)),
              );
            }
          });
      } else if (a) {
        await supabase
          .from("quick_actions")
          .update({ use_count: a.use_count + 1 })
          .eq("id", a.id);
      }
    }

    const { error } = await supabase.from("mood_pings").insert({
      user_id: user.id,
      mood,
      emoji: moodEmoji,
      activities,
      note: note.trim() || null,
      source,
    });
    if (error) {
      setSaving(false);
      toast.error(error.message);
      return;
    }

    // Recompute stats: pings affect emotions/body/mind as a mini-signal
    const [{ data: history }, { data: pingHistory }, { data: lastStats }] = await Promise.all([
      supabase
        .from("checkins")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("mood_pings")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("glyph_stats")
        .select("body,mind,emotions,relationships,career,finance,creativity,meaning")
        .eq("user_id", user.id)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    const base = (lastStats as typeof defaultGlyphState | null) ?? defaultGlyphState;
    const next = computeStatsFromCheckins(history ?? [], base, pingHistory ?? []);
    await supabase.from("glyph_stats").insert({ user_id: user.id, ...next });

    setSaving(false);
    toast.success("Записано в зеркало");
    navigate("/app");
  };

  return (
    <>
      <PageHeader
        eyebrow="микро-чек"
        title="Как ты сейчас?"
        description="30 секунд. Это формирует твоё зеркало точнее любых тестов."
      />

      <div className="space-y-4 max-w-2xl">
        <Card className="ios-card p-6 space-y-6">
          <div className="text-center space-y-2">
            <div className="text-7xl leading-none">{moodEmoji}</div>
            <div className="text-2xl font-semibold tracking-tight">{mood}/10</div>
            <div className="text-sm text-muted-foreground">{moodLabel}</div>
          </div>
          <Slider
            value={[mood]}
            min={1}
            max={10}
            step={1}
            onValueChange={(v) => setMood(v[0] ?? 5)}
          />
          <div className="flex justify-between text-[10px] text-muted-foreground px-1">
            {DEFAULT_EMOJIS.map((e, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setMood(i + 1)}
                className={`size-6 grid place-items-center rounded-md transition-opacity ${
                  i + 1 === mood ? "opacity-100 scale-110" : "opacity-50 hover:opacity-100"
                }`}
                aria-label={`Настроение ${i + 1}`}
              >
                {e}
              </button>
            ))}
          </div>
        </Card>

        <Card className="ios-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Что делал?</Label>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowCustom((s) => !s)}
              className="rounded-full text-xs"
            >
              <Plus className="size-3.5 mr-1" />
              Своё
            </Button>
          </div>

          {showCustom && (
            <div className="flex gap-2">
              <Input
                value={newEmoji}
                onChange={(e) => setNewEmoji(e.target.value.slice(0, 2))}
                className="w-14 text-center"
                placeholder="✨"
              />
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="например, медитация"
                onKeyDown={(e) => e.key === "Enter" && addCustom()}
                className="flex-1"
              />
              <Button size="sm" onClick={addCustom} className="rounded-full">
                Добавить
              </Button>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {actions.map((a) => {
              const on = selected.has(a.label);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggle(a.label)}
                  className={`group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm transition-colors ${
                    on
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <span>{a.emoji}</span>
                  <span>{a.label}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeAction(a);
                    }}
                    className="ml-0.5 opacity-0 group-hover:opacity-60 hover:opacity-100 transition-opacity"
                    aria-label={`Удалить ${a.label}`}
                  >
                    <X className="size-3" />
                  </span>
                </button>
              );
            })}
          </div>
          {selected.size > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {Array.from(selected).map((l) => (
                <Badge key={l} variant="secondary" className="text-xs">
                  {l}
                </Badge>
              ))}
            </div>
          )}
        </Card>

        <Card className="ios-card p-5 space-y-2">
          <Label htmlFor="ping-note" className="text-sm">
            Заметка (опционально)
          </Label>
          <Textarea
            id="ping-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Что важного? С кем? Какое чувство?"
            rows={3}
          />
        </Card>

        <div className="flex gap-2">
          <Button
            onClick={submit}
            disabled={saving}
            className="flex-1 h-12 rounded-full font-semibold"
          >
            <Sparkles className="size-4 mr-1.5" />
            {saving ? "Сохраняю…" : "Записать"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => navigate("/app")}
            className="rounded-full"
          >
            Позже
          </Button>
        </div>
      </div>
    </>
  );
};

export default Ping;
