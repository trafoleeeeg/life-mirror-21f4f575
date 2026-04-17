// Модалка со списком подписчиков или подписок пользователя.
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { FollowButton } from "@/components/social/FollowButton";
import { Loader2 } from "lucide-react";

interface Props {
  userId: string;
  mode: "followers" | "following";
  onClose: () => void;
}

interface Row {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
}

const initialsOf = (s?: string | null) => (s || "??").slice(0, 2).toUpperCase();

export const FollowsList = ({ userId, mode, onClose }: Props) => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const col = mode === "followers" ? "follower_id" : "followee_id";
      const filterCol = mode === "followers" ? "followee_id" : "follower_id";
      const { data: rels } = await supabase
        .from("follows")
        .select(col)
        .eq(filterCol, userId);
      const ids = (rels || []).map((r) => (r as Record<string, string>)[col]);
      if (!ids.length) { setRows([]); setLoading(false); return; }
      const { data: profs } = await supabase
        .from("public_profiles")
        .select("user_id,display_name,username,avatar_url,bio")
        .in("user_id", ids);
      setRows((profs || []) as Row[]);
      setLoading(false);
    })();
  }, [userId, mode]);

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "followers" ? "Подписчики" : "Подписки"}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="py-8 text-center"><Loader2 className="size-4 animate-spin mx-auto" /></div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Пока пусто.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.user_id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/50">
                <Link
                  to={r.username ? `/app/u/${r.username}` : "#"}
                  onClick={(e) => { if (!r.username) e.preventDefault(); else onClose(); }}
                  className="flex items-center gap-3 flex-1 min-w-0"
                >
                  <Avatar className="size-10">
                    {r.avatar_url && <AvatarImage src={r.avatar_url} alt={r.display_name || ""} />}
                    <AvatarFallback className="text-xs">{initialsOf(r.display_name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{r.display_name || "Без имени"}</p>
                    {r.username && <p className="text-xs text-muted-foreground truncate">@{r.username}</p>}
                    {r.bio && <p className="text-xs text-muted-foreground truncate mt-0.5">{r.bio}</p>}
                  </div>
                </Link>
                <FollowButton targetUserId={r.user_id} />
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
