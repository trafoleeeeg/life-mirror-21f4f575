// Шапка профиля в Threads-стиле: имя, @username, био, счётчики, кнопка действия.
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { FollowButton } from "@/components/social/FollowButton";
import { FollowsList } from "@/components/social/FollowsList";
import { Button } from "@/components/ui/button";

interface Props {
  userId: string;
  displayName: string | null;
  username: string | null;
  bio: string | null;
  avatarUrl: string | null;
  isDemo?: boolean;
  isMe?: boolean;
  followers: number;
  followingCount: number;
}

const initialsOf = (s?: string | null) => (s || "??").slice(0, 2).toUpperCase();

export const ProfileHeader = ({
  userId, displayName, username, bio, avatarUrl, isDemo, isMe,
  followers, followingCount,
}: Props) => {
  const [followsOpen, setFollowsOpen] = useState<"followers" | "following" | null>(null);

  return (
    <div className="px-4 pt-5 pb-4 border-b border-border/50">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight truncate">{displayName || "Без имени"}</h1>
            {isDemo && <Badge variant="outline" className="text-[10px]">демо</Badge>}
          </div>
          {username && (
            <p className="text-sm text-muted-foreground mt-0.5">@{username}</p>
          )}
        </div>
        <Avatar className="size-16 shrink-0">
          {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName || ""} />}
          <AvatarFallback>{initialsOf(displayName)}</AvatarFallback>
        </Avatar>
      </div>

      {bio && (
        <p className="text-[15px] leading-snug whitespace-pre-wrap mb-3">{bio}</p>
      )}

      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
        <button
          onClick={() => setFollowsOpen("followers")}
          className="hover:underline"
        >
          <span className="font-semibold text-foreground">{followers}</span>{" "}
          подписчик{followers === 1 ? "" : followers >= 2 && followers <= 4 ? "а" : "ов"}
        </button>
        <span>·</span>
        <button
          onClick={() => setFollowsOpen("following")}
          className="hover:underline"
        >
          <span className="font-semibold text-foreground">{followingCount}</span>{" "}
          подписк{followingCount === 1 ? "а" : followingCount >= 2 && followingCount <= 4 ? "и" : "и"}
        </button>
      </div>

      <div className="flex gap-2">
        {isMe ? (
          <Button asChild size="sm" variant="outline" className="rounded-full flex-1">
            <Link to="/app/settings">Редактировать профиль</Link>
          </Button>
        ) : (
          <>
            <FollowButton targetUserId={userId} className="flex-1" />
            <Button asChild size="sm" variant="outline" className="rounded-full">
              <Link to="/app/dms">Сообщение</Link>
            </Button>
          </>
        )}
      </div>

      {followsOpen && (
        <FollowsList
          userId={userId}
          mode={followsOpen}
          onClose={() => setFollowsOpen(null)}
        />
      )}
    </div>
  );
};
