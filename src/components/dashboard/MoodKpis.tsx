import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Zap, Brain, Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const MoodKpis = () => {
  const { user } = useAuth();
  const [activeDays, setActiveDays] = useState(0);
  const [bestHour, setBestHour] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const start = new Date();
      start.setDate(start.getDate() - 29);
      const { data } = await supabase
        .from("mood_pings")
        .select("mood, created_at")
        .eq("user_id", user.id)
        .gte("created_at", start.toISOString());

      const dayset = new Set<string>();
      const hourBuckets = new Map<number, { sum: number; count: number }>();
      for (const r of data ?? []) {
        const d = new Date(r.created_at);
        dayset.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
        const h = d.getHours();
        const cur = hourBuckets.get(h) ?? { sum: 0, count: 0 };
        cur.sum += r.mood;
        cur.count += 1;
        hourBuckets.set(h, cur);
      }
      setActiveDays(dayset.size);

      let bH = -1;
      let bAvg = -1;
      for (const [h, v] of hourBuckets) {
        const avg = v.sum / v.count;
        if (avg > bAvg) {
          bAvg = avg;
          bH = h;
        }
      }
      setBestHour(bH >= 0 ? bH : null);

      const { data: s } = await supabase.rpc("compute_ping_streak", { _user: user.id });
      setStreak((s as number) ?? 0);
    })();
  }, [user]);

  return (
    <div className="grid grid-cols-3 gap-3">
      <Kpi icon={<Zap className="size-5 text-stat-meaning" />} value={activeDays} label="Дней" />
      <Kpi
        icon={<Brain className="size-5 text-stat-emotions" />}
        value={bestHour != null ? `${String(bestHour).padStart(2, "0")}:00` : "—"}
        label="Лучший час"
      />
      <Kpi icon={<Heart className="size-5 text-destructive" />} value={streak} label="Серия дней" />
    </div>
  );
};

const Kpi = ({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: React.ReactNode;
  label: string;
}) => (
  <Card className="ios-card p-4 text-center">
    <div className="flex justify-center mb-1">{icon}</div>
    <div className="text-2xl font-bold mono">{value}</div>
    <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
  </Card>
);
