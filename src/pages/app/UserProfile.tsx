// Публичная страница профиля /u/:username — Threads-стиль.
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ProfileHeader } from "@/components/social/ProfileHeader";
import { ProfileTabs } from "@/components/social/ProfileTabs";
import { UserThreads } from "@/components/feed/UserThreads";

interface ProfileRow {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_demo: boolean;
}

const UserProfile = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"threads" | "replies" | "reposts">("threads");
  const [followers, setFollowers] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  useEffect(() => {
    if (!username) return;
    void (async () => {
      setLoading(true);
      const { data: prof } = await supabase
        .from("public_profiles")
        .select("user_id, display_name, username, avatar_url, bio, is_demo")
        .ilike("username", username)
        .maybeSingle();
      if (!prof) { setProfile(null); setLoading(false); return; }
      setProfile(prof as ProfileRow);
      const [{ count: f1 }, { count: f2 }] = await Promise.all([
        supabase.from("follows").select("id", { count: "exact", head: true }).eq("followee_id", prof.user_id!),
        supabase.from("follows").select("id", { count: "exact", head: true }).eq("follower_id", prof.user_id!),
      ]);
      setFollowers(f1 || 0);
      setFollowingCount(f2 || 0);
      setLoading(false);
    })();
  }, [username]);

  // Realtime обновление счётчиков
  useEffect(() => {
    if (!profile) return;
    const ch = supabase
      .channel(`pub-follows-${profile.user_id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "follows" },
        async () => {
          const [{ count: f1 }, { count: f2 }] = await Promise.all([
            supabase.from("follows").select("id", { count: "exact", head: true }).eq("followee_id", profile.user_id),
            supabase.from("follows").select("id", { count: "exact", head: true }).eq("follower_id", profile.user_id),
          ]);
          setFollowers(f1 || 0);
          setFollowingCount(f2 || 0);
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [profile?.user_id]);

  if (loading) {
    return <div className="p-8 text-center"><Loader2 className="size-4 animate-spin mx-auto" /></div>;
  }
  if (!profile) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="rounded-full">
          <ArrowLeft className="size-4 mr-1.5" />Назад
        </Button>
        <div className="p-8 text-center">
          <p className="font-medium">Пользователь не найден</p>
          <p className="text-sm text-muted-foreground mt-1">Никнейм @{username} никому не принадлежит.</p>
        </div>
      </div>
    );
  }

  const isMe = user?.id === profile.user_id;

  return (
    <div className="-mx-4 md:-mx-8 -my-4 md:-my-10 max-w-[640px] mx-auto md:mx-auto">
      <div className="px-4 pt-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="rounded-full -ml-2">
          <ArrowLeft className="size-4 mr-1.5" />Назад
        </Button>
      </div>
      <ProfileHeader
        userId={profile.user_id}
        displayName={profile.display_name}
        username={profile.username}
        bio={profile.bio}
        avatarUrl={profile.avatar_url}
        isDemo={profile.is_demo}
        isMe={isMe}
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
      <UserThreads userId={profile.user_id} filter={tab} />
    </div>
  );
};

export default UserProfile;
