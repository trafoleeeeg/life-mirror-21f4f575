import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

interface Row {
  label: string;
  avg: number;
  count: number;
}

const tone = (mood: number) => {
  if (mood >= 7) return "hsl(var(--ring-exercise))";
  if (mood >= 5) return "hsl(var(--stat-mind))";
  if (mood >= 3) return "hsl(var(--stat-creativity))";
  return "hsl(var(--destructive))";
};

interface Props {
  days?: number;
}

export const ActivityImpact = ({ days = 30 }: Props) => {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const start = new Date();
      start.setDate(start.getDate() - (days - 1));
      const { data } = await supabase
        .from("mood_pings")
        .select("mood, activities, created_at")
        .eq("user_id", user.id)
        .gte("created_at", start.toISOString());

      const map = new Map<string, { sum: number; count: number }>();
      for (const r of data ?? []) {
        for (const a of r.activities ?? []) {
          const cur = map.get(a) ?? { sum: 0, count: 0 };
          cur.sum += r.mood;
          cur.count += 1;
          map.set(a, cur);
        }
      }
      const out: Row[] = Array.from(map.entries())
        .map(([label, v]) => ({ label, avg: v.sum / v.count, count: v.count }))
        .sort((a, b) => b.avg - a.avg)
        .slice(0, 8);
      setRows(out);
      setLoading(false);
    })();
  }, [user, days]);

  if (loading) return null;

  return (
    <Card className="ios-card p-5">
      <p className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4">
        влияние активностей
      </p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Отмечай активности в чек-инах — здесь появится их влияние на настроение.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.label} className="grid grid-cols-[120px_1fr_auto_auto] items-center gap-3">
              <p className="text-sm truncate">{r.label}</p>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${(r.avg / 10) * 100}%`, background: tone(r.avg) }}
                />
              </div>
              <span className="mono text-sm tabular-nums w-10 text-right">
                {r.avg.toFixed(1)}
              </span>
              <span className="mono text-xs text-muted-foreground w-8 text-right">
                ×{r.count}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
