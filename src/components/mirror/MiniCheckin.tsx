// Inline check-in (mood slider + activities + note) used inside MirrorPage Today tab.
import { useEffect, useMemo, useState } from "react";
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

const DEFAULT_QA = [
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

export const MiniCheckin = ({ onSaved }: Props) => {
  const { user } = useAuth();
  const [mood, setMood] = useState(5);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [actions, setActions] = useState<QA[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [showNote, setShowNote] = useState(false);

  const moodEmoji = useMemo(() => MOOD_EMOJIS[Math.max(0, Math.min(9, mood - 1))], [mood]);
  const moodLabel = useMemo(() => MOOD_LABELS[Math.max(0, Math.min(9, mood - 1))], [mood]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await supabase
        .from("quick_actions").select("*").eq("user_id", user.id)
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
      toast.error("Уже есть"); return;
    }
    const { data, error } = await supabase
      .from("quick_actions")
      .insert({ user_id: user.id, label, emoji: "✨", position: actions.length })
      .select().single();
    if (error) { toast.error(error.message); return; }
    setActions((p) => [data as QA, ...p]);
    setSelected((p) => new Set(p).add(label));
    setNewLabel("");
  };

  const removeAction = async (a: QA) => {
    if (a.id.startsWith("seed-")) {
      setActions((p) => p.filter((x) => x.id !== a.id));
      return;
    }
    await supabase.from("quick_actions").delete().eq("id", a.id);
    setActions((p) => p.filter((x) => x.id !== a.id));
    setSelected((p) => { const n = new Set(p); n.delete(a.label); return n; });
  };

  const submit = async () => {
    if (!user) { toast.error("Войди"); return; }
    setSaving(true);
    const activities = Array.from(selected);
    for (const label of activities) {
      const a = actions.find((x) => x.label === label);
      if (!a) continue;
      if (a.id.startsWith("seed-")) {
        const { data } = await supabase.from("quick_actions")
          .insert({ user_id: user.id, label: a.label, emoji: a.emoji, use_count: 1 })
          .select().single();
        if (data) setActions((p) => p.map((x) => (x.id === a.id ? (data as QA) : x)));
      } else {
        await supabase.from("quick_actions").update({ use_count: a.use_count + 1 }).eq("id", a.id);
      }
    }
    const { error } = await supabase.from("mood_pings").insert({
      user_id: user.id, mood, emoji: moodEmoji, activities,
      note: note.trim() || null, source: "checkin",
    });
    if (error) { setSaving(false); toast.error(error.message); return; }

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
    toast.success("Записано");
    bumpAutoExtract();
    setNote(""); setSelected(new Set()); setShowNote(false);
    onSaved?.();
  };

  return (
    <Card className="ios-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="mono text-[10px] uppercase tracking-widest text-muted-foreground">быстрый чек-ин</p>
          <p className="text-sm mt-0.5">
            <span className="mono">{mood}/10</span>
            <span className="text-muted-foreground"> · {moodLabel}</span>
          </p>
        </div>
        <div className="text-4xl leading-none">{moodEmoji}</div>
      </div>

      <Slider value={[mood]} min={1} max={10} step={1}
        onValueChange={(v) => setMood(v[0] ?? 5)} className="mood-slider" />

      <div className="flex flex-wrap gap-1.5">
        {actions.slice(0, 12).map((a) => {
          const on = selected.has(a.label);
          return (
            <button key={a.id} type="button" onClick={() => toggle(a.label)}
              className={`group inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs transition-colors ${
                on ? "border-primary bg-primary/15" : "border-border hover:border-primary/40"
              }`}>
              <span>{a.emoji}</span>
              <span>{a.label}</span>
              {on && <Check className="size-3 text-primary" />}
              <span role="button" tabIndex={0}
                onClick={(e) => { e.stopPropagation(); removeAction(a); }}
                className="opacity-0 group-hover:opacity-50 hover:opacity-100"
                aria-label="del">
                <X className="size-2.5" />
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex gap-2">
        <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Своя…" onKeyDown={(e) => e.key === "Enter" && addCustom()}
          className="flex-1 rounded-full h-9 text-sm" />
        <Button size="icon" variant="secondary" onClick={addCustom}
          className="rounded-full size-9 shrink-0">
          <Plus className="size-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setShowNote((v) => !v)}
          className="rounded-full text-xs">
          {showNote ? "Без заметки" : "+ Заметка"}
        </Button>
      </div>

      {showNote && (
        <div>
          <Label htmlFor="mini-note" className="text-xs text-muted-foreground">Заметка</Label>
          <Textarea id="mini-note" value={note} onChange={(e) => setNote(e.target.value)}
            rows={3} placeholder="Что сейчас на уме…" className="mt-1" />
        </div>
      )}

      <Button onClick={submit} disabled={saving}
        className="w-full h-11 rounded-full font-medium">
        {saving ? "Сохраняю…" : "Сохранить"}
      </Button>
    </Card>
  );
};
