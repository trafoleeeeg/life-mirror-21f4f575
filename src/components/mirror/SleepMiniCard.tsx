// Mini sleep widget — opens full SleepTracker / SleepHistory in PopupCard.
import { useEffect, useState } from "react";
import { Moon } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PopupCard } from "./PopupCard";
import { SleepTracker } from "@/components/sleep/SleepTracker";
import { SleepHistory } from "@/components/sleep/SleepHistory";

interface Last {
  duration_minutes: number | null;
  quality: number | null;
  ended_at: string | null;
}

interface Props {
  refreshKey?: number;
  onSaved?: () => void;
}

export const SleepMiniCard = ({ refreshKey, onSaved }: Props) => {
  const { user } = useAuth();
  const [last, setLast] = useState<Last | null>(null);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await supabase
        .from("sleep_sessions")
        .select("duration_minutes, quality, ended_at")
        .eq("user_id", user.id)
        .not("ended_at", "is", null)
        .order("ended_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setLast((data as Last | null) ?? null);
    })();
  }, [user, refreshKey]);

  const subtitle = last?.duration_minutes
    ? `${Math.floor(last.duration_minutes / 60)}ч ${last.duration_minutes % 60}м${last.quality ? ` · ★${last.quality}` : ""} · ${last.ended_at ? format(new Date(last.ended_at), "d MMM", { locale: ru }) : ""}`
    : "Нажми, чтобы начать сессию";

  return (
    <PopupCard
      icon={<Moon className="size-5" />}
      title="Sleep Cycle"
      subtitle={subtitle}
      accentToken="--accent"
      preview={
        last?.duration_minutes ? (
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-accent to-primary"
              style={{ width: `${Math.min(100, (last.duration_minutes / 480) * 100)}%` }}
            />
          </div>
        ) : null
      }
    >
      <div className="space-y-5">
        <SleepTracker onSaved={onSaved} />
        <SleepHistory key={refreshKey} />
      </div>
    </PopupCard>
  );
};
