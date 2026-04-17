// Редизайн «Влияние активностей»:
// — две колонки (👍 поднимают / 👎 опускают), относительно базового настроения за период;
// — у каждой строки понятная цифра «+1.2 vs средний», цвет только полоской слева,
//   нет градиентной заливки на всю карточку, нет смешения активностей.
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

interface Row { label: string; avg: number; count: number; delta: number }

interface Props { days?: number }

export const ActivityImpact = ({ days = 30 }: Props) => {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [globalAvg, setGlobalAvg] = useState<number>(0);
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

      const all = data ?? [];
      const baseline = all.length ? all.reduce((s, x) => s + x.mood, 0) / all.length : 0;
      const map = new Map<string, { sum: number; count: number }>();
      for (const r of all) {
        for (const a of r.activities ?? []) {
          const cur = map.get(a) ?? { sum: 0, count: 0 };
          cur.sum += r.mood; cur.count += 1;
          map.set(a, cur);
        }
      }
      const out: Row[] = Array.from(map.entries())
        .map(([label, v]) => ({
          label,
          avg: v.sum / v.count,
          count: v.count,
          delta: v.sum / v.count - baseline,
        }))
        .filter((r) => r.count >= 2);
      out.sort((a, b) => b.delta - a.delta);
      setRows(out);
      setGlobalAvg(baseline);
      setLoading(false);
    })();
  }, [user, days]);

  const positives = useMemo(() => rows.filter((r) => r.delta > 0).slice(0, 5), [rows]);
  const negatives = useMemo(
    () => [...rows].filter((r) => r.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 5),
    [rows],
  );

  if (loading) return null;

  return (
    <Card className="ios-card p-5">
      <div className="flex items-center justify-between mb-4 gap-2">
        <p className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
          влияние активностей
        </p>
        <span className="mono text-[10px] text-muted-foreground">
          средн.: <span className="text-foreground">{globalAvg.toFixed(1)}/10</span>
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Отмечай активности — увидишь, что поднимает и опускает настроение.
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1">
          <Column rows={positives} positive />
          <Column rows={negatives} positive={false} />
        </div>
      )}
    </Card>
  );
};

// Палитра по дельте: |Δ|<0.3 — нейтрально (жёлтый), <1 — мягкий, ≥1 — насыщенный.
// Для positive-колонки используем зелёный (--stat-finance); для negative — красный (--destructive);
// нейтраль — жёлтый (--stat-meaning).
function colorVarFor(delta: number): string {
  const a = Math.abs(delta);
  if (a < 0.3) return "--stat-meaning";       // жёлтый — почти нейтрально
  if (delta > 0) return "--stat-finance";      // зелёный — заряжает
  return "--destructive";                      // красный — истощает
}

const Column = ({ rows, positive }: { rows: Row[]; positive: boolean }) => {
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  const headColor = positive ? "--stat-finance" : "--destructive";
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="size-3.5" style={{ color: `hsl(var(${headColor}))` }} />
        <p className="text-xs font-medium">
          {positive ? "Поднимают настроение" : "Опускают настроение"}
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground py-1">—</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => {
            const accent = colorVarFor(r.delta);
            const pct = Math.min(100, Math.abs(r.delta) / 3 * 100);
            const human = r.delta > 0 ? "Поднимает" : "Опускает";
            const reliable = r.count >= 3;
            return (
              <li key={r.label} className="flex items-center gap-2" style={{ opacity: reliable ? 1 : 0.55 }}>
                <div className="w-1 h-6 rounded-full shrink-0" style={{ background: `hsl(var(${accent}))` }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate leading-tight">{r.label}</p>
                  <div className="h-1 bg-muted rounded-full overflow-hidden mt-0.5">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, background: `hsl(var(${accent}) / 0.75)` }}
                    />
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p
                    className="mono text-sm font-semibold tabular-nums leading-none"
                    style={{ color: `hsl(var(${accent}))` }}
                    title={`${human} в среднем на ${Math.abs(r.delta).toFixed(1)} балла относительно среднего`}
                  >
                    {r.delta > 0 ? "+" : ""}{r.delta.toFixed(1)}
                  </p>
                  <p className="mono text-[10px] text-muted-foreground">{r.count} раз{r.count === 1 ? "" : r.count < 5 ? "а" : ""}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
