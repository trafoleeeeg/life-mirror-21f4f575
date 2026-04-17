// Focus insights: top weak/strong activity + actionable hint (per ОС-апрель doc).
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingDown, TrendingUp, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

interface Row {
  label: string;
  avg: number;
  count: number;
}

const SUGGESTIONS: Record<string, string[]> = {
  Отношения: ["Напиши близкому человеку", "Назначь встречу", "Позвони родителям"],
  Дружба: ["Позвони другу", "Напиши, как давно не виделись"],
  Спорт: ["20 минут разминки", "Прогулка 30 мин"],
  Сон: ["Лечь на час раньше", "Без телефона за час до сна"],
  Отдых: ["20 минут без телефона", "Тихая прогулка"],
  Работа: ["Планируй блок 90 мин + перерыв", "Закрой одно дело до конца"],
  Учёба: ["25 минут глубокого фокуса", "Повтори вчерашнее"],
  Еда: ["Стакан воды сейчас", "Готовь дома один приём"],
  Общение: ["Спроси, как дела у близкого", "Пригласи кого-то на кофе"],
  default: ["Сделай 10 глубоких вдохов", "Запиши, что чувствуешь", "Прогулка 15 мин"],
};

interface Props {
  days?: number;
}

export const FocusInsights = ({ days = 7 }: Props) => {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);

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
      const arr: Row[] = Array.from(map.entries())
        .filter(([, v]) => v.count >= 2)
        .map(([label, v]) => ({ label, avg: v.sum / v.count, count: v.count }));
      setRows(arr);
    })();
  }, [user, days]);

  const { weak, strong } = useMemo(() => {
    if (rows.length < 2) return { weak: null, strong: null };
    const sorted = [...rows].sort((a, b) => a.avg - b.avg);
    return { weak: sorted[0], strong: sorted[sorted.length - 1] };
  }, [rows]);

  if (!weak || !strong) return null;

  const tips = SUGGESTIONS[weak.label] ?? SUGGESTIONS.default;

  return (
    <Card className="ios-card p-5 animate-fade-in">
      <p className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
        фокус недели
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
          <div className="flex items-center gap-1.5 text-destructive mb-1">
            <TrendingDown className="size-3.5" />
            <span className="mono text-[10px] uppercase tracking-wider">слабое место</span>
          </div>
          <p className="font-semibold text-sm">{weak.label}</p>
          <p className="mono text-xs text-muted-foreground">{weak.avg.toFixed(1)} · ×{weak.count}</p>
        </div>
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
          <div className="flex items-center gap-1.5 text-primary mb-1">
            <TrendingUp className="size-3.5" />
            <span className="mono text-[10px] uppercase tracking-wider">сильная сторона</span>
          </div>
          <p className="font-semibold text-sm">{strong.label}</p>
          <p className="mono text-xs text-muted-foreground">{strong.avg.toFixed(1)} · ×{strong.count}</p>
        </div>
      </div>

      <Button
        onClick={() => setOpen((v) => !v)}
        size="sm"
        variant="ghost"
        className="rounded-full mt-3 w-full justify-start gap-2 text-primary"
      >
        <Sparkles className="size-3.5" />
        Улучшить «{weak.label}»
      </Button>

      {open && (
        <ul className="mt-2 space-y-1.5 animate-fade-in">
          {tips.map((t, i) => (
            <li
              key={i}
              className="text-sm flex items-start gap-2 p-2 rounded-lg bg-muted/40"
              style={{ animation: `fade-in 0.4s ease-out ${i * 0.05}s both` }}
            >
              <span className="text-primary">→</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};
