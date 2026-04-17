import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { toast } from "sonner";

interface Session {
  id: string;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  quality: number | null;
  interruptions: number;
  avg_loudness: number | null;
  smart_wake: boolean;
}

export const SleepHistory = () => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [insight, setInsight] = useState<string>("");
  const [loadingInsight, setLoadingInsight] = useState(false);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await supabase
        .from("sleep_sessions")
        .select("id,started_at,ended_at,duration_minutes,quality,interruptions,avg_loudness,smart_wake")
        .eq("user_id", user.id)
        .not("ended_at", "is", null)
        .order("started_at", { ascending: false })
        .limit(14);
      setSessions((data ?? []) as Session[]);
    })();
  }, [user]);

  const stats = (() => {
    const filled = sessions.filter((s) => s.duration_minutes);
    if (!filled.length) return null;
    const avgDur = filled.reduce((s, x) => s + (x.duration_minutes ?? 0), 0) / filled.length;
    const avgInt = filled.reduce((s, x) => s + x.interruptions, 0) / filled.length;
    return { avgDur, avgInt, count: filled.length };
  })();

  const fetchInsights = async () => {
    setLoadingInsight(true);
    try {
      const { data, error } = await supabase.functions.invoke("sleep-insights");
      if (error) throw error;
      setInsight(data.insight ?? "");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось получить интерпретацию");
    } finally {
      setLoadingInsight(false);
    }
  };

  return (
    <div className="space-y-4">
      {stats && (
        <Card className="ios-card p-5 grid grid-cols-3 gap-4">
          <Stat label="Среднее" value={`${Math.floor(stats.avgDur / 60)}ч ${Math.round(stats.avgDur % 60)}м`} />
          <Stat label="Сессий" value={String(stats.count)} />
          <Stat label="Прерываний" value={stats.avgInt.toFixed(1)} />
        </Card>
      )}

      <Card className="ios-card p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
            интерпретация AI
          </p>
          <Button size="sm" variant="ghost" onClick={fetchInsights} disabled={loadingInsight} className="rounded-full">
            {loadingInsight ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            <span className="ml-1.5 text-xs">{insight ? "Обновить" : "Получить"}</span>
          </Button>
        </div>
        {insight ? (
          <p className="text-sm leading-relaxed whitespace-pre-line">{insight}</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Запиши несколько ночей и получи разбор паттернов сна.
          </p>
        )}
      </Card>

      <Card className="ios-card p-5">
        <p className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
          последние сессии
        </p>
        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ещё нет завершённых сессий</p>
        ) : (
          <ul className="divide-y divide-border/50">
            {sessions.map((s) => {
              const d = s.duration_minutes ?? 0;
              const hueByQ = s.quality ? ((s.quality - 1) / 4) * 140 : null;
              return (
                <li key={s.id} className="py-3 flex items-center gap-3">
                  <div
                    className="size-10 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                    style={{
                      background: hueByQ !== null
                        ? `hsl(${hueByQ} 60% 50%)`
                        : "hsl(var(--muted))",
                    }}
                  >
                    {s.quality ?? "—"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {format(new Date(s.started_at), "EEEE, d MMM", { locale: ru })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(s.started_at), "HH:mm")} →{" "}
                      {s.ended_at && format(new Date(s.ended_at), "HH:mm")} ·{" "}
                      {Math.floor(d / 60)}ч {d % 60}м
                      {s.interruptions > 0 && ` · ${s.interruptions} прер.`}
                    </p>
                  </div>
                  {s.smart_wake && (
                    <span className="mono text-[9px] uppercase text-primary border border-primary/40 rounded-full px-2 py-0.5">
                      smart
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
    <p className="text-xl font-bold mt-1">{value}</p>
  </div>
);
