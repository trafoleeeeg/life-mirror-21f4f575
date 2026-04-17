// Лента — мини-соцсеть смыслов. Тексты важнее картинок.
// Подключена к бэкенду: posts + post_comments + post_likes + post_reactions с RLS + Realtime.
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  MessageSquare, Filter, Flame, Loader2, Trash2, Send, Sparkles, Repeat2, Quote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { UserSearch } from "@/components/social/UserSearch";

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

type ReactionKind = "heart" | "fire" | "thought" | "hug" | "sad";
const REACTIONS: { kind: ReactionKind; emoji: string; label: string }[] = [
  { kind: "heart",   emoji: "❤️", label: "люблю" },
  { kind: "fire",    emoji: "🔥", label: "огонь" },
  { kind: "thought", emoji: "💭", label: "думаю" },
  { kind: "hug",     emoji: "🫂", label: "обнимаю" },
  { kind: "sad",     emoji: "😢", label: "грущу" },
];

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

interface Post extends PostBase {
  author_name: string;
  author_username: string | null;
  author_avatar: string | null;
  comments: number;
  reactions: Record<ReactionKind, number>;
  myReactions: Set<ReactionKind>;
  reposts: number;
  original?: PostBase & { author_name: string; author_username: string | null };
}

interface Comment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  author_name: string;
  author_username: string | null;
  author_avatar: string | null;
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

const initialsOf = (s?: string | null) => (s || "??").slice(0, 2).toUpperCase();

