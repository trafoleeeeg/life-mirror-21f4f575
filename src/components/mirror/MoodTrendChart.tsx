import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { DateRange } from "react-day-picker";
import { format, eachDayOfInterval, isSameDay } from "date-fns";
import { ru } from "date-fns/locale";

interface DayPoint {
  date: Date;
  avg: number | null;
  count: number;
}

const moodHue = (m: number) => {
  // 1 → red (0), 10 → green (140)
  return Math.round(((m - 1) / 9) * 140);
};

interface Props {
  range: DateRange;
}

export const MoodTrendChart = ({ range }: Props) => {
  const { user } = useAuth();
  const [days, setDays] = useState<DayPoint[]>([]);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    if (!user || !range.from || !range.to) return;
    void (async () => {
      const { data } = await supabase
        .from("mood_pings")
        .select("mood, created_at")
        .eq("user_id", user.id)
        .gte("created_at", range.from!.toISOString())
        .lte("created_at", range.to!.toISOString())
        .order("created_at", { ascending: true });

      const allDays = eachDayOfInterval({ start: range.from!, end: range.to! });
      const points: DayPoint[] = allDays.map((d) => {
        const dayPings = (data ?? []).filter((p) => isSameDay(new Date(p.created_at), d));
        if (dayPings.length === 0) return { date: d, avg: null, count: 0 };
        const sum = dayPings.reduce((s, p) => s + p.mood, 0);
        return { date: d, avg: sum / dayPings.length, count: dayPings.length };
      });
      setDays(points);
    })();
  }, [user, range.from?.getTime(), range.to?.getTime()]);

  const stats = useMemo(() => {
    const filled = days.filter((d) => d.avg !== null);
    if (!filled.length) return { avg: 0, max: 0, min: 0, total: 0 };
    const avg = filled.reduce((s, d) => s + d.avg!, 0) / filled.length;
    const max = Math.max(...filled.map((d) => d.avg!));
    const min = Math.min(...filled.map((d) => d.avg!));
    const total = days.reduce((s, d) => s + d.count, 0);
    return { avg, max, min, total };
  }, [days]);

  // chart geometry
  const W = 800;
  const H = 200;
  const PAD = { l: 24, r: 12, t: 16, b: 28 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;

  const xFor = (i: number) =>
    days.length <= 1 ? PAD.l + innerW / 2 : PAD.l + (i / (days.length - 1)) * innerW;
  const yFor = (m: number) => PAD.t + innerH - ((m - 1) / 9) * innerH;

  const filled = days.map((d, i) => ({ ...d, i })).filter((d) => d.avg !== null);
  const linePath = filled.length
    ? filled
        .map((d, idx) => `${idx === 0 ? "M" : "L"} ${xFor(d.i).toFixed(1)} ${yFor(d.avg!).toFixed(1)}`)
        .join(" ")
    : "";
  const areaPath = filled.length
    ? `${linePath} L ${xFor(filled[filled.length - 1].i).toFixed(1)} ${PAD.t + innerH} L ${xFor(filled[0].i).toFixed(1)} ${PAD.t + innerH} Z`
    : "";

  const barW = days.length ? Math.max(2, innerW / days.length - 2) : 0;

  return (
    <Card className="ios-card p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
          линия настроения
        </p>
        <div className="flex gap-3 mono text-[11px] text-muted-foreground">
          <span>среднее <strong className="text-foreground">{stats.avg ? stats.avg.toFixed(1) : "—"}</strong></span>
          <span>записей <strong className="text-foreground">{stats.total}</strong></span>
        </div>
      </div>

      {days.length === 0 ? (
        <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
          Загрузка…
        </div>
      ) : stats.total === 0 ? (
        <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
          Нет данных за этот период
        </div>
      ) : (
        <>
          <div className="relative">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="none">
              <defs>
                <linearGradient id="moodArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
                </linearGradient>
              </defs>
              {/* gridlines */}
              {[1, 3, 5, 7, 10].map((m) => (
                <g key={m}>
                  <line
                    x1={PAD.l}
                    x2={W - PAD.r}
                    y1={yFor(m)}
                    y2={yFor(m)}
                    stroke="hsl(var(--border) / 0.4)"
                    strokeDasharray="2 4"
                  />
                  <text
                    x={4}
                    y={yFor(m) + 3}
                    className="fill-muted-foreground"
                    style={{ fontSize: 9 }}
                  >
                    {m}
                  </text>
                </g>
              ))}

              {areaPath && <path d={areaPath} fill="url(#moodArea)" />}
              {linePath && (
                <path
                  d={linePath}
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {filled.map((d) => (
                <circle
                  key={d.i}
                  cx={xFor(d.i)}
                  cy={yFor(d.avg!)}
                  r={hover === d.i ? 4 : 2.5}
                  fill="hsl(var(--primary))"
                  stroke="hsl(var(--background))"
                  strokeWidth={1}
                />
              ))}

              {/* hover overlay */}
              {days.map((d, i) => (
                <rect
                  key={`hit-${i}`}
                  x={xFor(i) - innerW / days.length / 2}
                  y={PAD.t}
                  width={innerW / days.length}
                  height={innerH}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                />
              ))}
            </svg>

            {hover !== null && days[hover] && (
              <div
                className="absolute pointer-events-none px-2 py-1 rounded-md bg-popover border text-[11px] shadow-lg"
                style={{
                  left: `${(xFor(hover) / W) * 100}%`,
                  top: 0,
                  transform: "translate(-50%, -110%)",
                }}
              >
                <div className="font-medium">
                  {format(days[hover].date, "d MMM", { locale: ru })}
                </div>
                <div className="text-muted-foreground">
                  {days[hover].avg
                    ? `${days[hover].avg!.toFixed(1)}/10 · ${days[hover].count} зап.`
                    : "нет"}
                </div>
              </div>
            )}
          </div>

          {/* day strip */}
          <div className="mt-3 flex gap-[2px] h-3 rounded-full overflow-hidden">
            {days.map((d, i) => (
              <div
                key={i}
                className="flex-1 transition-opacity"
                style={{
                  background:
                    d.avg !== null
                      ? `hsl(${moodHue(d.avg)} 70% 55%)`
                      : "hsl(var(--muted) / 0.4)",
                  opacity: hover === null || hover === i ? 1 : 0.5,
                }}
                title={
                  d.avg
                    ? `${format(d.date, "d MMM", { locale: ru })} · ${d.avg.toFixed(1)}`
                    : format(d.date, "d MMM", { locale: ru })
                }
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            ))}
          </div>
          <div className="flex justify-between mt-1.5 mono text-[9px] text-muted-foreground">
            {days[0] && <span>{format(days[0].date, "d MMM", { locale: ru })}</span>}
            {days[days.length - 1] && (
              <span>{format(days[days.length - 1].date, "d MMM", { locale: ru })}</span>
            )}
          </div>
        </>
      )}
    </Card>
  );
};
