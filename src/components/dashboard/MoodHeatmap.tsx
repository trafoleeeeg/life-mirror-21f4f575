import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

interface Cell {
  day: number; // 0..6 Mon..Sun
  hour: number; // 0..23
  count: number;
  avgMood: number;
}

const DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

const moodColor = (mood: number) => {
  if (mood >= 7) return "hsl(var(--ring-exercise))";
  if (mood >= 5) return "hsl(var(--stat-meaning))";
  if (mood >= 3) return "hsl(var(--stat-creativity))";
  return "hsl(var(--destructive))";
};

interface Props {
  days?: number;
}

export const MoodHeatmap = ({ days = 30 }: Props) => {
  const { user } = useAuth();
  const [cells, setCells] = useState<Cell[]>([]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const start = new Date();
      start.setDate(start.getDate() - (days - 1));
      const { data } = await supabase
        .from("mood_pings")
        .select("mood, created_at")
        .eq("user_id", user.id)
        .gte("created_at", start.toISOString());

      const map = new Map<string, { sum: number; count: number; day: number; hour: number }>();
      for (const r of data ?? []) {
        const d = new Date(r.created_at);
        const day = (d.getDay() + 6) % 7; // Mon..Sun -> 0..6
        const hour = d.getHours();
        const k = `${day}-${hour}`;
        const cur = map.get(k) ?? { sum: 0, count: 0, day, hour };
        cur.sum += r.mood;
        cur.count += 1;
        map.set(k, cur);
      }
      setCells(Array.from(map.values()).map((c) => ({
        day: c.day,
        hour: c.hour,
        count: c.count,
        avgMood: c.sum / c.count,
      })));
    })();
  }, [user, days]);

  const grid = useMemo(() => {
    const m = new Map<string, Cell>();
    for (const c of cells) m.set(`${c.day}-${c.hour}`, c);
    return m;
  }, [cells]);

  return (
    <Card className="ios-card p-5">
      <p className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4">
        тепловая карта
      </p>
      <div className="overflow-x-auto">
        <div className="inline-block">
          {/* hour ruler */}
          <div className="grid pl-7 mb-1" style={{ gridTemplateColumns: `repeat(24, 14px)`, gap: 2 }}>
            {Array.from({ length: 24 }).map((_, h) => (
              <span
                key={h}
                className="mono text-[9px] text-muted-foreground text-center leading-none"
              >
                {h % 3 === 0 ? h : ""}
              </span>
            ))}
          </div>
          {DAYS.map((label, d) => (
            <div key={d} className="flex items-center gap-1 mb-[2px]">
              <span className="mono text-[10px] text-muted-foreground w-6 text-right">{label}</span>
              <div className="grid" style={{ gridTemplateColumns: `repeat(24, 14px)`, gap: 2 }}>
                {Array.from({ length: 24 }).map((_, h) => {
                  const c = grid.get(`${d}-${h}`);
                  if (!c) {
                    return (
                      <div
                        key={h}
                        className="size-[14px] rounded-[3px]"
                        style={{ background: "hsl(var(--muted) / 0.35)" }}
                      />
                    );
                  }
                  return (
                    <div
                      key={h}
                      className="size-[14px] rounded-[3px]"
                      style={{ background: moodColor(c.avgMood) }}
                      title={`${label} ${h}:00 — ${c.avgMood.toFixed(1)}/10 · ${c.count}`}
                    />
                  );
                })}
              </div>
            </div>
          ))}
          <div className="flex items-center gap-1 mt-3 mono text-[10px] text-muted-foreground">
            <span>1</span>
            {[2, 4, 6, 8, 10].map((m) => (
              <span
                key={m}
                className="size-[10px] rounded-[2px]"
                style={{ background: moodColor(m) }}
              />
            ))}
            <span>10</span>
          </div>
        </div>
      </div>
    </Card>
  );
};
