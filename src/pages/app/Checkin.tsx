import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Sun, Moon, Zap } from "lucide-react";
import { toast } from "sonner";

const TAGS = ["работа", "отношения", "деньги", "здоровье", "друзья", "творчество", "семья", "одиночество"];

const Checkin = () => {
  const [mode, setMode] = useState<"morning" | "evening" | "moment">("morning");
  const [energy, setEnergy] = useState([60]);
  const [mood, setMood] = useState([55]);
  const [sleep, setSleep] = useState([6.5]);
  const [intent, setIntent] = useState("");
  const [note, setNote] = useState("");
  const [picked, setPicked] = useState<string[]>([]);

  const togglePicked = (t: string) =>
    setPicked((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));

  const submit = () => {
    const entry = {
      mode,
      energy: energy[0],
      mood: mood[0],
      sleep: sleep[0],
      intent,
      note,
      tags: picked,
      ts: Date.now(),
    };
    const all = JSON.parse(localStorage.getItem("ig:checkins") || "[]");
    all.push(entry);
    localStorage.setItem("ig:checkins", JSON.stringify(all));
    toast.success("Чек-ин записан", { description: "Глиф учтёт это в следующем обновлении." });
    setNote("");
    setIntent("");
    setPicked([]);
  };

  return (
    <>
      <PageHeader
        eyebrow="структурированный ввод"
        title="Чек-ин"
        description="Минимум полей — максимум сигнала. Это не дневник, это калибровка зеркала."
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
            className={mode === m.id ? "shadow-neon" : ""}
          >
            <m.icon className="size-4" />
            {m.label}
          </Button>
        ))}
      </div>

      <Card className="glass p-6 space-y-6">
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
                        ? "bg-primary text-primary-foreground border-primary shadow-neon"
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
                placeholder="События, имена, ощущения. AI извлечёт связи в граф."
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
          <Button onClick={submit} className="shadow-neon">
            Зафиксировать
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
