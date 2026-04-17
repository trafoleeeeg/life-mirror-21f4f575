// /app/me — мой профиль в Threads-стиле.
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { ProfileHeader } from "@/components/social/ProfileHeader";
import { ProfileTabs } from "@/components/social/ProfileTabs";
import { UserThreads } from "@/components/feed/UserThreads";
import { Loader2 } from "lucide-react";

interface ProfileRow {
  user_id: string;
  display_name: string | null;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_demo: boolean;
}

const Me = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"threads" | "replies" | "reposts">("threads");
  const [followers, setFollowers] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("profiles")
        .select("user_id,display_name,username,bio,avatar_url,is_demo")
        .eq("user_id", user.id)
        .maybeSingle();
      setProfile(data as ProfileRow | null);
      const [{ count: f1 }, { count: f2 }] = await Promise.all([
        supabase.from("follows").select("id", { count: "exact", head: true }).eq("followee_id", user.id),
        supabase.from("follows").select("id", { count: "exact", head: true }).eq("follower_id", user.id),
      ]);
      setFollowers(f1 || 0);
      setFollowingCount(f2 || 0);
      setLoading(false);
    })();

    const ch = supabase
      .channel(`me-follows-${user.id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "follows" },
        async () => {
          const [{ count: f1 }, { count: f2 }] = await Promise.all([
            supabase.from("follows").select("id", { count: "exact", head: true }).eq("followee_id", user.id),
            supabase.from("follows").select("id", { count: "exact", head: true }).eq("follower_id", user.id),
          ]);
          setFollowers(f1 || 0);
          setFollowingCount(f2 || 0);
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  if (loading) {
    return <div className="p-8 text-center"><Loader2 className="size-4 animate-spin mx-auto" /></div>;
  }
  if (!profile || !user) return null;

  return (
    <div className="-mx-4 md:-mx-8 -my-4 md:-my-10 max-w-[640px] mx-auto md:mx-auto">
      <ProfileHeader
        userId={user.id}
        displayName={profile.display_name}
        username={profile.username}
        bio={profile.bio}
        avatarUrl={profile.avatar_url}
        isDemo={profile.is_demo}
        isMe
        followers={followers}
        followingCount={followingCount}
      />
      <ProfileTabs
        tabs={[
          { id: "threads", label: "Треды" },
          { id: "replies", label: "Ответы" },
          { id: "reposts", label: "Репосты" },
        ]}
        active={tab}
        onChange={(id) => setTab(id as "threads" | "replies" | "reposts")}
      />
      <UserThreads userId={user.id} filter={tab} />
    </div>
  );
};

export default Me;
