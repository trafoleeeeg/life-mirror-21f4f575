// /app/me — мой профиль в Threads-стиле + инлайн-редактирование (имя, @, био, аватар).
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { ProfileHeader } from "@/components/social/ProfileHeader";
import { ProfileTabs } from "@/components/social/ProfileTabs";
import { UserThreads } from "@/components/feed/UserThreads";
import { Loader2, Camera, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";

interface ProfileRow {
  user_id: string;
  display_name: string | null;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_demo: boolean;
}

const initialsOf = (s?: string | null) => (s || "??").slice(0, 2).toUpperCase();

const Me = () => {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"threads" | "replies" | "reposts">("threads");
  const [followers, setFollowers] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const loadCounts = async (uid: string) => {
    const [{ count: f1 }, { count: f2 }] = await Promise.all([
      supabase.from("follows").select("id", { count: "exact", head: true }).eq("followee_id", uid),
      supabase.from("follows").select("id", { count: "exact", head: true }).eq("follower_id", uid),
    ]);
    setFollowers(f1 || 0);
    setFollowingCount(f2 || 0);
  };

  useEffect(() => {
    if (!user) return;
    void (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("profiles")
        .select("user_id,display_name,username,bio,avatar_url,is_demo")
        .eq("user_id", user.id)
        .maybeSingle();
      const p = data as ProfileRow | null;
      setProfile(p);
      if (p) {
        setName(p.display_name || "");
        setUsername(p.username || "");
        setBio(p.bio || "");
      }
      await loadCounts(user.id);
      setLoading(false);
    })();

    const ch = supabase
      .channel(`me-follows-${user.id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "follows" },
        () => { void loadCounts(user.id); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  const onAvatarPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Файл больше 5 МБ"); return; }
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("avatars").upload(path, file, { cacheControl: "3600", upsert: false });
    if (upErr) { setUploading(false); toast.error(upErr.message); return; }
    const url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
    await supabase.from("profiles").update({ avatar_url: url }).eq("user_id", user.id);
    setProfile((prev) => prev ? { ...prev, avatar_url: url } : prev);
    setUploading(false);
    toast.success("Аватар обновлён");
  };

  const save = async () => {
    if (!user) return;
    const u = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (u && (u.length < 3 || u.length > 24)) {
      toast.error("Никнейм 3–24 символа: латиница, цифры, _"); return;
    }
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      display_name: name.trim() || null,
      username: u || null,
      bio: bio.trim() || null,
    }).eq("user_id", user.id);
    setSaving(false);
    if (error) {
      if (String(error.message).includes("duplicate") || String(error.message).includes("unique")) {
        toast.error("Этот никнейм уже занят");
      } else toast.error(error.message);
      return;
    }
    setProfile((prev) => prev ? {
      ...prev,
      display_name: name.trim() || null,
      username: u || null,
      bio: bio.trim() || null,
    } : prev);
    setUsername(u);
    setEditing(false);
    toast.success("Сохранено");
  };

  const cancel = () => {
    if (!profile) return;
    setName(profile.display_name || "");
    setUsername(profile.username || "");
    setBio(profile.bio || "");
    setEditing(false);
  };

  if (loading) {
    return <div className="p-8 text-center"><Loader2 className="size-4 animate-spin mx-auto" /></div>;
  }
  if (!profile || !user) return null;

  return (
    <div className="-mx-4 md:-mx-8 -my-4 md:-my-10 max-w-[640px] mx-auto md:mx-auto">
      {editing ? (
        <div className="px-4 pt-5 pb-4 border-b border-border/50 space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="size-20">
                {profile.avatar_url && <AvatarImage src={profile.avatar_url} alt={name} />}
                <AvatarFallback>{initialsOf(name)}</AvatarFallback>
              </Avatar>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={onAvatarPick} />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-1 -right-1 size-8 rounded-full bg-primary text-primary-foreground grid place-items-center border-2 border-background"
                aria-label="Сменить фото"
              >
                {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
              </button>
            </div>
            <div className="flex-1 min-w-0">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Имя"
                className="text-lg font-bold h-10 rounded-xl"
              />
              <div className="flex items-center gap-1.5 mt-2">
                <span className="text-muted-foreground text-sm">@</span>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="my_handle"
                  maxLength={24}
                  className="h-9 rounded-xl flex-1 text-sm"
                />
              </div>
            </div>
          </div>

          <Textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Коротко о тебе…"
            rows={3}
            maxLength={160}
            className="resize-none rounded-xl"
          />
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">{bio.length}/160</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={cancel} className="rounded-full">
                <X className="size-3.5 mr-1" />Отмена
              </Button>
              <Button size="sm" onClick={save} disabled={saving} className="rounded-full">
                <Check className="size-3.5 mr-1" />
                {saving ? "Сохраняю…" : "Сохранить"}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div onClick={() => setEditing(true)} className="cursor-pointer hover:bg-muted/10 transition-colors">
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
        </div>
      )}

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
