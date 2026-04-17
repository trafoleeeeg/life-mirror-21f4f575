// «Sleep Cycle»-style визуализация:
// — для каждой из 7 последних ночей — гипнограмма (4 фазы: бодрствование/REM/лёгкий/глубокий),
//   построенная из avg_loudness + interruptions + длительности (детерминированно по seed = id);
// — суммарная статистика: ср. длительность, % глубокого, эффективность, ср. время отбоя/подъёма;
// — внизу AI-инсайт по запросу.
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, Moon, Sun, Activity } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { toast } from "sonner";

interface Session {
  id: string;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  quality: number | null;
  interruptions: number;
  avg_loudness: number | null;
}

// Phases (top→bottom): 0=Awake, 1=REM, 2=Light, 3=Deep — нижнее = глубже
const PHASE_NAMES = ["Бодр.", "REM", "Лёгкий", "Глубокий"] as const;
const PHASE_COLORS = [
  "hsl(var(--destructive))",
  "hsl(var(--stat-creativity))",
  "hsl(var(--stat-mind))",
  "hsl(var(--primary))",
];

// детерминированный псевдо-RNG по строке (id сессии)
const seeded = (str: string) => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i); h = Math.imul(h, 16777619);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967295;
  };
};

const buildHypnogram = (s: Session): number[] => {
  const dur = s.duration_minutes ?? 0;
  const slots = 60; // 60 точек на ночь
  if (dur === 0) return Array(slots).fill(0);
  const rng = seeded(s.id);
  const interruptions = s.interruptions ?? 0;
  const loud = s.avg_loudness ?? 0.1;
  const cycles = Math.max(2, Math.round(dur / 90)); // ~90-мин циклы
  const arr: number[] = [];
  for (let i = 0; i < slots; i++) {
    const t = i / slots; // 0..1
    // базовая синусоида: ночью сначала глубокий → к утру REM
    const phaseInCycle = (t * cycles) % 1;
    let phase: number;
    if (phaseInCycle < 0.15) phase = 2;        // light
    else if (phaseInCycle < 0.55) phase = 3 - Math.floor(t * 1.2); // deep early, light later
    else if (phaseInCycle < 0.85) phase = 2;
    else phase = 1;                             // REM
    phase = Math.max(0, Math.min(3, phase));
    // случайные пробуждения
    const wakeProb = (interruptions / 6) + loud * 0.3;
    if (rng() < wakeProb / slots * 8) phase = 0;
    arr.push(phase);
  }
  return arr;
};

const hhmm = (iso: string) => format(new Date(iso), "HH:mm");

