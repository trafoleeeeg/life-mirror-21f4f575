// Composer для ленты: текст + опциональная картинка.
import { useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ImagePlus, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

const initialsOf = (s?: string | null) => (s || "??").slice(0, 2).toUpperCase();

interface Props {
  myAvatar: string | null;
  myName: string;
}

export const PostComposer = ({ myAvatar, myName }: Props) => {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { toast.error("Файл больше 5 МБ"); return; }
    setImage(f);
    setPreview(URL.createObjectURL(f));
  };

  const clearImage = () => {
    setImage(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const publish = async () => {
    if (!user || (!draft.trim() && !image)) return;
    setPosting(true);
    let image_url: string | null = null;
    if (image) {
      const ext = image.name.split(".").pop() || "jpg";
      const path = `${user.id}/post-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("post-images")
        .upload(path, image, { cacheControl: "3600", upsert: false });
      if (upErr) {
        setPosting(false);
        toast.error(upErr.message);
        return;
      }
      image_url = supabase.storage.from("post-images").getPublicUrl(path).data.publicUrl;
    }
    const { error } = await supabase.from("posts").insert({
      user_id: user.id,
      content: draft.trim() || "",
      category: "наблюдение",
      image_url,
    });
    setPosting(false);
    if (error) { toast.error("Не удалось опубликовать"); return; }
    setDraft("");
    clearImage();
    toast.success("Опубликовано");
  };

  if (!user) return null;

  return (
    <div className="px-4 py-3 border-b border-border/50 flex gap-3">
      <Avatar className="size-10 shrink-0">
        {myAvatar && <AvatarImage src={myAvatar} alt={myName} />}
        <AvatarFallback className="text-xs">{initialsOf(myName || user.email)}</AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Что нового?"
          rows={1}
          className="resize-none border-0 px-0 py-1 text-[15px] focus-visible:ring-0 shadow-none min-h-[40px] bg-transparent"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void publish();
            }
          }}
        />

        {preview && (
          <div className="relative mt-2 inline-block">
            <img src={preview} alt="preview" className="max-h-64 rounded-2xl border border-border/40" />
            <button
              onClick={clearImage}
              className="absolute top-1.5 right-1.5 size-7 rounded-full bg-background/90 border border-border grid place-items-center hover:bg-background"
              aria-label="Убрать"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}

        <div className="flex justify-between items-center mt-1">
          <div className="flex items-center gap-1">
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPick} />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => fileRef.current?.click()}
              className="rounded-full size-8 text-muted-foreground hover:text-foreground"
              aria-label="Прикрепить картинку"
            >
              <ImagePlus className="size-[18px]" />
            </Button>
            {draft.length > 0 && (
              <span className="text-xs text-muted-foreground ml-1">{draft.length}</span>
            )}
          </div>
          <Button
            onClick={publish}
            disabled={(!draft.trim() && !image) || posting}
            size="sm"
            className="rounded-full"
          >
            {posting ? <Loader2 className="size-3.5 animate-spin" /> : "Запостить"}
          </Button>
        </div>
      </div>
    </div>
  );
};
