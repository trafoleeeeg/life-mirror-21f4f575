// Маленький индикатор в шапке /app/chat: «AI помнит N паттернов · обновлено X дней назад»
// Тап → открыть досье.
import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const ago = (iso: string | null) => {
  if (!iso) return "никогда";
  const d = Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (d < 1) return "сегодня";
  if (d === 1) return "вчера";
  if (d < 30) return `${d} дн. назад`;
  return `${Math.round(d / 30)} мес. назад`;
};

export const DossierIndicator = ({ onOpen, className }: { onOpen: () => void; className?: string }) => {
  const { user } = useAuth();
  const [patterns, setPatterns] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [hasDossier, setHasDossier] = useState(false);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await supabase
        .from("user_dossier")
        .select("patterns, themes, triggers, updated_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!data) { setHasDossier(false); return; }
      setHasDossier(true);
      const p = (Array.isArray(data.patterns) ? data.patterns.length : 0)
        + (Array.isArray(data.themes) ? data.themes.length : 0)
        + (Array.isArray(data.triggers) ? data.triggers.length : 0);
      setPatterns(p);
      setUpdatedAt(data.updated_at);
    })();
  }, [user?.id]);

  if (!user) return null;

  return (
    <button
      onClick={onOpen}
      className={cn(
        "inline-flex items-center gap-1.5 text-[11px] mono text-muted-foreground hover:text-foreground transition-colors rounded-full border border-border/40 px-2.5 py-1 bg-background/40",
        className,
      )}
      title="Открыть личное дело"
    >
      <FileText className="size-3" />
      {hasDossier
        ? <>помню <span className="font-semibold text-foreground">{patterns}</span> наблюден{patterns === 1 ? "ие" : patterns >= 2 && patterns <= 4 ? "ия" : "ий"} · {ago(updatedAt)}</>
        : <>досье ещё не собрано</>}
    </button>
  );
};
