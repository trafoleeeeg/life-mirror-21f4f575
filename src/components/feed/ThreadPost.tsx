// Thread-style post — плотная строка: аватар-линия слева, контент справа.
// Inline-ответы раскрываются под постом по той же вертикальной линии.
import { useState } from "react";
import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Heart, MessageCircle, Repeat2, Share, Trash2, Sparkles, MoreHorizontal, Quote } from "lucide-react";
import { cn } from "@/lib/utils";

const M = 60_000;
const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / M);
  if (m < 1) return "сейчас";
  if (m < 60) return `${m}м`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}ч`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}д`;
  return new Date(iso).toLocaleDateString("ru", { day: "numeric", month: "short" });
};

const initialsOf = (s?: string | null) => (s || "??").slice(0, 2).toUpperCase();

export interface ThreadComment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  author_name: string;
  author_username: string | null;
  author_avatar: string | null;
}

export interface ThreadPostData {
  id: string;
  user_id: string | null;
  content: string;
  created_at: string;
  category: string;
  is_ai: boolean;
  ai_author: string | null;
  image_url: string | null;
  reposted_from: string | null;
  repost_quote: string | null;
  author_name: string;
  author_username: string | null;
  author_avatar: string | null;
  likes: number;
  liked: boolean;
  comments: number;
  reposts: number;
  original?: {
    id: string;
    content: string;
    created_at: string;
    image_url: string | null;
    author_name: string;
    author_username: string | null;
  };
}

interface Props {
  post: ThreadPostData;
  isMine: boolean;
  isOpen: boolean;
  comments: ThreadComment[];
  onToggleLike: () => void;
  onToggleComments: () => void;
  onRepost: () => void;
  onDelete: () => void;
  onSendComment: (text: string) => Promise<void>;
}

