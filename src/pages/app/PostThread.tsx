// Страница одного треда: пост + полная вложенная ветка ответов.
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Loader2 } from "lucide-react";
import { ThreadPost, ThreadPostData, ThreadComment } from "@/components/feed/ThreadPost";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const initialsOf = (s?: string | null) => (s || "??").slice(0, 2).toUpperCase();
const M = 60_000;
const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / M);
  if (m < 1) return "сейчас";
  if (m < 60) return `${m}м`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}ч`;
  const d = Math.round(h / 24);
  return `${d}д`;
};

const PostThread = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [post, setPost] = useState<ThreadPostData | null>(null);
  const [comments, setComments] = useState<ThreadComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const loadPost = async () => {
    if (!id) return;
    const { data: raw, error } = await supabase
      .from("posts")
      .select("id,user_id,category,content,created_at,is_ai,ai_author,image_url,reposted_from,repost_quote")
      .eq("id", id)
      .maybeSingle();
    if (error || !raw) { setPost(null); setLoading(false); return; }

    const [likesRes, commentsCountRes, repostsRes, originalRes] = await Promise.all([
      supabase.from("post_likes").select("post_id,user_id").eq("post_id", raw.id),
      supabase.from("post_comments").select("id").eq("post_id", raw.id),
      supabase.from("posts").select("id").eq("reposted_from", raw.id),
      raw.reposted_from
        ? supabase.from("posts").select("id,user_id,content,created_at,image_url").eq("id", raw.reposted_from).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const userIds = [raw.user_id, originalRes.data?.user_id].filter((x): x is string => !!x);
    const { data: profs } = userIds.length
      ? await supabase.from("public_profiles").select("user_id,display_name,username,avatar_url").in("user_id", userIds)
      : { data: [] };
    const profMap = new Map((profs || []).map((p) => [p.user_id, p]));
    const myLikes = new Set((likesRes.data || []).filter((l) => l.user_id === user?.id).map((l) => l.post_id));
    const prof = raw.user_id ? profMap.get(raw.user_id) : null;
    const origProf = originalRes.data?.user_id ? profMap.get(originalRes.data.user_id) : null;

    setPost({
      ...raw,
      author_name: raw.is_ai ? raw.ai_author || "AI" : prof?.display_name || "аноним",
      author_username: raw.is_ai ? null : prof?.username || null,
      author_avatar: raw.is_ai ? null : prof?.avatar_url || null,
      likes: likesRes.data?.length || 0,
      liked: myLikes.has(raw.id),
      comments: commentsCountRes.data?.length || 0,
      reposts: repostsRes.data?.length || 0,
      original: originalRes.data ? {
        id: originalRes.data.id,
        content: originalRes.data.content,
        created_at: originalRes.data.created_at,
        image_url: originalRes.data.image_url,
        author_name: origProf?.display_name || "аноним",
        author_username: origProf?.username || null,
      } : undefined,
    });
    setLoading(false);
  };

  const loadComments = async () => {
    if (!id) return;
    const { data } = await supabase
      .from("post_comments")
      .select("id,user_id,content,created_at")
      .eq("post_id", id)
      .order("created_at", { ascending: true });
    const userIds = Array.from(new Set((data || []).map((c) => c.user_id)));
    const { data: profs } = userIds.length
      ? await supabase.from("public_profiles").select("user_id,display_name,username,avatar_url").in("user_id", userIds)
      : { data: [] };
    const profMap = new Map((profs || []).map((p) => [p.user_id, p]));
    setComments((data || []).map((c) => {
      const prof = profMap.get(c.user_id);
      return {
        ...c,
        author_name: prof?.display_name || "аноним",
        author_username: prof?.username || null,
        author_avatar: prof?.avatar_url || null,
      };
    }));
  };

  useEffect(() => {
    setLoading(true);
    void loadPost();
    void loadComments();
    if (!id) return;
    const ch = supabase
      .channel(`post-thread-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "post_comments", filter: `post_id=eq.${id}` },
        () => { void loadComments(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.id]);

  const send = async () => {
    if (!user || !id || !draft.trim()) return;
    setSending(true);
    const { error } = await supabase.from("post_comments").insert({
      post_id: id, user_id: user.id, content: draft.trim(),
    });
    setSending(false);
    if (error) { toast.error("Не удалось отправить"); return; }
    setDraft("");
  };

  const toggleLike = async () => {
    if (!user || !post) return;
    if (post.liked) {
      await supabase.from("post_likes").delete().eq("post_id", post.id).eq("user_id", user.id);
      setPost({ ...post, liked: false, likes: Math.max(0, post.likes - 1) });
    } else {
      await supabase.from("post_likes").insert({ post_id: post.id, user_id: user.id });
      setPost({ ...post, liked: true, likes: post.likes + 1 });
    }
  };

  if (loading) {
    return <div className="p-8 text-center"><Loader2 className="size-4 animate-spin mx-auto" /></div>;
  }
  if (!post) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="rounded-full">
          <ArrowLeft className="size-4 mr-1.5" />Назад
        </Button>
        <p className="text-center text-muted-foreground py-8">Пост не найден.</p>
      </div>
    );
  }

  return (
    <div className="-mx-4 md:-mx-8 -my-4 md:-my-10 max-w-[640px] mx-auto md:mx-auto">
      <div className="sticky top-12 md:top-0 z-20 bg-background/85 backdrop-blur-xl border-b border-border/50 px-3 py-2 flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="rounded-full">
          <ArrowLeft className="size-4 mr-1.5" />Тред
        </Button>
      </div>

      <ThreadPost
        post={post}
        isMine={user?.id === post.user_id}
        isOpen={false}
        comments={[]}
        onToggleLike={toggleLike}
        onToggleComments={() => {}}
        onRepost={() => {}}
        onDelete={() => {}}
        onSendComment={async () => {}}
      />

      {/* Composer */}
      {user && (
        <div className="px-4 py-3 border-b border-border/50 flex gap-2.5">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ответить в тред…"
            rows={1}
            className="resize-none rounded-2xl text-sm min-h-[40px]"
          />
          <Button onClick={send} disabled={!draft.trim() || sending} size="sm" className="rounded-full self-end">
            Ответить
          </Button>
        </div>
      )}

      {/* Comments — flat thread (как в Threads) */}
      <div className="divide-y divide-border/50">
        {comments.map((c) => (
          <article key={c.id} className="px-4 py-3 flex gap-3">
            <Link
              to={c.author_username ? `/app/u/${c.author_username}` : "#"}
              className="shrink-0"
              onClick={(e) => { if (!c.author_username) e.preventDefault(); }}
            >
              <Avatar className="size-9">
                {c.author_avatar && <AvatarImage src={c.author_avatar} alt={c.author_name} />}
                <AvatarFallback className="text-xs">{initialsOf(c.author_name)}</AvatarFallback>
              </Avatar>
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-1.5 text-sm">
                <Link
                  to={c.author_username ? `/app/u/${c.author_username}` : "#"}
                  className="font-semibold hover:underline truncate"
                  onClick={(e) => { if (!c.author_username) e.preventDefault(); }}
                >
                  {c.author_name}
                </Link>
                {c.author_username && (
                  <span className="text-muted-foreground text-xs">@{c.author_username}</span>
                )}
                <span className="text-muted-foreground text-xs">·</span>
                <span className="text-muted-foreground text-xs">{ago(c.created_at)}</span>
              </div>
              <p className="text-[15px] leading-snug whitespace-pre-wrap mt-0.5 break-words">{c.content}</p>
            </div>
          </article>
        ))}
        {comments.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            Будь первым в этом треде.
          </div>
        )}
      </div>
    </div>
  );
};

export default PostThread;
