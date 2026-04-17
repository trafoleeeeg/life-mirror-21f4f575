// Компактный таймлайн «по дням» — одна строка на день, спарклайн mood + чипы активностей.
// Без вырвиглазных заливок; цвет — только тонкая полоска слева, всё в семантических токенах.
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

interface DayStat {
  date: Date;
  avgMood: number;
  count: number;
  topActivities: string[];
  series: number[];
}

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const moodToken = (m: number) =>
  m >= 7 ? "--stat-body" : m >= 5 ? "--stat-meaning" : m >= 3 ? "--stat-creativity" : "--destructive";

interface Props { days?: number }

export const DailyBreakdown = ({ days = 7 }: Props) => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DayStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - (days - 1));
      const { data } = await supabase
        .from("mood_pings")
        .select("mood, activities, created_at")
        .eq("user_id", user.id)
        .gte("created_at", start.toISOString())
        .order("created_at", { ascending: true });

      const buckets = new Map<string, { moods: number[]; acts: Record<string, number> }>();
      for (const r of data ?? []) {
        const k = dayKey(new Date(r.created_at));
        const b = buckets.get(k) ?? { moods: [], acts: {} };
        b.moods.push(r.mood);
        for (const a of r.activities ?? []) b.acts[a] = (b.acts[a] || 0) + 1;
        buckets.set(k, b);
      }
      const out: DayStat[] = [];
      for (let i = 0; i < days; i++) {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - i);
        const k = dayKey(d);
        const b = buckets.get(k);
        if (!b || b.moods.length === 0) continue;
        const avg = b.moods.reduce((s, x) => s + x, 0) / b.moods.length;
        const top = Object.entries(b.acts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([l]) => l);
        out.push({
          date: d, avgMood: avg, count: b.moods.length,
          topActivities: top, series: b.moods,
        });
      }
      setStats(out);
      setLoading(false);
    })();
  }, [user, days]);

  const withTrend = useMemo(
    () => stats.map((s, i) => ({ ...s, trend: stats[i + 1] ? s.avgMood - stats[i + 1].avgMood : 0 })),
    [stats],
  );

  if (loading) return null;
  if (!stats.length) {
    return (
      <Card className="ios-card p-5">
        <p className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">по дням</p>
        <p className="text-sm text-muted-foreground">Сделай первый чек-ин, чтобы увидеть разбивку.</p>
      </Card>
    );
  }

  return (
    <Card className="ios-card overflow-hidden">
      <div className="px-5 pt-4 pb-2 flex items-center justify-between">
        <p className="mono text-[10px] uppercase tracking-widest text-muted-foreground">по дням</p>
        <span className="mono text-[10px] text-muted-foreground">{stats.length} дн.</span>
      </div>
      <ul className="divide-y divide-border/60">
        {withTrend.map((s) => {
          const token = moodToken(s.avgMood);
          const max = Math.max(...s.series, 10);
          const min = Math.min(...s.series, 1);
          const sw = 60, sh = 18;
          const points = s.series.length > 1
            ? s.series.map((v, i) => {
                const x = (i / (s.series.length - 1)) * sw;
                const y = sh - ((v - min) / Math.max(1, max - min)) * sh;
                return `${x.toFixed(1)},${y.toFixed(1)}`;
              }).join(" ")
            : `0,${sh / 2} ${sw},${sh / 2}`;
          const Trend = s.trend > 0.3 ? TrendingUp : s.trend < -0.3 ? TrendingDown : null;
          return (
            <li
              key={s.date.toISOString()}
              className="flex items-center gap-3 px-5 py-2.5 hover:bg-muted/30 transition-colors"
            >
              {/* date */}
              <div className="w-14 shrink-0">
                <p className="text-xs font-medium capitalize leading-tight">
                  {s.date.toLocaleDateString("ru", { weekday: "short" })}
                </p>
                <p className="mono text-[10px] text-muted-foreground">
                  {s.date.toLocaleDateString("ru", { day: "numeric", month: "short" })}
                </p>
              </div>

              {/* mood number + accent bar */}
              <div className="flex items-center gap-2 w-16 shrink-0">
                <span
                  className="w-1 h-7 rounded-full"
                  style={{ background: `hsl(var(${token}))` }}
                />
                <div className="flex items-baseline gap-1">
                  <span className="mono text-base font-semibold tabular-nums">
                    {s.avgMood.toFixed(1)}
                  </span>
                  {Trend && (
                    <Trend
                      className="size-3"
                      style={{
                        color: s.trend > 0
                          ? "hsl(var(--stat-body))"
                          : "hsl(var(--destructive))",
                      }}
                    />
                  )}
                </div>
              </div>

              {/* sparkline */}
              <svg viewBox={`0 0 ${sw} ${sh}`} className="w-16 h-5 shrink-0" preserveAspectRatio="none">
                <polyline
                  points={points}
                  fill="none"
                  stroke={`hsl(var(${token}))`}
                  strokeWidth={1.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </svg>

              {/* activities */}
              <div className="flex-1 flex flex-wrap gap-1 justify-end overflow-hidden">
                {s.topActivities.map((a) => (
                  <span
                    key={a}
                    className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground"
                  >
                    {a}
                  </span>
                ))}
                <span className="mono text-[10px] text-muted-foreground self-center ml-1">
                  ×{s.count}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
};
