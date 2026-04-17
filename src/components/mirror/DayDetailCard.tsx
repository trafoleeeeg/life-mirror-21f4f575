import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Moon, Activity, MessageSquare } from "lucide-react";

interface Props {
  date: Date;
}

interface Ping {
  id: string;
  mood: number;
  emoji: string | null;
  activities: string[];
  note: string | null;
  created_at: string;
}

interface Sleep {
  id: string;
  started_at: string;
  ended_at: string | null;
  quality: number | null;
  duration_minutes: number | null;
}

const moodHue = (m: number) => Math.round(((m - 1) / 9) * 140);

export const DayDetailCard = ({ date }: Props) => {
  const { user } = useAuth();
  const [pings, setPings] = useState<Ping[]>([]);
  const [sleep, setSleep] = useState<Sleep | null>(null);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const start = new Date(date); start.setHours(0, 0, 0, 0);
      const end = new Date(date); end.setHours(23, 59, 59, 999);
      const [{ data: p }, { data: s }] = await Promise.all([
        supabase.from("mood_pings").select("id,mood,emoji,activities,note,created_at")
          .eq("user_id", user.id)
          .gte("created_at", start.toISOString())
          .lte("created_at", end.toISOString())
          .order("created_at", { ascending: true }),
        supabase.from("sleep_sessions").select("id,started_at,ended_at,quality,duration_minutes")
          .eq("user_id", user.id)
          .gte("ended_at", start.toISOString())
          .lte("ended_at", end.toISOString())
          .order("ended_at", { ascending: false })
          .limit(1).maybeSingle(),
      ]);
      setPings((p ?? []) as Ping[]);
      setSleep((s as Sleep | null) ?? null);
    })();
  }, [user, date.toDateString()]);

  const avg = pings.length ? pings.reduce((s, p) => s + p.mood, 0) / pings.length : null;
  const allActivities = Array.from(new Set(pings.flatMap((p) => p.activities)));

  return (
    <Card className="ios-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {format(date, "EEEE", { locale: ru })}
          </p>
          <h3 className="text-xl font-semibold">{format(date, "d MMMM", { locale: ru })}</h3>
        </div>
        {avg !== null && (
          <div
            className="size-14 rounded-full flex items-center justify-center font-bold text-lg text-white"
            style={{ background: `hsl(${moodHue(avg)} 65% 50%)` }}
          >
            {avg.toFixed(1)}
          </div>
        )}
      </div>

      {pings.length === 0 && !sleep && (
        <p className="text-sm text-muted-foreground py-6 text-center">Нет записей за этот день</p>
      )}

      {sleep && (
        <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-muted/40">
          <Moon className="size-5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Сон</p>
            <p className="text-xs text-muted-foreground">
              {sleep.duration_minutes
                ? `${Math.floor(sleep.duration_minutes / 60)}ч ${sleep.duration_minutes % 60}м`
                : "—"}
              {sleep.quality && ` · качество ${sleep.quality}/5`}
            </p>
          </div>
        </div>
      )}

      {allActivities.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
            <Activity className="size-3.5" /> Активности дня
          </div>
          <div className="flex flex-wrap gap-1.5">
            {allActivities.map((a) => (
              <span key={a} className="px-2 py-0.5 rounded-full bg-secondary text-xs">
                {a}
              </span>
            ))}
          </div>
        </div>
      )}

      {pings.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
            <MessageSquare className="size-3.5" /> Чек-ины
          </div>
          <ul className="space-y-2">
            {pings.map((p) => (
              <li key={p.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/30">
                <div className="text-xl leading-none mt-0.5">{p.emoji}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="mono text-xs text-muted-foreground">
                      {format(new Date(p.created_at), "HH:mm")}
                    </span>
                    <span className="mono text-xs">{p.mood}/10</span>
                  </div>
                  {p.activities.length > 0 && (
                    <p className="text-xs text-muted-foreground">{p.activities.join(" · ")}</p>
                  )}
                  {p.note && <p className="text-sm mt-0.5">{p.note}</p>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
};
