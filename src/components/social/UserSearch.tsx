// Поиск пользователей по @username с автодополнением.
// Используется в шапке ленты. Никнеймы кликабельны → /app/u/:username.
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface ProfileHit {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
}

const initials = (s?: string | null) => (s || "??").slice(0, 2).toUpperCase();

export const UserSearch = ({ className }: { className?: string }) => {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<ProfileHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Закрывать выпадашку по клику вне
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Дебаунс поиска
  useEffect(() => {
    const term = q.replace(/^@/, "").trim();
    if (term.length < 1) {
      setHits([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      const pattern = `%${term}%`;
      const { data } = await supabase
        .from("public_profiles")
        .select("user_id, username, display_name, avatar_url, bio")
        .or(`username.ilike.${pattern},display_name.ilike.${pattern}`)
        .limit(8);
      setHits((data as ProfileHit[]) || []);
      setLoading(false);
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <Input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="@username или имя"
        className="pl-9 pr-8 h-9 rounded-full text-sm"
      />
      {q && (
        <button
          onClick={() => { setQ(""); setHits([]); }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label="Очистить"
        >
          <X className="size-3.5" />
        </button>
      )}

      {open && q.trim().length > 0 && (
        <div className="absolute z-50 mt-1.5 left-0 right-0 rounded-xl border border-border/60 bg-popover shadow-lg overflow-hidden">
          {loading ? (
            <p className="text-xs text-muted-foreground px-3 py-2.5">Ищу…</p>
          ) : hits.length === 0 ? (
            <p className="text-xs text-muted-foreground px-3 py-2.5">Никого не нашлось</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {hits.map((h) => (
                <li key={h.user_id}>
                  {h.username ? (
                    <Link
                      to={`/app/u/${h.username}`}
                      onClick={() => { setOpen(false); setQ(""); }}
                      className="flex items-center gap-2.5 px-3 py-2 hover:bg-accent transition-colors"
                    >
                      <Avatar className="size-8 shrink-0">
                        {h.avatar_url && <AvatarImage src={h.avatar_url} alt={h.display_name || ""} />}
                        <AvatarFallback className="text-[11px]">{initials(h.display_name || h.username)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{h.display_name || "Без имени"}</div>
                        <div className="mono text-[10px] text-muted-foreground truncate">@{h.username}</div>
                      </div>
                    </Link>
                  ) : (
                    <div className="flex items-center gap-2.5 px-3 py-2 opacity-60">
                      <Avatar className="size-8 shrink-0">
                        <AvatarFallback className="text-[11px]">{initials(h.display_name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm truncate">{h.display_name || "Без имени"}</div>
                        <div className="text-[10px] text-muted-foreground">без @username</div>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
