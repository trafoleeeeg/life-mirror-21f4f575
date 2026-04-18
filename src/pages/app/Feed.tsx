// Лента в Threads-стиле: плотный поток, inline-ответы, без секций категорий.
// Категории остаются скрытыми хештегами в посте (для совместимости с AI-постами).
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Repeat2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { UserSearch } from "@/components/social/UserSearch";
import { ThreadPost, ThreadPostData, ThreadComment } from "@/components/feed/ThreadPost";
import { PostComposer } from "@/components/feed/PostComposer";

const M = 60_000;
const H = 60 * M;

interface PostBase {
  id: string;
  user_id: string | null;
  category: string;
  content: string;
  created_at: string;
  is_ai: boolean;
  ai_author: string | null;
  image_url: string | null;
  reposted_from: string | null;
  repost_quote: string | null;
}

const initialsOf = (s?: string | null) => (s || "??").slice(0, 2).toUpperCase();

const Feed = () => {
  const { user } = useAuth();
  const [myAvatar, setMyAvatar] = useState<string | null>(null);
  const [myName, setMyName] = useState<string>("");
  const [posts, setPosts] = useState<ThreadPostData[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<"all" | "following">("all");
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, ThreadComment[]>>({});
  const [repostFor, setRepostFor] = useState<ThreadPostData | null>(null);
  const [repostQuote, setRepostQuote] = useState("");

  const enrichPosts = async (rawPosts: PostBase[]): Promise<ThreadPostData[]> => {
    if (!rawPosts.length) return [];
    const ids = rawPosts.map((p) => p.id);
    const userIds = Array.from(new Set(rawPosts.map((p) => p.user_id).filter((x): x is string => !!x)));
    const repostedIds = Array.from(new Set(rawPosts.map((p) => p.reposted_from).filter((x): x is string => !!x)));

    const [likesRes, commentsCountRes, repostsRes, originalsRes] = await Promise.all([
      ids.length
        ? supabase.from("post_likes").select("post_id,user_id").in("post_id", ids)
        : Promise.resolve({ data: [] as { post_id: string; user_id: string }[] }),
      ids.length
        ? supabase.from("post_comments").select("post_id").in("post_id", ids)
        : Promise.resolve({ data: [] as { post_id: string }[] }),
      ids.length
        ? supabase.from("posts").select("reposted_from").in("reposted_from", ids)
        : Promise.resolve({ data: [] as { reposted_from: string | null }[] }),
      repostedIds.length
        ? supabase.from("posts").select("id,user_id,content,category,created_at,image_url").in("id", repostedIds)
        : Promise.resolve({ data: [] as Array<Pick<PostBase, "id" | "user_id" | "content" | "category" | "created_at" | "image_url">> }),
    ]);

    const origUserIds = Array.from(new Set((originalsRes.data || []).map((o) => o.user_id).filter((x): x is string => !!x)));
    const allUserIds = Array.from(new Set([...userIds, ...origUserIds]));
    const { data: allProfiles } = allUserIds.length
      ? await supabase.from("public_profiles").select("user_id,display_name,username,avatar_url").in("user_id", allUserIds)
      : { data: [] };

    const profileMap = new Map((allProfiles || []).map((p) => [p.user_id, p]));

    const commentsMap = new Map<string, number>();
    (commentsCountRes.data || []).forEach((c) =>
      commentsMap.set(c.post_id, (commentsMap.get(c.post_id) || 0) + 1),
    );

    const likesMap = new Map<string, number>();
    const myLikes = new Set<string>();
    (likesRes.data || []).forEach((l) => {
      likesMap.set(l.post_id, (likesMap.get(l.post_id) || 0) + 1);
      if (user && l.user_id === user.id) myLikes.add(l.post_id);
    });

    const repostsMap = new Map<string, number>();
    (repostsRes.data || []).forEach((r) => {
      if (r.reposted_from) repostsMap.set(r.reposted_from, (repostsMap.get(r.reposted_from) || 0) + 1);
    });

    const originalMap = new Map(
      (originalsRes.data || []).map((o) => {
        const prof = o.user_id ? profileMap.get(o.user_id) : null;
        return [o.id, {
          id: o.id,
          content: o.content,
          created_at: o.created_at,
          image_url: o.image_url,
          author_name: prof?.display_name || "аноним",
          author_username: prof?.username || null,
        }];
      }),
    );

    return rawPosts.map((p) => {
      const prof = p.user_id ? profileMap.get(p.user_id) : null;
      return {
        ...p,
        author_name: p.is_ai ? p.ai_author || "AI · Дилемма дня" : prof?.display_name || "аноним",
        author_username: p.is_ai ? null : prof?.username || null,
        author_avatar: p.is_ai ? null : prof?.avatar_url || null,
        likes: likesMap.get(p.id) || 0,
        liked: myLikes.has(p.id),
        comments: commentsMap.get(p.id) || 0,
        reposts: repostsMap.get(p.id) || 0,
        original: p.reposted_from ? originalMap.get(p.reposted_from) : undefined,
      };
    });
  };

  const load = async () => {
    setLoading(true);
    const { data: rawPosts, error } = await supabase
      .from("posts")
      .select("id,user_id,category,content,created_at,is_ai,ai_author,image_url,reposted_from,repost_quote")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      toast.error("Не удалось загрузить ленту");
      setLoading(false);
      return;
    }
    setPosts(await enrichPosts((rawPosts || []) as PostBase[]));
    setLoading(false);
  };

  useEffect(() => {
    void load();
    if (user) {
      void supabase
        .from("profiles")
        .select("avatar_url,display_name")
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          setMyAvatar(data?.avatar_url || null);
          setMyName(data?.display_name || "");
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Подписки текущего юзера
  useEffect(() => {
    if (!user) { setFollowingIds(new Set()); return; }
    void (async () => {
      const { data } = await supabase
        .from("follows").select("followee_id").eq("follower_id", user.id);
      setFollowingIds(new Set((data || []).map((r) => r.followee_id)));
    })();
    const ch = supabase
      .channel(`my-follows-${user.id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "follows", filter: `follower_id=eq.${user.id}` },
        async () => {
          const { data } = await supabase
            .from("follows").select("followee_id").eq("follower_id", user.id);
          setFollowingIds(new Set((data || []).map((r) => r.followee_id)));
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("feed-live")
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "posts" },
        async (payload) => {
          const row = payload.new as PostBase;
          const enriched = await enrichPosts([row]);
          setPosts((prev) => (prev.some((p) => p.id === row.id) ? prev : [enriched[0], ...prev]));
        })
      .on("postgres_changes",
        { event: "DELETE", schema: "public", table: "posts" },
        (payload) => {
          const id = (payload.old as { id: string }).id;
          setPosts((prev) => prev.filter((p) => p.id !== id));
        })
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "post_likes" },
        (payload) => {
          const r = payload.new as { post_id: string; user_id: string };
          setPosts((prev) =>
            prev.map((p) => p.id === r.post_id
              ? { ...p, likes: p.likes + 1, liked: user?.id === r.user_id ? true : p.liked }
              : p));
        })
      .on("postgres_changes",
        { event: "DELETE", schema: "public", table: "post_likes" },
        (payload) => {
          const r = payload.old as { post_id: string; user_id: string };
          setPosts((prev) =>
            prev.map((p) => p.id === r.post_id
              ? { ...p, likes: Math.max(0, p.likes - 1), liked: user?.id === r.user_id ? false : p.liked }
              : p));
        })
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "post_comments" },
        async (payload) => {
          const { post_id } = payload.new as { post_id: string };
          setPosts((prev) =>
            prev.map((p) => (p.id === post_id ? { ...p, comments: p.comments + 1 } : p)));
          if (openComments === post_id) await loadComments(post_id);
        })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, openComments]);

  const visible = useMemo(() => {
    let filtered = posts;
    if (scope === "following") {
      filtered = filtered.filter((p) =>
        p.user_id && (followingIds.has(p.user_id) || p.user_id === user?.id),
      );
    }
    return filtered;
  }, [posts, scope, followingIds, user?.id]);


  const submitRepost = async () => {
    if (!repostFor || !user) return;
    const original = repostFor.reposted_from ? null : repostFor;
    if (!original) return;
    const { error } = await supabase.from("posts").insert({
      user_id: user.id,
      content: original.content,
      category: original.category,
      reposted_from: original.id,
      repost_quote: repostQuote.trim() || null,
    });
    if (error) {
      toast.error("Не удалось репостнуть");
      return;
    }
    toast.success("Репостнуто");
    setRepostFor(null);
    setRepostQuote("");
  };

  const toggleLike = async (p: ThreadPostData) => {
    if (!user) return;
    if (p.liked) {
      await supabase.from("post_likes").delete()
        .eq("post_id", p.id).eq("user_id", user.id);
    } else {
      const { error } = await supabase.from("post_likes").insert({
        post_id: p.id, user_id: user.id,
      });
      if (error && !String(error.message).includes("duplicate")) toast.error("Не удалось");
    }
  };

  const removePost = async (p: ThreadPostData) => {
    if (!user || p.user_id !== user.id) return;
    if (!confirm("Удалить пост?")) return;
    const { error } = await supabase.from("posts").delete().eq("id", p.id);
    if (error) return toast.error("Не удалось удалить");
    setPosts((prev) => prev.filter((x) => x.id !== p.id));
  };

  const loadComments = async (postId: string) => {
    const { data } = await supabase
      .from("post_comments")
      .select("id,user_id,content,created_at")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    const userIds = Array.from(new Set((data || []).map((c) => c.user_id)));
    const { data: profs } = userIds.length
      ? await supabase.from("public_profiles").select("user_id,display_name,username,avatar_url").in("user_id", userIds)
      : { data: [] };
    const profMap = new Map((profs || []).map((p) => [p.user_id, p]));
    setComments((prev) => ({
      ...prev,
      [postId]: (data || []).map((c) => {
        const prof = profMap.get(c.user_id);
        return {
          ...c,
          author_name: prof?.display_name || "аноним",
          author_username: prof?.username || null,
          author_avatar: prof?.avatar_url || null,
        };
      }),
    }));
  };

  const toggleComments = async (postId: string) => {
    if (openComments === postId) { setOpenComments(null); return; }
    setOpenComments(postId);
    if (!comments[postId]) await loadComments(postId);
  };

  const sendComment = async (postId: string, text: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("post_comments")
      .insert({ post_id: postId, user_id: user.id, content: text });
    if (error) { toast.error("Не удалось отправить"); return; }
    await loadComments(postId);
  };

  return (
    <div className="-mx-4 md:-mx-8 md:-my-10 max-w-[640px] md:mx-auto">
      {/* Sticky top: tabs + search */}
      <div
        data-no-swipe
        className="sticky top-[calc(env(safe-area-inset-top)+3rem)] md:top-0 z-20 bg-background border-b border-border/50"
      >
        <div className="flex items-center px-4 py-2 gap-2">
          <button
            onClick={() => setScope("all")}
            className={cn(
              "flex-1 text-sm font-medium py-2 rounded-full transition-colors",
              scope === "all" ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            Для тебя
          </button>
          <button
            onClick={() => setScope("following")}
            className={cn(
              "flex-1 text-sm font-medium py-2 rounded-full transition-colors",
              scope === "following" ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            Подписки {followingIds.size > 0 && <span className="opacity-60">· {followingIds.size}</span>}
          </button>
        </div>
        <div className="h-0.5 flex">
          <div className={cn("flex-1 transition-colors", scope === "all" ? "bg-foreground" : "bg-transparent")} />
          <div className={cn("flex-1 transition-colors", scope === "following" ? "bg-foreground" : "bg-transparent")} />
        </div>
        <div className="px-4 py-2">
          <UserSearch className="w-full" />
        </div>
      </div>

      {/* Composer — Threads style with image upload */}
      <PostComposer myAvatar={myAvatar} myName={myName} />

      {/* Feed */}
      {loading ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin mx-auto mb-2" />
          Загружаем…
        </div>
      ) : visible.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          {scope === "following" ? "Подпишись на кого-нибудь — здесь появятся их треды." : "Здесь пока тихо."}
        </div>
      ) : (
        <div>
          {visible.map((p) => (
            <ThreadPost
              key={p.id}
              post={p}
              isMine={user?.id === p.user_id}
              isOpen={openComments === p.id}
              comments={comments[p.id] || []}
              onToggleLike={() => toggleLike(p)}
              onToggleComments={() => toggleComments(p.id)}
              onRepost={() => { setRepostFor(p); setRepostQuote(""); }}
              onDelete={() => removePost(p)}
              onSendComment={(text) => sendComment(p.id, text)}
            />
          ))}
        </div>
      )}

      {/* Repost dialog */}
      {repostFor && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setRepostFor(null)}
        >
          <Card className="ios-card p-5 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Repeat2 className="size-4" /> Репост с цитатой
            </h3>
            <Textarea
              value={repostQuote}
              onChange={(e) => setRepostQuote(e.target.value)}
              placeholder="Добавь свою мысль (необязательно)"
              rows={2}
              className="resize-none mb-3"
              maxLength={280}
            />
            <div className="bg-muted/50 rounded-lg p-3 text-sm mb-3 max-h-32 overflow-y-auto">
              <p className="text-xs text-muted-foreground mb-1">{repostFor.author_name}</p>
              <p className="line-clamp-4">{repostFor.content}</p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setRepostFor(null)} className="rounded-full">
                Отмена
              </Button>
              <Button size="sm" onClick={submitRepost} className="rounded-full">
                Репостнуть
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Feed;
