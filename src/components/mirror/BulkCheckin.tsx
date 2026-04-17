// Массовый чек-ин: выбор N активностей и оценка каждой по шкале 1-10.
// Сохраняет в mood_pings одной записью с массивом activities + JSON-меткой
// в note (`bulk: {label: score, ...}`) для последующей аналитики.
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Plus, X, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { bumpAutoExtract } from "@/lib/autoExtract";

const MOOD_EMOJIS = ["😞", "😕", "😐", "🙂", "😊", "😄", "😍", "🤩", "🚀", "✨"];

const DEFAULTS = [
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

interface Props {
  onSaved?: () => void;
}

export const BulkCheckin = ({ onSaved }: Props) => {
  const { user } = useAuth();
  const [actions, setActions] = useState<QA[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [newLabel, setNewLabel] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await supabase
        .from("quick_actions")
        .select("*")
        .eq("user_id", user.id)
        .order("use_count", { ascending: false });
      const fromDb = (data ?? []) as QA[];
      const seeds = DEFAULTS
        .filter((d) => !fromDb.some((x) => x.label.toLowerCase() === d.label.toLowerCase()))
        .map((q, i) => ({ id: `seed-${i}`, label: q.label, emoji: q.emoji, use_count: 0 }));
      setActions([...fromDb, ...seeds]);
    })();
  }, [user]);

  const selected = useMemo(() => Object.keys(scores), [scores]);

  const toggle = (label: string) =>
    setScores((p) => {
      const next = { ...p };
      if (label in next) delete next[label];
      else next[label] = 6;
      return next;
    });

  const setScore = (label: string, v: number) =>
    setScores((p) => ({ ...p, [label]: v }));

  const addCustom = async () => {
    const label = newLabel.trim();
    if (!label || !user) return;
    if (actions.some((a) => a.label.toLowerCase() === label.toLowerCase())) {
      toast.error("Уже есть"); return;
    }
    const { data, error } = await supabase
      .from("quick_actions")
      .insert({ user_id: user.id, label, emoji: "✨", position: actions.length })
      .select().single();
    if (error) { toast.error(error.message); return; }
    setActions((p) => [data as QA, ...p]);
    setScores((p) => ({ ...p, [label]: 6 }));
    setNewLabel("");
  };

  const submit = async () => {
    if (!user) { toast.error("Войди"); return; }
    if (selected.length === 0) { toast.error("Выбери хотя бы одно"); return; }
    setSaving(true);

    // average mood = mean of all scores
    const vals = Object.values(scores);
    const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    const mood = Math.max(1, Math.min(10, avg));
    const emoji = MOOD_EMOJIS[mood - 1];

    // bump quick_actions
    for (const label of selected) {
      const a = actions.find((x) => x.label === label);
      if (!a) continue;
      if (a.id.startsWith("seed-")) {
        await supabase.from("quick_actions")
          .insert({ user_id: user.id, label: a.label, emoji: a.emoji, use_count: 1 });
      } else {
        await supabase.from("quick_actions")
          .update({ use_count: a.use_count + 1 }).eq("id", a.id);
      }
    }

    const noteJson = `bulk:${JSON.stringify(scores)}`;
    const { error } = await supabase.from("mood_pings").insert({
      user_id: user.id, mood, emoji, activities: selected,
      note: noteJson, source: "bulk",
    });
    if (error) { setSaving(false); toast.error(error.message); return; }

    bumpAutoExtract();
    setSaving(false);
    setScores({});
    toast.success(`Записано: ${selected.length} активностей`);
    onSaved?.();
  };

  return (
    <Card className="ios-card p-5 space-y-4 animate-scale-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListChecks className="size-4 text-primary" />
          <p className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
            массовый чек-ин
          </p>
        </div>
        <span className="text-xs text-muted-foreground">
          {selected.length > 0 ? `выбрано ${selected.length}` : "выбери активности"}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {actions.slice(0, 16).map((a) => {
          const on = a.label in scores;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => toggle(a.label)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs transition-colors ${
                on ? "border-primary bg-primary/15" : "border-border hover:border-primary/40"
              }`}
            >
              <span>{a.emoji}</span>
              <span>{a.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex gap-2">
        <Input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Своя активность…"
          onKeyDown={(e) => e.key === "Enter" && addCustom()}
          className="flex-1 rounded-full h-9 text-sm"
        />
        <Button size="icon" variant="secondary" onClick={addCustom}
          className="rounded-full size-9 shrink-0">
          <Plus className="size-4" />
        </Button>
      </div>

      {selected.length > 0 && (
        <div className="space-y-3 pt-1 border-t border-border/50">
          {selected.map((label) => {
            const a = actions.find((x) => x.label === label);
            const v = scores[label];
            return (
              <div key={label} className="space-y-1.5 animate-slide-up">
                <div className="flex items-center justify-between">
                  <span className="text-sm flex items-center gap-1.5">
                    <span>{a?.emoji ?? "✨"}</span>
                    <span>{label}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="mono text-sm w-9 text-right">{v}/10</span>
                    <button
                      onClick={() => toggle(label)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Убрать"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                </div>
                <Slider
                  value={[v]} min={1} max={10} step={1}
                  onValueChange={(arr) => setScore(label, arr[0] ?? 5)}
                  className="mood-slider"
                />
              </div>
            );
          })}
        </div>
      )}

      <Button
        onClick={submit}
        disabled={saving || selected.length === 0}
        className="w-full h-11 rounded-full font-medium"
      >
        {saving ? "Сохраняю…" : `Сохранить (${selected.length})`}
      </Button>
    </Card>
  );
};
