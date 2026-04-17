// «Сон → настроение следующего дня» — понятный bar-chart по корзинам часов сна.
// Без скаттера, без трёх метрик-плиток. Только: главный инсайт + бары по 5/6/7/8/9+ часам.
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Moon, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface Row { durH: number; mood: number }

interface Props { days?: number }

const BUCKETS = [
  { key: "<6", min: 0, max: 6, label: "<6ч" },
  { key: "6-7", min: 6, max: 7, label: "6–7ч" },
  { key: "7-8", min: 7, max: 8, label: "7–8ч" },
  { key: "8-9", min: 8, max: 9, label: "8–9ч" },
  { key: "9+", min: 9, max: 99, label: "9ч+" },
];

export const SleepCorrelation = ({ days = 60 }: Props) => {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const since = new Date();
      since.setDate(since.getDate() - days);
      const [{ data: sleeps }, { data: pings }] = await Promise.all([
        supabase
          .from("sleep_sessions")
          .select("ended_at,duration_minutes")
          .eq("user_id", user.id)
          .gte("started_at", since.toISOString())
          .not("ended_at", "is", null),
        supabase
          .from("mood_pings")
          .select("mood, created_at")
          .eq("user_id", user.id)
          .gte("created_at", since.toISOString()),
      ]);

      const out: Row[] = [];
      for (const s of sleeps ?? []) {
        const end = s.ended_at ? new Date(s.ended_at) : null;
        if (!end || !s.duration_minutes) continue;
        const day = new Date(end);
        day.setHours(0, 0, 0, 0);
        const next = new Date(day);
        next.setDate(next.getDate() + 1);
        const inDay = (pings ?? []).filter((p) => {
          const t = new Date(p.created_at);
          return t >= day && t < next;
        });
        if (!inDay.length) continue;
        out.push({
          durH: s.duration_minutes / 60,
          mood: inDay.reduce((a, b) => a + b.mood, 0) / inDay.length,
        });
      }
      setRows(out);
      setLoading(false);
    })();
  }, [user, days]);

  const data = useMemo(() => {
    if (rows.length < 3) return null;
    const baseline = rows.reduce((s, r) => s + r.mood, 0) / rows.length;
    const buckets = BUCKETS.map((b) => {
      const sub = rows.filter((r) => r.durH >= b.min && r.durH < b.max);
      const avg = sub.length ? sub.reduce((s, r) => s + r.mood, 0) / sub.length : null;
      return { ...b, avg, n: sub.length };
    });
    const filled = buckets.filter((b) => b.avg !== null);
    if (!filled.length) return null;
    const best = filled.reduce((a, b) => (a.avg! > b.avg! ? a : b));
    const worst = filled.reduce((a, b) => (a.avg! < b.avg! ? a : b));
    const diff = (best.avg! - worst.avg!);
    return { buckets, baseline, best, worst, diff };
  }, [rows]);

  if (loading) {
    return (
      <Card className="ios-card p-5">
        <div className="h-32 animate-pulse bg-muted/30 rounded-lg" />
      </Card>
    );
  }

  return (
    <Card className="ios-card p-5 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Moon className="size-4 text-primary" />
          <span className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
            сон → настроение следующего дня
          </span>
        </div>
        {data && (
          <span className="mono text-[10px] text-muted-foreground">
            n = <span className="text-foreground">{rows.length}</span>
          </span>
        )}
      </div>

      {!data ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          Запиши хотя бы 3 ночи и сделай чек-ины на следующий день — тут появится связь.
        </p>
      ) : (
        <>
          {/* Hero insight */}
          <div className="mb-5 p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
            <p className="text-[10px] mono uppercase tracking-widest text-primary/80 mb-1">
              главный вывод
            </p>
            <p className="text-base font-semibold leading-snug">
              После сна <span className="text-primary">{data.best.label}</span> твоё настроение
              <span className="text-primary"> {data.best.avg!.toFixed(1)}/10</span>,
              после <span className="text-foreground/70">{data.worst.label}</span> —
              <span className="text-foreground/70"> {data.worst.avg!.toFixed(1)}/10</span>.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Разница <strong className="text-foreground">{data.diff.toFixed(1)} балла</strong> · среднее за период {data.baseline.toFixed(1)}
            </p>
          </div>

          {/* Bars */}
          <div className="space-y-2.5">
            {data.buckets.map((b) => {
              const has = b.avg !== null;
              const delta = has ? b.avg! - data.baseline : 0;
              const positive = delta >= 0;
              const widthPct = has ? Math.max(8, (b.avg! / 10) * 100) : 6;
              const Icon = !has
                ? Minus
                : Math.abs(delta) < 0.2
                ? Minus
                : positive
                ? TrendingUp
                : TrendingDown;
              // Палитра: ярко-зелёный = заряжает, жёлтый = почти нейтрально, красный = истощает.
              const adelta = Math.abs(delta);
              const color = !has
                ? "--muted-foreground"
                : adelta < 0.3
                ? "--stat-meaning"     // жёлтый — нейтраль
                : positive
                ? "--stat-finance"     // зелёный — выше среднего
                : "--destructive";     // красный — ниже среднего
              return (
                <div key={b.key} className="grid grid-cols-[60px_1fr_72px] items-center gap-3">
                  <span className="mono text-xs text-muted-foreground">{b.label}</span>
                  <div className="h-6 bg-muted/40 rounded-md overflow-hidden relative">
                    {has && (
                      <div
                        className="h-full rounded-md transition-all duration-700 ease-out"
                        style={{
                          width: `${widthPct}%`,
                          background: `linear-gradient(90deg, hsl(var(${color}) / 0.4), hsl(var(${color}) / 0.85))`,
                        }}
                      />
                    )}
                    {has && (
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 mono text-[11px] font-semibold text-foreground">
                        {b.avg!.toFixed(1)}
                      </span>
                    )}
                    {!has && (
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                        нет данных
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-end gap-1">
                    <Icon className="size-3" style={{ color: `hsl(var(${color}))` }} />
                    <span
                      className="mono text-xs font-semibold tabular-nums"
                      style={{ color: `hsl(var(${color}))` }}
                    >
                      {has ? `${delta > 0 ? "+" : ""}${delta.toFixed(1)}` : "—"}
                    </span>
                    {has && (
                      <span className="mono text-[10px] text-muted-foreground ml-0.5">×{b.n}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-[11px] text-muted-foreground mt-4 text-center">
            🟢 выше среднего · 🟡 почти нейтрально · 🔴 ниже среднего. Цифра справа — отклонение от твоего среднего ({data.baseline.toFixed(1)}).
          </p>
        </>
      )}
    </Card>
  );
};
