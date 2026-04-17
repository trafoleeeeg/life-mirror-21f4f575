// Публичная страница профиля /u/:username
// Любой авторизованный пользователь может посмотреть ник, аватар, био и посты другого участника.
import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles, MessageSquare, Heart } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface ProfileRow {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_demo: boolean;
  created_at: string;
}

interface PostRow {
  id: string;
  category: string;
  content: string;
  created_at: string;
  image_url: string | null;
  likes_count: number;
  comments_count: number;
}

const ago = (iso: string) => {
  const d = Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (d < 1) return "сегодня";
  if (d === 1) return "вчера";
  if (d < 30) return `${d} дн. назад`;
  return `${Math.round(d / 30)} мес. назад`;
};

const CAT_TONE: Record<string, string> = {
  дилемма: "var(--stat-emotions)",
  наблюдение: "var(--ring-exercise)",
  прорыв: "var(--primary)",
  вопрос: "var(--stat-mind)",
  практика: "var(--ring-meaning)",
};

const UserProfile = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ posts: 0, totalLikes: 0, totalComments: 0 });

  useEffect(() => {
    if (!username) return;
    void (async () => {
      setLoading(true);
      const { data: prof } = await supabase
        .from("public_profiles")
        .select("user_id, display_name, username, avatar_url, bio, is_demo, created_at")
        .ilike("username", username)
        .maybeSingle();

      if (!prof) {
        setProfile(null);
        setLoading(false);
        return;
      }
      setProfile(prof as ProfileRow);

      const { data: rawPosts } = await supabase
        .from("posts")
        .select("id, category, content, created_at, image_url")
        .eq("user_id", prof.user_id)
        .order("created_at", { ascending: false })
        .limit(50);

      const ids = (rawPosts || []).map((p) => p.id);
      const [likesRes, commentsRes] = await Promise.all([
        ids.length
          ? supabase.from("post_likes").select("post_id").in("post_id", ids)
          : Promise.resolve({ data: [] as { post_id: string }[] }),
        ids.length
          ? supabase.from("post_comments").select("post_id").in("post_id", ids)
          : Promise.resolve({ data: [] as { post_id: string }[] }),
      ]);
      const likeMap = new Map<string, number>();
      (likesRes.data || []).forEach((l) => likeMap.set(l.post_id, (likeMap.get(l.post_id) || 0) + 1));
      const commentMap = new Map<string, number>();
      (commentsRes.data || []).forEach((c) =>
        commentMap.set(c.post_id, (commentMap.get(c.post_id) || 0) + 1),
      );

      const enriched: PostRow[] = (rawPosts || []).map((p) => ({
        ...p,
        likes_count: likeMap.get(p.id) || 0,
        comments_count: commentMap.get(p.id) || 0,
      }));
      setPosts(enriched);
      setStats({
        posts: enriched.length,
        totalLikes: enriched.reduce((s, p) => s + p.likes_count, 0),
        totalComments: enriched.reduce((s, p) => s + p.comments_count, 0),
      });
      setLoading(false);
    })();
  }, [username]);

  const initials = useMemo(
    () => (profile?.display_name || profile?.username || "??").slice(0, 2).toUpperCase(),
    [profile],
  );

  if (loading) {
    return (
      <Card className="ios-card p-8 text-center text-sm text-muted-foreground">Загружаем профиль…</Card>
    );
  }
  if (!profile) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="rounded-full">
          <ArrowLeft className="size-4 mr-1.5" />Назад
        </Button>
        <Card className="ios-card p-8 text-center">
          <p className="font-medium">Пользователь не найден</p>
          <p className="text-sm text-muted-foreground mt-1">Никнейм @{username} никому не принадлежит.</p>
        </Card>
      </div>
    );
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="rounded-full mb-3">
        <ArrowLeft className="size-4 mr-1.5" />Назад
      </Button>

      <Card className="ios-card p-6 mb-4">
        <div className="flex items-start gap-4">
          <Avatar className="size-20">
            {profile.avatar_url && <AvatarImage src={profile.avatar_url} alt={profile.display_name || ""} />}
            <AvatarFallback className="text-xl">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold">{profile.display_name || "Без имени"}</h1>
              {profile.is_demo && (
                <Badge variant="outline" className="text-[10px]">демо</Badge>
              )}
            </div>
            {profile.username && (
              <p className="mono text-sm text-muted-foreground">@{profile.username}</p>
            )}
            {profile.bio && (
              <p className="text-sm mt-2 leading-relaxed">{profile.bio}</p>
            )}
            <p className="text-[11px] text-muted-foreground mt-2">
              в Inner Glyph с {new Date(profile.created_at).toLocaleDateString("ru", { month: "long", year: "numeric" })}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-border/40">
          <div className="text-center">
            <p className="text-lg font-semibold">{stats.posts}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mono">постов</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold">{stats.totalLikes}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mono">лайков</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold">{stats.totalComments}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mono">ответов</p>
          </div>
        </div>
      </Card>

      <h2 className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
        последние посты
      </h2>
      {posts.length === 0 ? (
        <Card className="ios-card p-6 text-center text-sm text-muted-foreground">
          Пока ничего не опубликовано.
        </Card>
      ) : (
        <div className="space-y-3">
          {posts.map((p) => {
            const tone = CAT_TONE[p.category] || "var(--primary)";
            return (
              <Card key={p.id} className="ios-card p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <Badge
                    variant="outline"
                    className="text-[10px] py-0 px-1.5"
                    style={{ borderColor: `hsl(${tone} / 0.4)`, color: `hsl(${tone})` }}
                  >
                    {p.category}
                  </Badge>
                  <span className="mono text-[10px] text-muted-foreground">{ago(p.created_at)}</span>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{p.content}</p>
                {p.image_url && (
                  <img src={p.image_url} alt="" className="mt-3 rounded-lg w-full object-cover max-h-80" />
                )}
                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5"><Heart className="size-3.5" />{p.likes_count}</span>
                  <span className="flex items-center gap-1.5"><MessageSquare className="size-3.5" />{p.comments_count}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
};

export default UserProfile;
