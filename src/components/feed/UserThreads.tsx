// Лента постов одного пользователя в Threads-стиле.
// Используется на /app/me и /u/:username для табов «Треды» и «Репосты».
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ThreadPost, ThreadPostData, ThreadComment } from "@/components/feed/ThreadPost";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

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

interface Props {
  userId: string;
  filter: "threads" | "replies" | "reposts";
}

export const UserThreads = ({ userId, filter }: Props) => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<ThreadPostData[]>([]);
  const [replies, setReplies] = useState<{
    comment_id: string;
    content: string;
    created_at: string;
    parent: ThreadPostData;
  }[]>([]);
  const [loading, setLoading] = useState(true);
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, ThreadComment[]>>({});

  const enrichPosts = async (rawPosts: PostBase[]): Promise<ThreadPostData[]> => {
    if (!rawPosts.length) return [];
    const ids = rawPosts.map((p) => p.id);
    const userIds = Array.from(new Set(rawPosts.map((p) => p.user_id).filter((x): x is string => !!x)));
    const repostedIds = Array.from(new Set(rawPosts.map((p) => p.reposted_from).filter((x): x is string => !!x)));

    const [likesRes, commentsCountRes, repostsRes, originalsRes] = await Promise.all([
      supabase.from("post_likes").select("post_id,user_id").in("post_id", ids),
      supabase.from("post_comments").select("post_id").in("post_id", ids),
      supabase.from("posts").select("reposted_from").in("reposted_from", ids),
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
    (commentsCountRes.data || []).forEach((c) => commentsMap.set(c.post_id, (commentsMap.get(c.post_id) || 0) + 1));

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
          id: o.id, content: o.content, created_at: o.created_at, image_url: o.image_url,
          author_name: prof?.display_name || "аноним",
          author_username: prof?.username || null,
        }];
      }),
    );

    return rawPosts.map((p) => {
      const prof = p.user_id ? profileMap.get(p.user_id) : null;
      return {
        ...p,
        author_name: p.is_ai ? p.ai_author || "AI" : prof?.display_name || "аноним",
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

  useEffect(() => {
    void (async () => {
      setLoading(true);
      if (filter === "threads") {
        const { data } = await supabase
          .from("posts")
          .select("id,user_id,category,content,created_at,is_ai,ai_author,image_url,reposted_from,repost_quote")
          .eq("user_id", userId)
          .is("reposted_from", null)
          .order("created_at", { ascending: false })
          .limit(100);
        setPosts(await enrichPosts((data || []) as PostBase[]));
      } else if (filter === "reposts") {
        const { data } = await supabase
          .from("posts")
          .select("id,user_id,category,content,created_at,is_ai,ai_author,image_url,reposted_from,repost_quote")
          .eq("user_id", userId)
          .not("reposted_from", "is", null)
          .order("created_at", { ascending: false })
          .limit(100);
        setPosts(await enrichPosts((data || []) as PostBase[]));
      } else {
        // replies: коменты юзера + родительский пост
        const { data: cms } = await supabase
          .from("post_comments")
          .select("id,post_id,content,created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(50);
        const postIds = Array.from(new Set((cms || []).map((c) => c.post_id)));
        const { data: parents } = postIds.length
          ? await supabase
              .from("posts")
              .select("id,user_id,category,content,created_at,is_ai,ai_author,image_url,reposted_from,repost_quote")
              .in("id", postIds)
          : { data: [] as PostBase[] };
        const enriched = await enrichPosts((parents || []) as PostBase[]);
        const enrichedMap = new Map(enriched.map((p) => [p.id, p]));
        setReplies(
          (cms || [])
            .filter((c) => enrichedMap.has(c.post_id))
            .map((c) => ({
              comment_id: c.id,
              content: c.content,
              created_at: c.created_at,
              parent: enrichedMap.get(c.post_id)!,
            })),
        );
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, filter, user?.id]);

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

  const toggleLike = async (p: ThreadPostData) => {
    if (!user) return;
    if (p.liked) {
      await supabase.from("post_likes").delete().eq("post_id", p.id).eq("user_id", user.id);
      setPosts((prev) => prev.map((x) => x.id === p.id ? { ...x, liked: false, likes: Math.max(0, x.likes - 1) } : x));
    } else {
      const { error } = await supabase.from("post_likes").insert({ post_id: p.id, user_id: user.id });
      if (!error) setPosts((prev) => prev.map((x) => x.id === p.id ? { ...x, liked: true, likes: x.likes + 1 } : x));
    }
  };

  const removePost = async (p: ThreadPostData) => {
    if (!user || p.user_id !== user.id) return;
    if (!confirm("Удалить пост?")) return;
    const { error } = await supabase.from("posts").delete().eq("id", p.id);
    if (error) return toast.error("Не удалось удалить");
    setPosts((prev) => prev.filter((x) => x.id !== p.id));
  };

  const sendComment = async (postId: string, text: string) => {
    if (!user) return;
    const { error } = await supabase.from("post_comments").insert({ post_id: postId, user_id: user.id, content: text });
    if (error) { toast.error("Не удалось отправить"); return; }
    await loadComments(postId);
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, comments: p.comments + 1 } : p));
  };

  const toggleComments = async (postId: string) => {
    if (openComments === postId) { setOpenComments(null); return; }
    setOpenComments(postId);
    if (!comments[postId]) await loadComments(postId);
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground"><Loader2 className="size-4 animate-spin mx-auto" /></div>;
  }

  if (filter === "replies") {
    if (replies.length === 0) {
      return <div className="p-8 text-center text-sm text-muted-foreground">Пока нет ответов.</div>;
    }
    return (
      <div>
        {replies.map((r) => (
          <div key={r.comment_id} className="border-b border-border/50">
            <ThreadPost
              post={r.parent}
              isMine={false}
              isOpen={false}
              comments={[]}
              onToggleLike={() => toggleLike(r.parent)}
              onToggleComments={() => toggleComments(r.parent.id)}
              onRepost={() => {}}
              onDelete={() => {}}
              onSendComment={async () => {}}
            />
            <div className="px-4 pb-3 -mt-2 ml-[52px] border-l-2 border-border/40 pl-3 text-sm text-muted-foreground">
              <span className="text-xs uppercase tracking-wider mono">твой ответ:</span>
              <p className="text-foreground mt-1 whitespace-pre-wrap">{r.content}</p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        {filter === "reposts" ? "Пока нет репостов." : "Пока нет тредов."}
      </div>
    );
  }

  return (
    <div>
      {posts.map((p) => (
        <ThreadPost
          key={p.id}
          post={p}
          isMine={user?.id === p.user_id}
          isOpen={openComments === p.id}
          comments={comments[p.id] || []}
          onToggleLike={() => toggleLike(p)}
          onToggleComments={() => toggleComments(p.id)}
          onRepost={() => {}}
          onDelete={() => removePost(p)}
          onSendComment={(text) => sendComment(p.id, text)}
        />
      ))}
    </div>
  );
};
