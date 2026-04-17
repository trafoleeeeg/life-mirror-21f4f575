// Collapsed list of recent check-ins (per ОС-апрель: secondary, last 5 by default).
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface Ping {
  id: string;
  mood: number;
  emoji: string | null;
  activities: string[];
  note: string | null;
  created_at: string;
}

interface Props {
  refreshKey?: number;
}

export const CheckinsList = ({ refreshKey = 0 }: Props) => {
  const { user } = useAuth();
  const [pings, setPings] = useState<Ping[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("mood_pings")
        .select("id,mood,emoji,activities,note,created_at")
        .eq("user_id", user.id)
        .gte("created_at", start.toISOString())
        .order("created_at", { ascending: false });
      setPings((data ?? []) as Ping[]);
    })();
  }, [user, refreshKey]);

  if (pings.length === 0) return null;
  const visible = expanded ? pings : pings.slice(0, 3);

  return (
    <Card className="ios-card p-5 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <p className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
          чек-ины · сегодня
        </p>
        <span className="mono text-xs text-muted-foreground">{pings.length}</span>
      </div>
      <ul className="divide-y divide-border/40">
        {visible.map((p, i) => (
          <li
            key={p.id}
            className="py-2.5 flex items-start gap-3"
            style={{ animation: `fade-in 0.35s ease-out ${i * 0.04}s both` }}
          >
            <div className="text-2xl leading-none">{p.emoji ?? "·"}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="mono text-xs text-muted-foreground">
                  {format(new Date(p.created_at), "HH:mm", { locale: ru })}
                </span>
                <span className="mono text-sm">{p.mood}/10</span>
              </div>
              {p.activities.length > 0 && (
                <p className="text-xs text-muted-foreground truncate">
                  {p.activities.join(" · ")}
                </p>
              )}
              {p.note && <p className="text-sm mt-0.5 line-clamp-2">{p.note}</p>}
            </div>
          </li>
        ))}
      </ul>
      {pings.length > 3 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded((v) => !v)}
          className="rounded-full w-full mt-2 gap-1.5 text-xs text-muted-foreground"
        >
          {expanded ? (
            <><ChevronUp className="size-3.5" /> Свернуть</>
          ) : (
            <><ChevronDown className="size-3.5" /> Показать все ({pings.length})</>
          )}
        </Button>
      )}
    </Card>
  );
};