export const SleepHistory = () => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [insight, setInsight] = useState("");
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await supabase
        .from("sleep_sessions")
        .select("id,started_at,ended_at,duration_minutes,quality,interruptions,avg_loudness")
        .eq("user_id", user.id)
        .not("ended_at", "is", null)
        .order("started_at", { ascending: false })
        .limit(7);
      const list = (data ?? []) as Session[];
      setSessions(list);
      if (list[0]) setActiveId(list[0].id);
    })();
  }, [user]);

  const active = sessions.find((s) => s.id === activeId) ?? sessions[0];
  const hypno = useMemo(() => active ? buildHypnogram(active) : [], [active]);

  const totals = useMemo(() => {
    if (!active) return null;
    const dur = active.duration_minutes ?? 0;
    const phaseCounts = [0, 0, 0, 0];
    hypno.forEach((p) => phaseCounts[p]++);
    const total = hypno.length || 1;
    const pct = phaseCounts.map((c) => Math.round((c / total) * 100));
    const efficiency = Math.max(0, 100 - pct[0]); // % не-бодрствования
    return { dur, pct, efficiency };
  }, [active, hypno]);

  const aggregate = useMemo(() => {
    if (!sessions.length) return null;
    const filled = sessions.filter((s) => s.duration_minutes);
    if (!filled.length) return null;
    const avgDur = filled.reduce((s, x) => s + (x.duration_minutes ?? 0), 0) / filled.length;
    const avgBed = filled.reduce((s, x) => {
      const h = new Date(x.started_at).getHours();
      return s + (h < 12 ? h + 24 : h);
    }, 0) / filled.length;
    const avgWake = filled
      .filter((s) => s.ended_at)
      .reduce((s, x) => s + new Date(x.ended_at!).getHours(), 0) / filled.length;
    return { avgDur, avgBed, avgWake, n: filled.length };
  }, [sessions]);

  const fetchInsights = async () => {
    setLoadingInsight(true);
    try {
      const { data, error } = await supabase.functions.invoke("sleep-insights");
      if (error) throw error;
      setInsight(data.insight ?? "");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось получить интерпретацию");
    } finally {
      setLoadingInsight(false);
    }
  };

  if (!sessions.length) {
    return (
      <Card className="ios-card p-5">
        <p className="text-sm text-muted-foreground text-center py-4">
          Запиши первую ночь, чтобы увидеть фазы сна.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Aggregate stats */}
      {aggregate && (
        <Card className="ios-card p-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <Stat
              icon={<Moon className="size-3.5" />}
              value={`${Math.floor(aggregate.avgBed)}:${String(Math.round((aggregate.avgBed % 1) * 60)).padStart(2, "0")}`.replace(/^(\d+)/, (m) => String(parseInt(m) % 24).padStart(2, "0"))}
              label="отбой"
            />
            <Stat
              icon={<Activity className="size-3.5" />}
              value={`${Math.floor(aggregate.avgDur / 60)}ч ${Math.round(aggregate.avgDur % 60)}м`}
              label="средн."
            />
            <Stat
              icon={<Sun className="size-3.5" />}
              value={`${String(Math.floor(aggregate.avgWake)).padStart(2, "0")}:${String(Math.round((aggregate.avgWake % 1) * 60)).padStart(2, "0")}`}
              label="подъём"
            />
          </div>
        </Card>
      )}

      {/* Day picker */}
      <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
        {sessions.map((s) => {
          const on = s.id === activeId;
          const d = new Date(s.started_at);
          return (
            <button
              key={s.id}
              onClick={() => setActiveId(s.id)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs border transition-colors ${
                on ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/40"
              }`}
            >
              {format(d, "EE d", { locale: ru })}
            </button>
          );
        })}
      </div>

      {/* Hypnogram for active session */}
      {active && totals && (
        <Card className="ios-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-medium capitalize">
                {format(new Date(active.started_at), "EEEE, d MMMM", { locale: ru })}
              </p>
              <p className="mono text-xs text-muted-foreground">
                {hhmm(active.started_at)} → {active.ended_at && hhmm(active.ended_at)}
                {" · "}
                {Math.floor(totals.dur / 60)}ч {totals.dur % 60}м
                {" · "}
                эфф. {totals.efficiency}%
              </p>
            </div>
            {active.quality && (
              <div
                className="size-9 rounded-full grid place-items-center text-xs font-bold text-primary-foreground"
                style={{ background: `hsl(${((active.quality - 1) / 4) * 130} 60% 45%)` }}
              >
                ★{active.quality}
              </div>
            )}
          </div>

          {/* Hypnogram bars */}
          <div className="flex items-end h-24 gap-px bg-muted/20 rounded-md p-1">
            {hypno.map((p, i) => {
              const heights = [22, 60, 78, 96]; // % высоты по фазе
              return (
                <div
                  key={i}
                  className="flex-1 rounded-sm transition-opacity hover:opacity-100"
                  style={{
                    height: `${heights[p]}%`,
                    background: PHASE_COLORS[p],
                    opacity: 0.7 + (p / 3) * 0.3,
                  }}
                  title={PHASE_NAMES[p]}
                />
              );
            })}
          </div>

          {/* Phase legend with % */}
          <div className="grid grid-cols-4 gap-2 mt-3">
            {PHASE_NAMES.map((name, i) => (
              <div key={name} className="text-center">
                <div className="flex items-center justify-center gap-1.5">
                  <span
                    className="size-2 rounded-full"
                    style={{ background: PHASE_COLORS[i] }}
                  />
                  <span className="text-[10px] text-muted-foreground">{name}</span>
                </div>
                <p className="mono text-xs font-semibold mt-0.5">{totals.pct[i]}%</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* AI insight */}
      <Card className="ios-card p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
            интерпретация AI
          </p>
          <Button size="sm" variant="ghost" onClick={fetchInsights} disabled={loadingInsight} className="rounded-full text-xs h-7">
            {loadingInsight ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            <span className="ml-1.5">{insight ? "Обновить" : "Получить"}</span>
          </Button>
        </div>
        {insight ? (
          <p className="text-sm leading-relaxed whitespace-pre-line">{insight}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Нажми «Получить», чтобы AI разобрал твои паттерны сна.
          </p>
        )}
      </Card>
    </div>
  );
};

const Stat = ({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) => (
  <div>
    <div className="flex items-center justify-center gap-1 text-muted-foreground">
      {icon}
      <span className="text-[10px] uppercase tracking-wider">{label}</span>
    </div>
    <p className="mono text-base font-semibold mt-0.5">{value}</p>
  </div>
);
