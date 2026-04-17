// Расширенная корреляция «Сон → следующий день».
// Считаем 3 метрики: качество, длительность (ч), время отхода ко сну (час, по сдвигу от среднего).
// Берём ту, что дала самую сильную корреляцию (|r| max), и показываем понятную интерпретацию.
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Moon, Lightbulb } from "lucide-react";

interface Row {
  date: string;        // ISO date of next day
  quality: number;     // 1..5 (or proxy)
  durH: number;        // hours
  bedHourShift: number; // signed deviation from user's median bedtime
  mood: number;        // average next-day mood
}

interface Props { days?: number }

const pearson = (xs: number[], ys: number[]) => {
  const n = xs.length;
  if (n < 3) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  return dx && dy ? num / Math.sqrt(dx * dy) : 0;
};

const median = (arr: number[]) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export const SleepCorrelation = ({ days = 60 }: Props) => {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const since = new Date();
      since.setDate(since.getDate() - days);
      const [{ data: sleeps }, { data: pings }] = await Promise.all([
        supabase
          .from("sleep_sessions")
          .select("started_at,ended_at,quality,duration_minutes")
          .eq("user_id", user.id)
          .gte("started_at", since.toISOString())
          .not("ended_at", "is", null)
          .order("started_at", { ascending: true }),
        supabase
          .from("mood_pings")
          .select("mood, created_at")
          .eq("user_id", user.id)
          .gte("created_at", since.toISOString()),
      ]);

      // bedtime hour normalised: 22..28 (so 1AM = 25)
      const bedHours = (sleeps ?? []).map((s) => {
        const h = new Date(s.started_at).getHours();
        return h < 12 ? h + 24 : h;
      });
      const bedMed = median(bedHours);

      const out: Row[] = [];
      for (const s of sleeps ?? []) {
        const end = s.ended_at ? new Date(s.ended_at) : null;
        if (!end) continue;
        const day = new Date(end);
        day.setHours(0, 0, 0, 0);
        const next = new Date(day);
        next.setDate(next.getDate() + 1);
        const inDay = (pings ?? []).filter((p) => {
          const t = new Date(p.created_at);
          return t >= day && t < next;
        });
        if (inDay.length === 0) continue;
        const moodAvg = inDay.reduce((a, b) => a + b.mood, 0) / inDay.length;
        const durH = (s.duration_minutes ?? 0) / 60;
        const bedH = new Date(s.started_at).getHours();
        const bedNorm = bedH < 12 ? bedH + 24 : bedH;
        const q = s.quality ?? Math.max(1, Math.min(5, Math.round((durH - 4) / 1.2)));
        out.push({
          date: day.toISOString(),
          quality: q,
          durH: Number(durH.toFixed(2)),
          bedHourShift: Number((bedNorm - bedMed).toFixed(2)),
          mood: Number(moodAvg.toFixed(2)),
        });
      }
      setRows(out);
    })();
  }, [user, days]);

  const analysis = useMemo(() => {
    if (rows.length < 3) return null;
    const moods = rows.map((r) => r.mood);
    const candidates = [
      { key: "quality", label: "Качество сна", unit: "★", xs: rows.map((r) => r.quality) },
      { key: "durH", label: "Длительность сна", unit: "ч", xs: rows.map((r) => r.durH) },
      { key: "bedHourShift", label: "Время отхода ко сну", unit: "ч от обычного", xs: rows.map((r) => r.bedHourShift) },
    ] as const;
    const scored = candidates.map((c) => ({ ...c, r: pearson(c.xs, moods) }));
    scored.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
    const best = scored[0];

    // group mood by quality bucket — для основной диаграммы
    const buckets = new Map<number, number[]>();
    rows.forEach((r) => {
      const arr = buckets.get(r.quality) ?? [];
      arr.push(r.mood);
      buckets.set(r.quality, arr);
    });
    const byQ = Array.from(buckets.entries())
      .map(([q, arr]) => ({ q, avg: arr.reduce((a, b) => a + b, 0) / arr.length, n: arr.length }))
      .sort((a, b) => a.q - b.q);

    // average mood when slept ≥7h vs <7h
    const long = rows.filter((r) => r.durH >= 7);
    const short = rows.filter((r) => r.durH < 7);
    const longMood = long.length ? long.reduce((s, r) => s + r.mood, 0) / long.length : null;
    const shortMood = short.length ? short.reduce((s, r) => s + r.mood, 0) / short.length : null;
    const delta = longMood !== null && shortMood !== null ? longMood - shortMood : 0;

    return { scored, best, byQ, longMood, shortMood, delta };
  }, [rows]);

  const interp = (rAbs: number) =>
    rAbs >= 0.5 ? "Сильная связь" : rAbs >= 0.3 ? "Умеренная связь" : rAbs >= 0.15 ? "Слабая связь" : "Связь не выражена";

  const insight = useMemo(() => {
    if (!analysis) return null;
    const { best, delta, longMood, shortMood } = analysis;
    if (Math.abs(delta) >= 0.4 && longMood !== null && shortMood !== null) {
      const diff = delta.toFixed(1);
      return delta > 0
        ? `Когда спишь ≥7ч, среднее настроение выше на ${diff} (${longMood.toFixed(1)} vs ${shortMood.toFixed(1)}).`
        : `После долгого сна настроение ниже на ${Math.abs(+diff)} — попробуй понаблюдать за временем отхода.`;
    }
    if (best.key === "bedHourShift" && Math.abs(best.r) >= 0.2) {
      return best.r < 0
        ? "Чем раньше ложишься (от обычного), тем выше следующий день."
        : "Чем позже ложишься, тем выше настроение — возможно, ты «сова».";
    }
    if (best.key === "quality" && best.r > 0.2) {
      return "Качество сна — главный предиктор настроения. Береги ритуалы засыпания.";
    }
    return "Запиши ещё несколько ночей — связь может проявиться сильнее.";
  }, [analysis]);

  // ----- chart -----
  const W = 600, H = 200;
  const PAD = { l: 28, r: 12, t: 16, b: 28 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const xFor = (q: number) => PAD.l + ((q - 1) / 4) * innerW;
  const yFor = (m: number) => PAD.t + innerH - ((m - 1) / 9) * innerH;

  return (
    <Card className="ios-card p-5 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Moon className="size-4 text-primary" />
          <span className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
            сон → настроение
          </span>
        </div>
        {analysis && (
          <span className="mono text-xs text-muted-foreground">
            r = <strong className="text-foreground">{analysis.best.r.toFixed(2)}</strong>
            <span className="opacity-60"> · {analysis.best.label.toLowerCase()}</span>
          </span>
        )}
      </div>

      {rows.length < 3 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          Запиши хотя бы 3 ночи и сделай чек-ины на следующий день.
        </p>
      ) : (
        <>
          {/* metric chips */}
          {analysis && (
            <div className="grid grid-cols-3 gap-2 mb-4">
              {analysis.scored.map((c) => {
                const strong = c.key === analysis.best.key;
                return (
                  <div
                    key={c.key}
                    className={`p-2 rounded-lg border text-center ${
                      strong ? "border-primary/60 bg-primary/5" : "border-border/60"
                    }`}
                  >
                    <p className="text-[10px] text-muted-foreground leading-tight">{c.label}</p>
                    <p className="mono text-sm font-semibold mt-0.5">
                      {c.r > 0 ? "+" : ""}
                      {c.r.toFixed(2)}
                    </p>
                    <p className="text-[9px] text-muted-foreground">{interp(Math.abs(c.r))}</p>
                  </div>
                );
              })}
            </div>
          )}

          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
            <defs>
              <linearGradient id="qbar2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.6" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.1" />
              </linearGradient>
            </defs>
            {[1, 5, 10].map((m) => (
              <g key={m}>
                <line x1={PAD.l} x2={W - PAD.r} y1={yFor(m)} y2={yFor(m)}
                  stroke="hsl(var(--border) / 0.4)" strokeDasharray="2 4" />
                <text x={4} y={yFor(m) + 3} className="fill-muted-foreground" style={{ fontSize: 9 }}>{m}</text>
              </g>
            ))}
            {[1, 2, 3, 4, 5].map((q) => (
              <text key={q} x={xFor(q)} y={H - 8} textAnchor="middle"
                className="fill-muted-foreground" style={{ fontSize: 9 }}>★{q}</text>
            ))}
            {analysis?.byQ.map((b) => {
              const x = xFor(b.q);
              const y = yFor(b.avg);
              const barW = innerW / 7;
              return (
                <g key={`b-${b.q}`}>
                  <rect x={x - barW / 2} y={y} width={barW} height={PAD.t + innerH - y}
                    fill="url(#qbar2)" rx={4} />
                  <text x={x} y={y - 4} textAnchor="middle"
                    className="fill-foreground mono" style={{ fontSize: 10, fontWeight: 600 }}>
                    {b.avg.toFixed(1)}
                  </text>
                </g>
              );
            })}
            {rows.map((p, i) => (
              <circle key={i}
                cx={xFor(p.quality) + ((i % 5) - 2) * 2}
                cy={yFor(p.mood)} r={3}
                fill="hsl(var(--primary))" opacity={0.45} />
            ))}
          </svg>

          {insight && (
            <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/15">
              <Lightbulb className="size-4 text-primary mt-0.5 shrink-0" />
              <p className="text-sm text-foreground">{insight}</p>
            </div>
          )}
        </>
      )}
    </Card>
  );
};
