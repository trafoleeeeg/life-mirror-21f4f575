import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, X, Check } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { computeStatsFromCheckins } from "@/lib/stats";
import { defaultGlyphState } from "@/components/glyph/GlyphAvatar";
import { bumpAutoExtract } from "@/lib/autoExtract";

const MOOD_EMOJIS = ["😞", "😕", "😐", "🙂", "😊", "😄", "😍", "🤩", "🚀", "✨"];
const MOOD_LABELS = [
  "На дне", "Тяжело", "Туман", "Серединка", "Норм",
  "Хорошо", "Отлично", "Кайф", "Полёт", "Космос",
];

const DEFAULT_QA: { label: string; emoji: string }[] = [
  { label: "Работа", emoji: "💼" },
  { label: "Спорт", emoji: "🏃" },
  { label: "Отдых", emoji: "🛋️" },
  { label: "Еда", emoji: "🍽️" },
  { label: "Сон", emoji: "😴" },
  { label: "Учёба", emoji: "📚" },
  { label: "Прогулка", emoji: "🚶" },
  { label: "Общение", emoji: "💬" },
];

interface QA {
  id: string;
  label: string;
  emoji: string;
  use_count: number;
}

const Checkin = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [mood, setMood] = useState(5);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [actions, setActions] = useState<QA[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [saving, setSaving] = useState(false);

  const moodEmoji = useMemo(() => MOOD_EMOJIS[Math.max(0, Math.min(9, mood - 1))], [mood]);
  const moodLabel = useMemo(() => MOOD_LABELS[Math.max(0, Math.min(9, mood - 1))], [mood]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await supabase
        .from("quick_actions")
        .select("*")
        .eq("user_id", user.id)
        .order("use_count", { ascending: false });
      const fromDb = (data ?? []) as QA[];
      const seeds = DEFAULT_QA
        .filter((d) => !fromDb.some((x) => x.label.toLowerCase() === d.label.toLowerCase()))
        .map((q, i) => ({ id: `seed-${i}`, label: q.label, emoji: q.emoji, use_count: 0 }));
      setActions([...fromDb, ...seeds]);
    })();
  }, [user]);

  const toggle = (label: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });

  const addCustom = async () => {
    const label = newLabel.trim();
    if (!label || !user) return;
    if (actions.some((a) => a.label.toLowerCase() === label.toLowerCase())) {
      toast.error("Уже есть такая активность");
      return;
    }
    const { data, error } = await supabase
      .from("quick_actions")
      .insert({ user_id: user.id, label, emoji: "✨", position: actions.length })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    setActions((prev) => [data as QA, ...prev]);
    setSelected((prev) => new Set(prev).add(label));
    setNewLabel("");
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
    if (!user) {
      toast.error("Войди, чтобы сохранить");
      return;
    }
    setSaving(true);
    const activities = Array.from(selected);

    // persist seed actions when actually used + bump counters
    for (const label of activities) {
      const a = actions.find((x) => x.label === label);
      if (!a) continue;
      if (a.id.startsWith("seed-")) {
        const { data } = await supabase
          .from("quick_actions")
          .insert({ user_id: user.id, label: a.label, emoji: a.emoji, use_count: 1 })
          .select()
          .single();
        if (data) {
          setActions((prev) => prev.map((x) => (x.id === a.id ? (data as QA) : x)));
        }
      } else {
        await supabase
          .from("quick_actions")
          .update({ use_count: a.use_count + 1 })
          .eq("id", a.id);
      }
    }

    // Save as a mood_ping (single-mode check-in)
    const { error } = await supabase.from("mood_pings").insert({
      user_id: user.id,
      mood,
      emoji: moodEmoji,
      activities,
      note: note.trim() || null,
      source: "checkin",
    });
    if (error) {
      setSaving(false);
      toast.error(error.message);
      return;
    }

    // Recompute stats off pings + checkins
    const [{ data: history }, { data: pingHistory }, { data: lastStats }] = await Promise.all([
      supabase.from("checkins").select("*").eq("user_id", user.id)
        .order("created_at", { ascending: false }).limit(50),
      supabase.from("mood_pings").select("*").eq("user_id", user.id)
        .order("created_at", { ascending: false }).limit(200),
      supabase.from("glyph_stats")
        .select("body,mind,emotions,relationships,career,finance,creativity,meaning")
        .eq("user_id", user.id).order("recorded_at", { ascending: false })
        .limit(1).maybeSingle(),
    ]);
    const base = (lastStats as typeof defaultGlyphState | null) ?? defaultGlyphState;
    const next = computeStatsFromCheckins(history ?? [], base, pingHistory ?? []);
    await supabase.from("glyph_stats").insert({ user_id: user.id, ...next });

    setSaving(false);
    toast.success("Чек-ин записан");
    bumpAutoExtract();
    setNote("");
    setSelected(new Set());
    setTimeout(() => navigate("/app"), 400);
  };

  return (
    <>
      <PageHeader title="Новый чек-ин" />

      <div className="space-y-4 max-w-2xl mx-auto">
        {/* Mood */}
        <Card className="ios-card p-6 space-y-5">
          <div className="flex items-center justify-between">
            <Label className="text-base font-medium">Настроение</Label>
            <div className="text-3xl leading-none">{moodEmoji}</div>
          </div>

          <div>
            <Slider
              value={[mood]}
              min={1}
              max={10}
              step={1}
              onValueChange={(v) => setMood(v[0] ?? 5)}
              className="mood-slider"
            />
            <div className="flex justify-between mt-2 mono text-xs text-muted-foreground">
              <span>1</span>
              <span>5</span>
              <span>10</span>
            </div>
            <p className="text-center text-sm mt-2">
              <span className="mono">{mood}/10</span>
              <span className="text-muted-foreground"> · {moodLabel}</span>
            </p>
          </div>
        </Card>

        {/* Activities */}
        <Card className="ios-card p-5 space-y-3">
          <Label className="text-sm">Чем занимался?</Label>

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
                      ? "border-primary bg-primary/15 text-foreground"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <span>{a.emoji}</span>
                  <span>{a.label}</span>
                  {on && <Check className="size-3.5 text-primary" />}
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

          <div className="flex gap-2 pt-1">
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Своя активность…"
              onKeyDown={(e) => e.key === "Enter" && addCustom()}
              className="flex-1 rounded-full"
            />
            <Button
              size="icon"
              variant="secondary"
              onClick={addCustom}
              className="rounded-full shrink-0"
              aria-label="Добавить активность"
            >
              <Plus className="size-4" />
            </Button>
          </div>
        </Card>

        {/* Note */}
        <Card className="ios-card p-5 space-y-2">
          <Label htmlFor="checkin-note" className="text-sm">
            Заметка (опционально)
          </Label>
          <Textarea
            id="checkin-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Что-то важное за этот час…"
            rows={4}
          />
        </Card>

        <Button
          onClick={submit}
          disabled={saving}
          className="w-full h-14 rounded-full text-base font-semibold"
        >
          {saving ? "Сохраняю…" : "Сохранить чек-ин"}
        </Button>
      </div>
    </>
  );
};

export default Checkin;
