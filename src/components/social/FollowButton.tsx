// Кнопка подписки на пользователя + счётчик подписчиков/подписок.
// Realtime: счётчики обновляются по событиям таблицы follows.
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { UserPlus, UserCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  targetUserId: string;
  className?: string;
}

export const FollowButton = ({ targetUserId, className }: Props) => {
  const { user } = useAuth();
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user || user.id === targetUserId) { setLoading(false); return; }
    void (async () => {
      const { data } = await supabase
        .from("follows")
        .select("id")
        .eq("follower_id", user.id)
        .eq("followee_id", targetUserId)
        .maybeSingle();
      setFollowing(!!data);
      setLoading(false);
    })();
  }, [user?.id, targetUserId]);

  if (!user || user.id === targetUserId) return null;

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    if (following) {
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("followee_id", targetUserId);
      if (error) toast.error("Не удалось отписаться");
      else { setFollowing(false); toast.success("Отписался"); }
    } else {
      const { error } = await supabase
        .from("follows")
        .insert({ follower_id: user.id, followee_id: targetUserId });
      if (error) toast.error("Не удалось подписаться");
      else { setFollowing(true); toast.success("Подписался"); }
    }
    setBusy(false);
  };

  return (
    <Button
      size="sm"
      variant={following ? "outline" : "default"}
      onClick={toggle}
      disabled={loading || busy}
      className={cn("rounded-full", className)}
    >
      {busy ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> :
        following ? <UserCheck className="size-3.5 mr-1.5" /> : <UserPlus className="size-3.5 mr-1.5" />}
      {following ? "Подписан" : "Подписаться"}
    </Button>
  );
};

export const FollowCounters = ({ userId, className }: { userId: string; className?: string }) => {
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);

  const reload = async () => {
    const [{ count: f1 }, { count: f2 }] = await Promise.all([
      supabase.from("follows").select("id", { count: "exact", head: true }).eq("followee_id", userId),
      supabase.from("follows").select("id", { count: "exact", head: true }).eq("follower_id", userId),
    ]);
    setFollowers(f1 || 0);
    setFollowing(f2 || 0);
  };

  useEffect(() => {
    void reload();
    const ch = supabase
      .channel(`follows-${userId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "follows", filter: `followee_id=eq.${userId}` },
        () => void reload())
      .on("postgres_changes",
        { event: "*", schema: "public", table: "follows", filter: `follower_id=eq.${userId}` },
        () => void reload())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId]);

  return (
    <div className={cn("flex gap-4 text-sm", className)}>
      <div><span className="font-semibold">{followers}</span>{" "}
        <span className="text-muted-foreground text-xs">подписчик{followers === 1 ? "" : followers >= 2 && followers <= 4 ? "а" : "ов"}</span>
      </div>
      <div><span className="font-semibold">{following}</span>{" "}
        <span className="text-muted-foreground text-xs">подписк{following === 1 ? "а" : following >= 2 && following <= 4 ? "и" : "и"}</span>
      </div>
    </div>
  );
};
