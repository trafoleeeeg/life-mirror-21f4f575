import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

interface DayStat {
  date: Date;
  avgMood: number;
  count: number;
  topActivities: string[];
}

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const moodTone = (mood: number) => {
  // returns hue/border/glow tones based on mood 1..10
  if (mood >= 7) return { ring: "hsl(var(--ring-exercise))", bar: "hsl(var(--ring-exercise))", tint: "hsl(95 95% 45% / 0.10)" };
  if (mood >= 5) return { ring: "hsl(var(--stat-meaning))", bar: "hsl(var(--stat-meaning))", tint: "hsl(50 100% 50% / 0.10)" };
  if (mood >= 3) return { ring: "hsl(var(--stat-creativity))", bar: "hsl(var(--stat-creativity))", tint: "hsl(30 100% 50% / 0.10)" };
  return { ring: "hsl(var(--destructive))", bar: "hsl(var(--destructive))", tint: "hsl(4 90% 50% / 0.12)" };
};

interface Props {
  days?: number;
}

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
        .order("created_at", { ascending: false });

      const buckets = new Map<string, { moods: number[]; acts: Record<string, number> }>();
      for (const r of data ?? []) {
        const k = dayKey(new Date(r.created_at));
        const b = buckets.get(k) ?? { moods: [], acts: {} };
        b.moods.push(r.mood);
        for (const a of r.activities ?? []) {
          b.acts[a] = (b.acts[a] || 0) + 1;
        }
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
        const top = Object.entries(b.acts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([l]) => l);
        out.push({ date: d, avgMood: avg, count: b.moods.length, topActivities: top });
      }
      setStats(out);
      setLoading(false);
    })();
  }, [user, days]);

  const withTrend = useMemo(() => {
    return stats.map((s, i) => {
      const prev = stats[i + 1];
      const trend = prev ? s.avgMood - prev.avgMood : 0;
      return { ...s, trend };
    });
  }, [stats]);

  if (loading) return null;
  if (!stats.length) {
    return (
      <Card className="ios-card p-5">
        <p className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
          по дням
        </p>
        <p className="text-sm text-muted-foreground">
          Сделай первый чек-ин, чтобы увидеть разбивку.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <p className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
        по дням
      </p>
      {withTrend.map((s) => {
        const tone = moodTone(s.avgMood);
        const Icon = s.trend > 0.3 ? TrendingUp : s.trend < -0.3 ? TrendingDown : Minus;
        return (
          <Card
            key={s.date.toISOString()}
            className="p-4 border"
            style={{
              background: tone.tint,
              borderColor: tone.ring,
            }}
          >
            <div className="flex items-start justify-between mb-2">
              <p className="text-sm text-muted-foreground capitalize">
                {s.date.toLocaleDateString("ru", { weekday: "short", day: "numeric", month: "short" })}
              </p>
              <Icon
                className="size-4"
                style={{
                  color:
                    s.trend > 0.3
                      ? "hsl(var(--ring-exercise))"
                      : s.trend < -0.3
                        ? "hsl(var(--destructive))"
                        : "hsl(var(--muted-foreground))",
                }}
              />
            </div>
            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-3xl font-bold mono" style={{ color: tone.bar }}>
                {s.avgMood.toFixed(1)}
              </span>
              <span className="text-sm text-muted-foreground">/ 10</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-3">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${(s.avgMood / 10) * 100}%`, background: tone.bar }}
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="mono text-xs text-muted-foreground">
                {s.count} {s.count === 1 ? "чек-ин" : "чек-ина"}
              </span>
              <div className="flex flex-wrap gap-1 justify-end">
                {s.topActivities.map((a) => (
                  <span
                    key={a}
                    className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground"
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
};
