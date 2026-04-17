// Компактные KPI: одна тонкая строка вместо трёх крупных карточек.
// «Дней активно · Лучший час · Серия» — все в один inline-rail.
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Calendar, Clock, Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const CompactKpis = () => {
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
        cur.sum += r.mood; cur.count += 1;
        hourBuckets.set(h, cur);
      }
      setActiveDays(dayset.size);

      let bH = -1, bAvg = -1;
      for (const [h, v] of hourBuckets) {
        const avg = v.sum / v.count;
        if (avg > bAvg) { bAvg = avg; bH = h; }
      }
      setBestHour(bH >= 0 ? bH : null);

      const { data: s } = await supabase.rpc("compute_ping_streak", { _user: user.id });
      setStreak((s as number) ?? 0);
    })();
  }, [user]);

  return (
    <Card className="ios-card p-3">
      <div className="flex items-center justify-around divide-x divide-border/50 text-xs">
        <KpiCell icon={<Calendar className="size-3.5" />} value={`${activeDays}/30`} label="дней" />
        <KpiCell
          icon={<Clock className="size-3.5" />}
          value={bestHour != null ? `${String(bestHour).padStart(2, "0")}:00` : "—"}
          label="пик"
        />
        <KpiCell icon={<Flame className="size-3.5" />} value={String(streak)} label="серия" />
      </div>
    </Card>
  );
};

const KpiCell = ({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) => (
  <div className="flex-1 px-3 flex items-center justify-center gap-2">
    <span className="text-muted-foreground">{icon}</span>
    <span className="mono text-sm font-semibold">{value}</span>
    <span className="text-muted-foreground text-[10px] uppercase tracking-wider">{label}</span>
  </div>
);