export const ThreadPost = ({
  post,
  isMine,
  isOpen,
  comments,
  onToggleLike,
  onToggleComments,
  onRepost,
  onDelete,
  onSendComment,
}: Props) => {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const isRepost = !!post.original;
  const displayName = isRepost ? post.original!.author_name : post.author_name;
  const displayUsername = isRepost ? post.original!.author_username : post.author_username;
  const displayAvatar = isRepost ? null : post.author_avatar;
  const displayContent = isRepost ? post.original!.content : post.content;
  const displayImage = post.image_url || post.original?.image_url;
  const displayTs = isRepost ? post.original!.created_at : post.created_at;

  const send = async () => {
    if (!draft.trim()) return;
    setSending(true);
    await onSendComment(draft.trim());
    setDraft("");
    setSending(false);
  };

  const AvatarBlock = (
    <Link
      to={displayUsername ? `/app/u/${displayUsername}` : "#"}
      className="shrink-0"
      aria-label={displayName}
      onClick={(e) => { if (!displayUsername) e.preventDefault(); }}
    >
      {post.is_ai && !isRepost ? (
        <div className="size-10 rounded-full bg-primary/15 flex items-center justify-center">
          <Sparkles className="size-5 text-primary" />
        </div>
      ) : (
        <Avatar className="size-10">
          {displayAvatar && <AvatarImage src={displayAvatar} alt={displayName} />}
          <AvatarFallback className="text-xs">{initialsOf(displayName)}</AvatarFallback>
        </Avatar>
      )}
    </Link>
  );

  return (
    <article className="px-4 py-3 border-b border-border/50 hover:bg-muted/20 transition-colors">
      {isRepost && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2 pl-12">
          <Repeat2 className="size-3" />
          <span>{post.author_name} репостнул</span>
        </div>
      )}

      <div className="flex gap-3">
        {/* Avatar column with vertical line when comments are open */}
        <div className="flex flex-col items-center shrink-0">
          {AvatarBlock}
          {isOpen && (comments.length > 0 || true) && (
            <div className="flex-1 w-px bg-border/60 mt-2 min-h-[20px]" />
          )}
        </div>

        {/* Content column */}
        <div className="flex-1 min-w-0">
          {/* Header: name · @username · time · ... */}
          <div className="flex items-baseline gap-1.5 text-sm">
            <Link
              to={displayUsername ? `/app/u/${displayUsername}` : "#"}
              className="font-semibold hover:underline truncate"
              onClick={(e) => { if (!displayUsername) e.preventDefault(); }}
            >
              {displayName}
            </Link>
            {displayUsername && (
              <Link
                to={`/app/u/${displayUsername}`}
                className="text-muted-foreground text-xs hover:underline truncate"
              >
                @{displayUsername}
              </Link>
            )}
            <span className="text-muted-foreground text-xs">·</span>
            <span className="text-muted-foreground text-xs shrink-0">{ago(displayTs)}</span>
            {post.category && post.category !== "наблюдение" && (
              <>
                <span className="text-muted-foreground text-xs">·</span>
                <span className="text-[10px] text-muted-foreground/70 mono">#{post.category}</span>
              </>
            )}
            {isMine && (
              <button
                onClick={onDelete}
                className="ml-auto text-muted-foreground hover:text-destructive shrink-0"
                aria-label="Удалить"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>

          {/* Repost quote (if user added their own) */}
          {post.repost_quote && (
            <p className="text-sm italic text-muted-foreground mt-1 flex gap-1.5">
              <Quote className="size-3.5 shrink-0 mt-0.5 opacity-50" />
              {post.repost_quote}
            </p>
          )}

          {/* Content */}
          <p className="text-[15px] leading-snug whitespace-pre-wrap mt-0.5 break-words">
            {displayContent}
          </p>

          {/* Image */}
          {displayImage && (
            <img
              src={displayImage}
              alt=""
              className="mt-2 rounded-2xl max-h-96 w-full object-cover border border-border/40"
              loading="lazy"
            />
          )}

          {/* Action row — Threads style: heart, comment, repost, share */}
          <div className="flex items-center gap-1 -ml-2 mt-2 text-muted-foreground">
            <button
              onClick={onToggleLike}
              className={cn(
                "flex items-center gap-1 px-2 py-1.5 rounded-full hover:bg-foreground/5 transition-colors text-xs",
                post.liked && "text-rose-500",
              )}
              aria-label="Нравится"
            >
              <Heart className={cn("size-[18px]", post.liked && "fill-current")} strokeWidth={1.6} />
              {post.likes > 0 && <span className="mono">{post.likes}</span>}
            </button>

            <button
              onClick={onToggleComments}
              className="flex items-center gap-1 px-2 py-1.5 rounded-full hover:bg-foreground/5 transition-colors text-xs"
              aria-label="Ответить"
            >
              <MessageCircle className="size-[18px]" strokeWidth={1.6} />
              {post.comments > 0 && <span className="mono">{post.comments}</span>}
            </button>

            {!isRepost && (
              <button
                onClick={onRepost}
                className="flex items-center gap-1 px-2 py-1.5 rounded-full hover:bg-foreground/5 transition-colors text-xs"
                aria-label="Репост"
              >
                <Repeat2 className="size-[18px]" strokeWidth={1.6} />
                {post.reposts > 0 && <span className="mono">{post.reposts}</span>}
              </button>
            )}

            <button
              onClick={() => {
                const url = `${window.location.origin}/app/u/${post.author_username || ""}`;
                navigator.clipboard?.writeText(url);
              }}
              className="flex items-center gap-1 px-2 py-1.5 rounded-full hover:bg-foreground/5 transition-colors text-xs"
              aria-label="Поделиться"
            >
              <Share className="size-[18px]" strokeWidth={1.6} />
            </button>
          </div>

          {/* Inline replies */}
          {isOpen && (
            <div className="mt-2 space-y-3">
              {comments.map((c) => (
                <div key={c.id} className="flex gap-2.5 pt-2">
                  <Link
                    to={c.author_username ? `/app/u/${c.author_username}` : "#"}
                    className="shrink-0"
                    onClick={(e) => { if (!c.author_username) e.preventDefault(); }}
                  >
                    <Avatar className="size-7">
                      {c.author_avatar && <AvatarImage src={c.author_avatar} alt={c.author_name} />}
                      <AvatarFallback className="text-[10px]">{initialsOf(c.author_name)}</AvatarFallback>
                    </Avatar>
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5 text-xs">
                      <Link
                        to={c.author_username ? `/app/u/${c.author_username}` : "#"}
                        className="font-semibold hover:underline truncate"
                        onClick={(e) => { if (!c.author_username) e.preventDefault(); }}
                      >
                        {c.author_name}
                      </Link>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground shrink-0">{ago(c.created_at)}</span>
                    </div>
                    <p className="text-sm leading-snug whitespace-pre-wrap mt-0.5">{c.content}</p>
                  </div>
                </div>
              ))}

              {/* Reply composer */}
              <div className="flex gap-2 items-end pt-1">
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Ответить…"
                  rows={1}
                  className="resize-none text-sm min-h-[36px] rounded-2xl"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                />
                <Button
                  size="sm"
                  onClick={send}
                  disabled={!draft.trim() || sending}
                  className="rounded-full shrink-0"
                >
                  Ответить
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
};
