import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Activity, Smile } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const TodayWidget = () => {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const [avg, setAvg] = useState<number | null>(null);
  const [lastEmoji, setLastEmoji] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hourly, setHourly] = useState<{ hour: string; mood: number | null; raw: number | null }[]>([]);

  const load = async () => {
    if (!user) return;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from("mood_pings")
      .select("mood, emoji, created_at")
      .eq("user_id", user.id)
      .gte("created_at", start.toISOString())
      .order("created_at", { ascending: false });
    const rows = data || [];
    setCount(rows.length);
    setAvg(rows.length ? rows.reduce((s, r) => s + r.mood, 0) / rows.length : null);
    setLastEmoji(rows[0]?.emoji ?? null);

    // hourly buckets 0..23
    const buckets: Record<number, number[]> = {};
    for (const r of rows) {
      const h = new Date(r.created_at).getHours();
      (buckets[h] ||= []).push(r.mood);
    }
    const nowH = new Date().getHours();
    const series = Array.from({ length: nowH + 1 }, (_, h) => {
      const arr = buckets[h];
      const avgH = arr && arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : null;
      return {
        hour: `${String(h).padStart(2, "0")}:00`,
        mood: avgH ?? 0,
        raw: avgH,
      };
    });
    setHourly(series);
    setLoading(false);
  };

  useEffect(() => {
    load();
    if (!user) return;
    const ch = supabase
      .channel("today-pings")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mood_pings", filter: `user_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return (
    <Card className="glass p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="mono text-[10px] uppercase tracking-widest text-muted-foreground">сегодня</p>
          <h3 className="font-semibold text-lg">Твой день в цифрах</h3>
        </div>
        <Button asChild size="sm" className="gap-2">
          <Link to="/app/ping">
            <Sparkles className="size-4" />
            Быстрый пинг
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border/60 p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Activity className="size-4" />
            <span className="text-xs">пингов</span>
          </div>
          <p className="text-2xl font-semibold mono">{loading ? "—" : count}</p>
        </div>

        <div className="rounded-lg border border-border/60 p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Smile className="size-4" />
            <span className="text-xs">средний mood</span>
          </div>
          <p className="text-2xl font-semibold mono">
            {loading ? "—" : avg != null ? avg.toFixed(1) : "—"}
            {avg != null && <span className="text-sm text-muted-foreground"> /10</span>}
          </p>
        </div>

        <div className="rounded-lg border border-border/60 p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <span className="text-xs">последний</span>
          </div>
          <p className="text-2xl">{lastEmoji ?? "·"}</p>
        </div>
      </div>

      {!loading && count > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1">
            <p className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
              настроение по часам
            </p>
            <p className="mono text-[10px] text-muted-foreground">0–{new Date().getHours()}ч</p>
          </div>
          <div className="h-20">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hourly} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="todayMood" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="hour" hide />
                <YAxis domain={[0, 10]} hide />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                  formatter={(_, __, p) => [p.payload.raw != null ? p.payload.raw.toFixed(1) : "—", "mood"]}
                />
                <Area
                  type="monotone"
                  dataKey="mood"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#todayMood)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {!loading && count === 0 && (
        <p className="text-xs text-muted-foreground mt-3">
          Сегодня ещё ни одного пинга. Запиши, как ты сейчас — это займёт 5 секунд.
        </p>
      )}
    </Card>
  );
};
