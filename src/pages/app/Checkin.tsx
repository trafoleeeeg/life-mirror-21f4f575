import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Sun, Moon, Zap } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { computeStatsFromCheckins } from "@/lib/stats";
import { defaultGlyphState } from "@/components/glyph/GlyphAvatar";
import { bumpAutoExtract } from "@/lib/autoExtract";
import { useNavigate } from "react-router-dom";

const TAGS = ["работа", "отношения", "деньги", "здоровье", "друзья", "творчество", "семья", "одиночество", "тревога", "сон", "смысл"];

const Checkin = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"morning" | "evening" | "moment">("morning");
  const [energy, setEnergy] = useState([60]);
  const [mood, setMood] = useState([55]);
  const [sleep, setSleep] = useState([6.5]);
  const [intent, setIntent] = useState("");
  const [note, setNote] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [recent, setRecent] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("checkins")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString())
      .then(({ count }) => setRecent(count ?? 0));
  }, [user]);

  const togglePicked = (t: string) =>
    setPicked((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));

  const submit = async () => {
    if (!user) {
      toast.error("Войди, чтобы сохранить чек-ин");
      return;
    }
    setSaving(true);
    const payload = {
      user_id: user.id,
      mode,
      energy: mode === "morning" || mode === "evening" ? energy[0] : null,
      mood: mode !== "morning" ? mood[0] : null,
      sleep_hours: mode === "morning" ? sleep[0] : null,
      intent: mode === "morning" ? intent : null,
      note: mode !== "morning" ? note : null,
      tags: picked,
    };
    const { error } = await supabase.from("checkins").insert(payload);
    if (error) {
      setSaving(false);
      toast.error(error.message);
      return;
    }

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
    toast.success("Чек-ин записан", { description: "Статы пересчитаны." });
    setNote("");
    setIntent("");
    setPicked([]);
    bumpAutoExtract();
    setTimeout(() => navigate("/app"), 600);
  };

  return (
    <>
      <PageHeader
        eyebrow={`за 7 дней: ${recent} чек-инов`}
        title="Чек-ин"
        description="Минимум полей — максимум сигнала. Калибровка зеркала."
      />

      <div className="flex gap-2 mb-6">
        {([
          { id: "morning", label: "Утро", icon: Sun },
          { id: "evening", label: "Вечер", icon: Moon },
          { id: "moment", label: "Момент", icon: Zap },
        ] as const).map((m) => (
          <Button
            key={m.id}
            variant={mode === m.id ? "default" : "outline"}
            onClick={() => setMode(m.id)}
          >
            <m.icon className="size-4" />
            {m.label}
          </Button>
        ))}
      </div>

      <Card className="ios-card p-6 space-y-6 max-w-2xl">
        {mode === "morning" && (
          <>
            <Field label={`Сон: ${sleep[0]} ч`}>
              <Slider value={sleep} onValueChange={setSleep} min={0} max={12} step={0.5} />
            </Field>
            <Field label={`Энергия: ${energy[0]}`}>
              <Slider value={energy} onValueChange={setEnergy} min={0} max={100} step={1} />
            </Field>
            <Field label="Намерение дня">
              <Textarea
                value={intent}
                onChange={(e) => setIntent(e.target.value)}
                placeholder="Одна фраза. Что для тебя сегодня важно?"
                rows={2}
              />
            </Field>
          </>
        )}

        {mode === "evening" && (
          <>
            <Field label={`Настроение дня: ${mood[0]}`}>
              <Slider value={mood} onValueChange={setMood} min={0} max={100} step={1} />
            </Field>
            <Field label={`Энергия к вечеру: ${energy[0]}`}>
              <Slider value={energy} onValueChange={setEnergy} min={0} max={100} step={1} />
            </Field>
            <Field label="Темы дня">
              <div className="flex flex-wrap gap-2">
                {TAGS.map((t) => (
                  <button
                    key={t}
                    onClick={() => togglePicked(t)}
                    className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                      picked.includes(t)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border hover:border-primary/60"
                    }`}
                  >
                    #{t}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Главное за день">
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="События, имена, ощущения."
                rows={4}
              />
            </Field>
          </>
        )}

        {mode === "moment" && (
          <>
            <Field label={`Сейчас в моменте: ${mood[0]}`}>
              <Slider value={mood} onValueChange={setMood} min={0} max={100} step={1} />
            </Field>
            <Field label="Что произошло">
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Зафиксируй вспышку — пока свежо."
                rows={3}
              />
            </Field>
          </>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-border/60">
          <p className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
            никаких оценок · только сигнал
          </p>
          <Button onClick={submit} disabled={saving} className="rounded-full">
            {saving ? "Сохраняю…" : "Зафиксировать"}
          </Button>
        </div>
      </Card>
    </>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <div className="mono text-xs uppercase tracking-wider text-muted-foreground mb-2">{label}</div>
    {children}
  </div>
);

export default Checkin;
