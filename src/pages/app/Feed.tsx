// Лента — мини-соцсеть смыслов. Тексты важнее картинок.
// Подключена к бэкенду: posts + post_comments + post_likes с RLS.
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Heart, MessageSquare, Filter, Flame, Loader2, Trash2, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

const M = 60_000;
const H = 60 * M;

const CATEGORIES = ["все", "дилемма", "наблюдение", "прорыв", "вопрос", "практика"] as const;
type Cat = typeof CATEGORIES[number];
const POST_CATS = CATEGORIES.filter((c) => c !== "все") as Exclude<Cat, "все">[];

const CAT_TONE: Record<string, string> = {
  дилемма: "var(--stat-emotions)",
  наблюдение: "var(--ring-exercise)",
  прорыв: "var(--primary)",
  вопрос: "var(--stat-mind)",
  практика: "var(--ring-meaning)",
};

interface Post {
  id: string;
  user_id: string;
  category: string;
  content: string;
  created_at: string;
  author_name: string;
  likes: number;
  comments: number;
  liked: boolean;
}

interface Comment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  author_name: string;
}

const ago = (iso: string) => {
  const ts = new Date(iso).getTime();
  const m = Math.round((Date.now() - ts) / M);
  if (m < 1) return "только что";
  if (m < 60) return `${m}м`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}ч`;
  const d = Math.round(h / 24);
  return `${d}д`;
};

const Feed = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [draftCat, setDraftCat] = useState<Exclude<Cat, "все">>("наблюдение");
  const [filter, setFilter] = useState<Cat>("все");
  const [sort, setSort] = useState<"hot" | "fresh">("hot");
  const [posting, setPosting] = useState(false);
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [commentDraft, setCommentDraft] = useState("");

  const load = async () => {
    setLoading(true);
    const { data: rawPosts, error } = await supabase
      .from("posts")
      .select("id,user_id,category,content,created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      toast.error("Не удалось загрузить ленту");
      setLoading(false);
      return;
    }
    const ids = (rawPosts || []).map((p) => p.id);
    const userIds = Array.from(new Set((rawPosts || []).map((p) => p.user_id)));

    const [profilesRes, likesRes, myLikesRes, commentsCountRes] = await Promise.all([
      supabase.from("public_profiles").select("user_id,display_name").in("user_id", userIds),
      supabase.from("post_likes").select("post_id").in("post_id", ids),
      user
        ? supabase.from("post_likes").select("post_id").in("post_id", ids).eq("user_id", user.id)
        : Promise.resolve({ data: [] as { post_id: string }[] }),
      supabase.from("post_comments").select("post_id").in("post_id", ids),
    ]);

    const nameMap = new Map((profilesRes.data || []).map((p) => [p.user_id, p.display_name || "аноним"]));
    const likesMap = new Map<string, number>();
    (likesRes.data || []).forEach((l) => likesMap.set(l.post_id, (likesMap.get(l.post_id) || 0) + 1));
    const commentsMap = new Map<string, number>();
    (commentsCountRes.data || []).forEach((c) =>
      commentsMap.set(c.post_id, (commentsMap.get(c.post_id) || 0) + 1),
    );
    const mySet = new Set((myLikesRes.data || []).map((l) => l.post_id));

    setPosts(
      (rawPosts || []).map((p) => ({
        ...p,
        author_name: nameMap.get(p.user_id) || "аноним",
        likes: likesMap.get(p.id) || 0,
        comments: commentsMap.get(p.id) || 0,
        liked: mySet.has(p.id),
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const visible = useMemo(() => {
    const filtered = filter === "все" ? posts : posts.filter((p) => p.category === filter);
    if (sort === "fresh") return [...filtered].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    return [...filtered].sort((a, b) => {
      const ha = Math.max(0.5, (Date.now() - +new Date(a.created_at)) / H);
      const hb = Math.max(0.5, (Date.now() - +new Date(b.created_at)) / H);
      const sa = (a.likes + a.comments * 2) / Math.pow(ha, 0.6);
      const sb = (b.likes + b.comments * 2) / Math.pow(hb, 0.6);
      return sb - sa;
    });
  }, [posts, filter, sort]);

  const publish = async () => {
    if (!draft.trim() || !user) return;
    setPosting(true);
    const { error } = await supabase.from("posts").insert({
      user_id: user.id,
      content: draft.trim(),
      category: draftCat,
    });
    setPosting(false);
    if (error) {
      toast.error("Не удалось опубликовать");
      return;
    }
    setDraft("");
    toast.success("Опубликовано");
    load();
  };

  const toggleLike = async (p: Post) => {
    if (!user) return;
    // optimistic
    setPosts((prev) =>
      prev.map((x) => (x.id === p.id ? { ...x, liked: !x.liked, likes: x.likes + (x.liked ? -1 : 1) } : x)),
    );
    if (p.liked) {
      await supabase.from("post_likes").delete().eq("post_id", p.id).eq("user_id", user.id);
    } else {
      await supabase.from("post_likes").insert({ post_id: p.id, user_id: user.id });
    }
  };

  const removePost = async (p: Post) => {
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
    const { data: profs } = await supabase
      .from("public_profiles")
      .select("user_id,display_name")
      .in("user_id", userIds);
    const nameMap = new Map((profs || []).map((p) => [p.user_id, p.display_name || "аноним"]));
    setComments((prev) => ({
      ...prev,
      [postId]: (data || []).map((c) => ({ ...c, author_name: nameMap.get(c.user_id) || "аноним" })),
    }));
  };

  const toggleComments = async (postId: string) => {
    if (openComments === postId) {
      setOpenComments(null);
      return;
    }
    setOpenComments(postId);
    setCommentDraft("");
    if (!comments[postId]) await loadComments(postId);
  };

  const sendComment = async (postId: string) => {
    if (!commentDraft.trim() || !user) return;
    const { error } = await supabase
      .from("post_comments")
      .insert({ post_id: postId, user_id: user.id, content: commentDraft.trim() });
    if (error) return toast.error("Не удалось отправить");
    setCommentDraft("");
    await loadComments(postId);
    setPosts((prev) => prev.map((x) => (x.id === postId ? { ...x, comments: x.comments + 1 } : x)));
  };

  return (
    <>
      <PageHeader
        eyebrow="мини-соцсеть · текст важнее картинок"
        title="Лента"
        description="Дилеммы, мысли, рефлексии. Без подписок — только смыслы."
      />

      {/* Composer */}
      <Card className="ios-card p-4 mb-5">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Что у тебя сейчас в голове? Ситуация, дилемма, наблюдение…"
          rows={3}
          className="resize-none"
        />
        <div className="flex justify-between items-center mt-2 gap-2 flex-wrap">
          <div className="flex items-center gap-1 flex-wrap">
            {POST_CATS.map((c) => (
              <button
                key={c}
                onClick={() => setDraftCat(c)}
                className={cn(
                  "text-[11px] px-2 py-0.5 rounded-full border transition-colors",
                  draftCat === c
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border/60 text-muted-foreground hover:text-foreground",
                )}
              >
                {c}
              </button>
            ))}
          </div>
          <Button onClick={publish} disabled={!draft.trim() || posting} size="sm" className="rounded-full">
            {posting ? <Loader2 className="size-3.5 animate-spin" /> : "Опубликовать"}
          </Button>
        </div>
      </Card>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Filter className="size-3.5 text-muted-foreground" />
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={cn(
              "text-xs px-3 py-1 rounded-full border transition-colors",
              filter === c
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border/60 text-muted-foreground hover:text-foreground hover:border-border",
            )}
          >
            {c}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1 text-xs">
          <button
            onClick={() => setSort("hot")}
            className={cn(
              "px-2.5 py-1 rounded-full flex items-center gap-1 transition-colors",
              sort === "hot" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Flame className="size-3" /> горячее
          </button>
          <button
            onClick={() => setSort("fresh")}
            className={cn(
              "px-2.5 py-1 rounded-full transition-colors",
              sort === "fresh" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            свежее
          </button>
        </div>
      </div>

      {loading ? (
        <Card className="ios-card p-8 text-center text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin mx-auto mb-2" />
          Загружаем…
        </Card>
      ) : (
        <div className="space-y-3">
          {visible.map((p) => {
            const tone = CAT_TONE[p.category] || "var(--primary)";
            const isMine = user?.id === p.user_id;
            const isOpen = openComments === p.id;
            return (
              <Card key={p.id} className="ios-card p-5 transition-shadow hover:shadow-md">
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="size-8 rounded-full shrink-0"
                    style={{ background: `hsl(${tone} / 0.7)` }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{p.author_name}</div>
                    <div className="mono text-[10px] text-muted-foreground">{ago(p.created_at)}</div>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-[10px] py-0 px-1.5 shrink-0"
                    style={{ borderColor: `hsl(${tone} / 0.4)`, color: `hsl(${tone})` }}
                  >
                    {p.category}
                  </Badge>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{p.content}</p>
                <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border/40 text-xs text-muted-foreground">
                  <button
                    onClick={() => toggleLike(p)}
                    className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                    style={p.liked ? { color: "hsl(var(--stat-emotions))" } : undefined}
                  >
                    <Heart className={cn("size-3.5", p.liked && "fill-current")} />
                    {p.likes}
                  </button>
                  <button
                    onClick={() => toggleComments(p.id)}
                    className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                  >
                    <MessageSquare className="size-3.5" />
                    {p.comments}
                  </button>
                  {isMine && (
                    <button
                      onClick={() => removePost(p)}
                      className="ml-auto flex items-center gap-1.5 hover:text-destructive transition-colors"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
                {isOpen && (
                  <div className="mt-4 pt-3 border-t border-border/40 space-y-3">
                    {(comments[p.id] || []).map((c) => (
                      <div key={c.id} className="flex gap-2 text-sm">
                        <div className="size-6 rounded-full bg-muted shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="font-medium text-xs">{c.author_name}</span>
                            <span className="mono text-[10px] text-muted-foreground">
                              {ago(c.created_at)}
                            </span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{c.content}</p>
                        </div>
                      </div>
                    ))}
                    {(comments[p.id] || []).length === 0 && (
                      <div className="text-xs text-muted-foreground">Будь первым.</div>
                    )}
                    <div className="flex gap-2 items-end">
                      <Textarea
                        value={commentDraft}
                        onChange={(e) => setCommentDraft(e.target.value)}
                        placeholder="Ответить…"
                        rows={1}
                        className="resize-none text-sm min-h-[36px]"
                      />
                      <Button
                        size="sm"
                        onClick={() => sendComment(p.id)}
                        disabled={!commentDraft.trim()}
                        className="rounded-full shrink-0"
                      >
                        <Send className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
          {visible.length === 0 && (
            <Card className="ios-card p-8 text-center text-sm text-muted-foreground">
              Здесь пока тихо. Напиши первый пост.
            </Card>
          )}
        </div>
      )}
    </>
  );
};

export default Feed;
