import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

interface Props {
  range: "today" | "7d" | "30d";
}

const getStart = (range: Props["range"]) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (range === "today") return d;
  d.setDate(d.getDate() - (range === "7d" ? 6 : 29));
  return d;
};

export const MoodOverview = ({ range }: Props) => {
  const { user } = useAuth();
  const [moods, setMoods] = useState<number[]>([]);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const start = getStart(range);
      const { data } = await supabase
        .from("mood_pings")
        .select("mood")
        .eq("user_id", user.id)
        .gte("created_at", start.toISOString());
      const arr = (data ?? []).map((r) => r.mood);
      setMoods(arr);
      setCount(arr.length);
    })();
    if (!user) return;
    const ch = supabase
      .channel(`mood-overview-${range}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mood_pings", filter: `user_id=eq.${user.id}` },
        () => {
          const start = getStart(range);
          supabase
            .from("mood_pings")
            .select("mood")
            .eq("user_id", user.id)
            .gte("created_at", start.toISOString())
            .then(({ data }) => {
              const arr = (data ?? []).map((r) => r.mood);
              setMoods(arr);
              setCount(arr.length);
            });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, range]);

  const avg = useMemo(
    () => (moods.length ? moods.reduce((s, x) => s + x, 0) / moods.length : 0),
    [moods],
  );
  const pct = (avg / 10) * 100;

  // Time of day progress (only meaningful for "today")
  const timePct = useMemo(() => {
    if (range !== "today") return 100;
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    return (mins / (24 * 60)) * 100;
  }, [range]);

  const checkinPct = Math.min(100, (count / (range === "today" ? 8 : range === "7d" ? 35 : 120)) * 100);

  // Concentric rings: outer mood, middle checkins, inner time
  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const stroke = 14;
  const ringR = [size / 2 - stroke, size / 2 - stroke * 2 - 6, size / 2 - stroke * 3 - 12];
  const circ = (r: number) => 2 * Math.PI * r;

  return (
    <Card className="ios-card p-5">
      <div className="flex items-center gap-6">
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {ringR.map((r, i) => (
              <circle
                key={`bg-${i}`}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke="hsl(var(--muted) / 0.5)"
                strokeWidth={stroke}
              />
            ))}
            {/* mood ring (outer) */}
            <circle
              cx={cx}
              cy={cy}
              r={ringR[0]}
              fill="none"
              stroke="hsl(var(--ring-exercise))"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${(pct / 100) * circ(ringR[0])} ${circ(ringR[0])}`}
              transform={`rotate(-90 ${cx} ${cy})`}
            />
            {/* checkin ring (middle) */}
            <circle
              cx={cx}
              cy={cy}
              r={ringR[1]}
              fill="none"
              stroke="hsl(var(--stat-mind))"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${(checkinPct / 100) * circ(ringR[1])} ${circ(ringR[1])}`}
              transform={`rotate(-90 ${cx} ${cy})`}
            />
            {/* time ring (inner) */}
            <circle
              cx={cx}
              cy={cy}
              r={ringR[2]}
              fill="none"
              stroke="hsl(var(--stat-emotions))"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${(timePct / 100) * circ(ringR[2])} ${circ(ringR[2])}`}
              transform={`rotate(-90 ${cx} ${cy})`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold mono">{avg ? avg.toFixed(1) : "—"}</span>
            <span className="text-xs text-muted-foreground">из 10</span>
          </div>
        </div>

        <div className="flex-1 space-y-3 min-w-0">
          <Legend
            color="hsl(var(--ring-exercise))"
            label="Настроение"
            value={avg ? `${avg.toFixed(1)} / 10` : "нет данных"}
          />
          <Legend
            color="hsl(var(--stat-mind))"
            label="Чек-ины"
            value={`${count} ${count === 1 ? "запись" : "записей"}`}
          />
          <Legend
            color="hsl(var(--stat-emotions))"
            label="Время дня"
            value={range === "today" ? `${Math.round(timePct)}%` : "—"}
          />
        </div>
      </div>
    </Card>
  );
};

const Legend = ({ color, label, value }: { color: string; label: string; value: string }) => (
  <div className="flex items-start gap-2">
    <span className="size-2.5 rounded-full mt-1.5 shrink-0" style={{ background: color }} />
    <div className="min-w-0">
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-muted-foreground truncate">{value}</p>
    </div>
  </div>
);