const Feed = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [draftCat, setDraftCat] = useState<Exclude<Cat, "все">>("наблюдение");
  const [filter, setFilter] = useState<Cat>("все");
  const [scope, setScope] = useState<"all" | "following">("all");
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<"hot" | "fresh">("hot");
  const [posting, setPosting] = useState(false);
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [commentDraft, setCommentDraft] = useState("");
  const [repostFor, setRepostFor] = useState<Post | null>(null);
  const [repostQuote, setRepostQuote] = useState("");

  const enrichPosts = async (rawPosts: PostBase[]): Promise<Post[]> => {
    if (!rawPosts.length) return [];
    const ids = rawPosts.map((p) => p.id);
    const userIds = Array.from(new Set(rawPosts.map((p) => p.user_id).filter((x): x is string => !!x)));
    const repostedIds = Array.from(new Set(rawPosts.map((p) => p.reposted_from).filter((x): x is string => !!x)));

    const [profilesRes, reactionsRes, commentsCountRes, repostsRes, originalsRes] = await Promise.all([
      userIds.length
        ? supabase.from("public_profiles").select("user_id,display_name,username,avatar_url").in("user_id", userIds)
        : Promise.resolve({ data: [] as { user_id: string; display_name: string | null; username: string | null; avatar_url: string | null }[] }),
      ids.length
        ? supabase.from("post_reactions").select("post_id,user_id,reaction").in("post_id", ids)
        : Promise.resolve({ data: [] as { post_id: string; user_id: string; reaction: ReactionKind }[] }),
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

    // Авторы исходных постов (для репостов)
    const origUserIds = Array.from(new Set((originalsRes.data || []).map((o) => o.user_id).filter((x): x is string => !!x)));
    const allUserIds = Array.from(new Set([...userIds, ...origUserIds]));
    const { data: allProfiles } = allUserIds.length
      ? await supabase.from("public_profiles").select("user_id,display_name,username,avatar_url").in("user_id", allUserIds)
      : { data: [] };

    const profileMap = new Map(
      (allProfiles || []).map((p) => [p.user_id, p]),
    );

    const commentsMap = new Map<string, number>();
    (commentsCountRes.data || []).forEach((c) =>
      commentsMap.set(c.post_id, (commentsMap.get(c.post_id) || 0) + 1),
    );

    const repostsMap = new Map<string, number>();
    (repostsRes.data || []).forEach((r) => {
      if (r.reposted_from) repostsMap.set(r.reposted_from, (repostsMap.get(r.reposted_from) || 0) + 1);
    });

    const reactionsMap = new Map<string, Record<ReactionKind, number>>();
    const myReactMap = new Map<string, Set<ReactionKind>>();
    (reactionsRes.data || []).forEach((r) => {
      let bucket = reactionsMap.get(r.post_id);
      if (!bucket) {
        bucket = { heart: 0, fire: 0, thought: 0, hug: 0, sad: 0 };
        reactionsMap.set(r.post_id, bucket);
      }
      const kind = r.reaction as ReactionKind;
      bucket[kind] = (bucket[kind] || 0) + 1;
      if (user && r.user_id === user.id) {
        let mine = myReactMap.get(r.post_id);
        if (!mine) { mine = new Set(); myReactMap.set(r.post_id, mine); }
        mine.add(kind);
      }
    });

    const originalMap = new Map(
      (originalsRes.data || []).map((o) => {
        const prof = o.user_id ? profileMap.get(o.user_id) : null;
        return [o.id, {
          ...(o as PostBase),
          is_ai: false,
          ai_author: null,
          reposted_from: null,
          repost_quote: null,
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
        comments: commentsMap.get(p.id) || 0,
        reactions: reactionsMap.get(p.id) || { heart: 0, fire: 0, thought: 0, hug: 0, sad: 0 },
        myReactions: myReactMap.get(p.id) || new Set<ReactionKind>(),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Подписки текущего юзера (для вкладки «Подписки»)
  useEffect(() => {
    if (!user) { setFollowingIds(new Set()); return; }
    void (async () => {
      const { data } = await supabase
        .from("follows")
        .select("followee_id")
        .eq("follower_id", user.id);
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

  // Realtime: новые посты, реакции, комменты
  useEffect(() => {
    const channel = supabase
      .channel("feed-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts" },
        async (payload) => {
          const row = payload.new as PostBase;
          const enriched = await enrichPosts([row]);
          setPosts((prev) => (prev.some((p) => p.id === row.id) ? prev : [enriched[0], ...prev]));
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "posts" },
        (payload) => {
          const id = (payload.old as { id: string }).id;
          setPosts((prev) => prev.filter((p) => p.id !== id));
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "post_reactions" },
        (payload) => {
          const r = payload.new as { post_id: string; user_id: string; reaction: ReactionKind };
          setPosts((prev) =>
            prev.map((p) => {
              if (p.id !== r.post_id) return p;
              const reactions = { ...p.reactions, [r.reaction]: (p.reactions[r.reaction] || 0) + 1 };
              const myReactions = new Set(p.myReactions);
              if (user && r.user_id === user.id) myReactions.add(r.reaction);
              return { ...p, reactions, myReactions };
            }),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "post_reactions" },
        (payload) => {
          const r = payload.old as { post_id: string; user_id: string; reaction: ReactionKind };
          setPosts((prev) =>
            prev.map((p) => {
              if (p.id !== r.post_id) return p;
              const reactions = { ...p.reactions, [r.reaction]: Math.max(0, (p.reactions[r.reaction] || 0) - 1) };
              const myReactions = new Set(p.myReactions);
              if (user && r.user_id === user.id) myReactions.delete(r.reaction);
              return { ...p, reactions, myReactions };
            }),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "post_comments" },
        async (payload) => {
          const { post_id } = payload.new as { post_id: string };
          setPosts((prev) =>
            prev.map((p) => (p.id === post_id ? { ...p, comments: p.comments + 1 } : p)),
          );
          if (openComments === post_id) await loadComments(post_id);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, openComments]);

  const visible = useMemo(() => {
    let filtered = filter === "все" ? posts : posts.filter((p) => p.category === filter);
    if (scope === "following") {
      filtered = filtered.filter((p) =>
        // Свои посты тоже показываем во вкладке «подписки»
        (p.user_id && (followingIds.has(p.user_id) || p.user_id === user?.id))
      );
    }
    if (sort === "fresh") return [...filtered].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    return [...filtered].sort((a, b) => {
      const ha = Math.max(0.5, (Date.now() - +new Date(a.created_at)) / H);
      const hb = Math.max(0.5, (Date.now() - +new Date(b.created_at)) / H);
      const totalA = Object.values(a.reactions).reduce((s, n) => s + n, 0);
      const totalB = Object.values(b.reactions).reduce((s, n) => s + n, 0);
      const sa = (totalA + a.comments * 2 + a.reposts * 3) / Math.pow(ha, 0.6);
      const sb = (totalB + b.comments * 2 + b.reposts * 3) / Math.pow(hb, 0.6);
      return sb - sa;
    });
  }, [posts, filter, sort, scope, followingIds, user?.id]);

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
  };

  const submitRepost = async () => {
    if (!repostFor || !user) return;
    const original = repostFor.reposted_from ? null : repostFor; // не репостим репост
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

  const toggleReaction = async (p: Post, kind: ReactionKind) => {
    if (!user) return;
    if (p.myReactions.has(kind)) {
      await supabase.from("post_reactions").delete()
        .eq("post_id", p.id).eq("user_id", user.id).eq("reaction", kind);
    } else {
      const { error } = await supabase.from("post_reactions").insert({
        post_id: p.id, user_id: user.id, reaction: kind,
      });
      if (error && !String(error.message).includes("duplicate")) toast.error("Не удалось");
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
  };

  const AuthorLink = ({ name, username, avatar, isAi }: { name: string; username: string | null; avatar: string | null; isAi: boolean }) => {
    const inner = (
      <div className="flex items-center gap-2 min-w-0">
        {isAi ? (
          <div className="size-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <Sparkles className="size-4 text-primary" />
          </div>
        ) : (
          <Avatar className="size-8 shrink-0">
            {avatar && <AvatarImage src={avatar} alt={name} />}
            <AvatarFallback className="text-[11px]">{initialsOf(name)}</AvatarFallback>
          </Avatar>
        )}
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{name}</div>
          {username && <div className="mono text-[10px] text-muted-foreground truncate">@{username}</div>}
        </div>
      </div>
    );
    return username && !isAi ? (
      <Link to={`/app/u/${username}`} className="hover:opacity-80 min-w-0 flex-1">{inner}</Link>
    ) : (
      <div className="min-w-0 flex-1">{inner}</div>
    );
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
            const isLong = p.content.length > 320;
            const isRepost = !!p.original;
            return (
              <Card
                key={p.id}
                className={cn(
                  "ios-card p-5 transition-shadow hover:shadow-md",
                  p.is_ai && "border-primary/40",
                )}
                style={p.is_ai ? { background: "hsl(var(--primary) / 0.04)" } : undefined}
              >
                {isRepost && (
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-2">
                    <Repeat2 className="size-3" />
                    <AuthorLink
                      name={p.author_name}
                      username={p.author_username}
                      avatar={p.author_avatar}
                      isAi={p.is_ai}
                    />
                    <span>репостнул</span>
                  </div>
                )}

                {/* Author + category */}
                <div className="flex items-center gap-2 mb-3">
                  <AuthorLink
                    name={isRepost ? (p.original?.author_name || "?") : p.author_name}
                    username={isRepost ? (p.original?.author_username || null) : p.author_username}
                    avatar={isRepost ? null : p.author_avatar}
                    isAi={p.is_ai && !isRepost}
                  />
                  <div className="mono text-[10px] text-muted-foreground shrink-0">
                    {ago(isRepost ? (p.original?.created_at || p.created_at) : p.created_at)}
                  </div>
                  <Badge
                    variant="outline"
                    className="text-[10px] py-0 px-1.5 shrink-0"
                    style={{ borderColor: `hsl(${tone} / 0.4)`, color: `hsl(${tone})` }}
                  >
                    {p.category}
                  </Badge>
                </div>

                {/* Quote (if repost has comment) */}
                {p.repost_quote && (
                  <div className="mb-3 pl-3 border-l-2 border-primary/40 text-sm italic text-muted-foreground flex gap-2">
                    <Quote className="size-3.5 shrink-0 mt-0.5 opacity-50" />
                    <span>{p.repost_quote}</span>
                  </div>
                )}

                {/* Content */}
                <p className={cn("text-sm leading-relaxed whitespace-pre-wrap", isLong && "line-clamp-6")}>
                  {p.content}
                </p>
                {isLong && (
                  <details className="text-xs text-primary mt-1">
                    <summary className="cursor-pointer hover:underline">читать целиком</summary>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap mt-2">{p.content}</p>
                  </details>
                )}

                {/* Image */}
                {(p.image_url || p.original?.image_url) && (
                  <img
                    src={(p.image_url || p.original?.image_url)!}
                    alt=""
                    className="mt-3 rounded-lg w-full object-cover max-h-96"
                    loading="lazy"
                  />
                )}

                {/* Reactions row */}
                <div className="flex items-center gap-1 mt-4 flex-wrap">
                  {REACTIONS.map((r) => {
                    const count = p.reactions[r.kind];
                    const mine = p.myReactions.has(r.kind);
                    return (
                      <button
                        key={r.kind}
                        onClick={() => toggleReaction(p, r.kind)}
                        title={r.label}
                        className={cn(
                          "h-7 px-2 rounded-full text-xs flex items-center gap-1 border transition-colors",
                          mine
                            ? "border-primary bg-primary/15 text-primary"
                            : "border-border/40 hover:border-border text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <span>{r.emoji}</span>
                        {count > 0 && <span className="mono">{count}</span>}
                      </button>
                    );
                  })}
                </div>

                {/* Comments + repost + delete */}
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/40 text-xs text-muted-foreground">
                  <button
                    onClick={() => toggleComments(p.id)}
                    className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                  >
                    <MessageSquare className="size-3.5" />
                    {p.comments}
                  </button>
                  {!isRepost && (
                    <button
                      onClick={() => { setRepostFor(p); setRepostQuote(""); }}
                      className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                    >
                      <Repeat2 className="size-3.5" />
                      {p.reposts || ""}
                    </button>
                  )}
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
                    {(comments[p.id] || []).map((c) => {
                      const linkInner = (
                        <div className="flex items-center gap-2">
                          <Avatar className="size-6">
                            {c.author_avatar && <AvatarImage src={c.author_avatar} alt={c.author_name} />}
                            <AvatarFallback className="text-[9px]">{initialsOf(c.author_name)}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-xs">{c.author_name}</span>
                        </div>
                      );
                      return (
                        <div key={c.id} className="flex gap-2 text-sm">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2 flex-wrap">
                              {c.author_username ? (
                                <Link to={`/app/u/${c.author_username}`} className="hover:opacity-80">
                                  {linkInner}
                                </Link>
                              ) : linkInner}
                              <span className="mono text-[10px] text-muted-foreground">{ago(c.created_at)}</span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap mt-1 ml-8">{c.content}</p>
                          </div>
                        </div>
                      );
                    })}
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

      {/* Repost dialog */}
      {repostFor && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setRepostFor(null)}
        >
          <Card className="ios-card p-5 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-2">Репост с цитатой</h3>
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
                <Repeat2 className="size-3.5 mr-1.5" />Репостнуть
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
};

export default Feed;
