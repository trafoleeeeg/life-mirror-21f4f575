// Sleep quality (night N) → mood (day N+1) correlation scatter + trend.
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Moon, Smile } from "lucide-react";

interface Point {
  date: string;
  quality: number;
  mood: number;
}

interface Props {
  days?: number;
}

export const SleepCorrelation = ({ days = 60 }: Props) => {
  const { user } = useAuth();
  const [pts, setPts] = useState<Point[]>([]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const since = new Date();
      since.setDate(since.getDate() - days);
      const [{ data: sleeps }, { data: pings }] = await Promise.all([
        supabase
          .from("sleep_sessions")
          .select("id,started_at,ended_at,quality,duration_minutes")
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

      // qualityFallback: if `quality` null — derive from interruptions/duration via a simple proxy 1..5
      const out: Point[] = [];
      for (const s of sleeps ?? []) {
        // "next-day" = local date of ended_at
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
        const q = s.quality ?? Math.max(1, Math.min(5, Math.round(((s.duration_minutes ?? 0) / 60 - 4) / 1.2)));
        out.push({
          date: day.toISOString(),
          quality: q,
          mood: Number(moodAvg.toFixed(2)),
        });
      }
      setPts(out);
    })();
  }, [user, days]);

  const stats = useMemo(() => {
    if (pts.length < 3) return null;
    // Pearson correlation
    const n = pts.length;
    const mx = pts.reduce((s, p) => s + p.quality, 0) / n;
    const my = pts.reduce((s, p) => s + p.mood, 0) / n;
    let num = 0;
    let dx = 0;
    let dy = 0;
    for (const p of pts) {
      num += (p.quality - mx) * (p.mood - my);
      dx += (p.quality - mx) ** 2;
      dy += (p.mood - my) ** 2;
    }
    const r = dx && dy ? num / Math.sqrt(dx * dy) : 0;
    // average mood per quality bucket
    const buckets = new Map<number, number[]>();
    pts.forEach((p) => {
      const arr = buckets.get(p.quality) ?? [];
      arr.push(p.mood);
      buckets.set(p.quality, arr);
    });
    const byQ = Array.from(buckets.entries())
      .map(([q, arr]) => ({ q, avg: arr.reduce((a, b) => a + b, 0) / arr.length, n: arr.length }))
      .sort((a, b) => a.q - b.q);
    return { r, byQ };
  }, [pts]);

  const W = 600;
  const H = 200;
  const PAD = { l: 28, r: 12, t: 16, b: 28 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const xFor = (q: number) => PAD.l + ((q - 1) / 4) * innerW;
  const yFor = (m: number) => PAD.t + innerH - ((m - 1) / 9) * innerH;

  const interpretation = (r: number) => {
    if (Math.abs(r) < 0.15) return "Связь слабая или отсутствует";
    if (r > 0.5) return "Сильная связь: лучше спишь — ярче день";
    if (r > 0.15) return "Заметная связь: качество сна влияет на настроение";
    if (r < -0.5) return "Сильная обратная связь — стоит проверить данные";
    return "Лёгкая обратная связь";
  };

  return (
    <Card className="ios-card p-5 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Moon className="size-4 text-primary" />
          <span className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
            сон → настроение следующего дня
          </span>
        </div>
        {stats && (
          <span className="mono text-xs">
            r = <strong className="text-foreground">{stats.r.toFixed(2)}</strong>
          </span>
        )}
      </div>

      {pts.length < 3 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          Запиши хотя бы 3 ночи и сделай чек-ины на следующий день — появится корреляция.
        </p>
      ) : (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
            <defs>
              <linearGradient id="qbar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.6" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.1" />
              </linearGradient>
            </defs>
            {/* gridlines */}
            {[1, 5, 10].map((m) => (
              <g key={m}>
                <line
                  x1={PAD.l}
                  x2={W - PAD.r}
                  y1={yFor(m)}
                  y2={yFor(m)}
                  stroke="hsl(var(--border) / 0.4)"
                  strokeDasharray="2 4"
                />
                <text x={4} y={yFor(m) + 3} className="fill-muted-foreground" style={{ fontSize: 9 }}>
                  {m}
                </text>
              </g>
            ))}
            {/* x ticks */}
            {[1, 2, 3, 4, 5].map((q) => (
              <text
                key={q}
                x={xFor(q)}
                y={H - 8}
                textAnchor="middle"
                className="fill-muted-foreground"
                style={{ fontSize: 9 }}
              >
                ★{q}
              </text>
            ))}
            {/* avg bars per quality */}
            {stats?.byQ.map((b) => {
              const x = xFor(b.q);
              const y = yFor(b.avg);
              const barW = innerW / 7;
              return (
                <g key={`b-${b.q}`}>
                  <rect
                    x={x - barW / 2}
                    y={y}
                    width={barW}
                    height={PAD.t + innerH - y}
                    fill="url(#qbar)"
                    rx={4}
                  />
                  <text
                    x={x}
                    y={y - 4}
                    textAnchor="middle"
                    className="fill-foreground mono"
                    style={{ fontSize: 10, fontWeight: 600 }}
                  >
                    {b.avg.toFixed(1)}
                  </text>
                </g>
              );
            })}
            {/* scatter */}
            {pts.map((p, i) => (
              <circle
                key={i}
                cx={xFor(p.quality) + (Math.random() - 0.5) * 8}
                cy={yFor(p.mood)}
                r={3}
                fill="hsl(var(--primary))"
                opacity={0.55}
              />
            ))}
          </svg>

          <div className="mt-3 flex items-start gap-2 text-sm">
            <Smile className="size-4 text-primary mt-0.5 shrink-0" />
            <p className="text-muted-foreground">
              {stats ? interpretation(stats.r) : ""}
              <span className="text-foreground">
                {" "}· {pts.length} ночей · среднее настр. {(pts.reduce((s, p) => s + p.mood, 0) / pts.length).toFixed(1)}
              </span>
            </p>
          </div>
        </>
      )}
    </Card>
  );
};
