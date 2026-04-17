import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Heart, MessageSquare, Sparkles } from "lucide-react";

interface Post {
  id: string;
  author: string;
  type?: string;
  ai?: boolean;
  ts: number;
  text: string;
  tags: string[];
  likes: number;
  comments: number;
  liked?: boolean;
}

const SEED: Post[] = [
  {
    id: "p1",
    author: "AI · Дилемма дня",
    ai: true,
    ts: Date.now() - 1000 * 60 * 30,
    text: "Друг постоянно отменяет встречи в последний момент. Сегодня снова — за час до. Сказать прямо «меня это бесит»? Молча отстраниться? Принять как есть, потому что «он такой»? Кто пидор?",
    tags: ["дилемма", "дружба"],
    likes: 124,
    comments: 38,
  },
  {
    id: "p2",
    author: "невидимый_кит",
    type: "интуит",
    ts: Date.now() - 1000 * 60 * 60 * 2,
    text: "Заметил странное: чем меньше я выкладываю в сторис, тем спокойнее. Это что, я взрослею или просто выгорел от перформанса?",
    tags: ["соцсети", "наблюдение"],
    likes: 47,
    comments: 12,
  },
  {
    id: "p3",
    author: "ольга_не_ольга",
    type: "стратег",
    ts: Date.now() - 1000 * 60 * 60 * 5,
    text: "Закрыла гештальт с мамой за 6 сессий с психологом и одну ночь рыданий в подушку. Без шуток — карта событий показала, что я 11 лет ходила по кругу одной и той же истории. Графа реально работает как зеркало.",
    tags: ["прорыв", "семья"],
    likes: 312,
    comments: 84,
  },
];

const Feed = () => {
  const [posts, setPosts] = useState<Post[]>(SEED);
  const [draft, setDraft] = useState("");

  const post = () => {
    if (!draft.trim()) return;
    setPosts((p) => [
      {
        id: crypto.randomUUID(),
        author: "ты",
        ts: Date.now(),
        text: draft,
        tags: [],
        likes: 0,
        comments: 0,
      },
      ...p,
    ]);
    setDraft("");
  };

  const toggleLike = (id: string) =>
    setPosts((p) =>
      p.map((x) =>
        x.id === id ? { ...x, liked: !x.liked, likes: x.likes + (x.liked ? -1 : 1) } : x,
      ),
    );

  const ago = (ts: number) => {
    const m = Math.round((Date.now() - ts) / 60000);
    if (m < 60) return `${m}м`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h}ч`;
    return `${Math.round(h / 24)}д`;
  };

  return (
    <>
      <PageHeader
        eyebrow="мини-соцсеть · текст важнее картинок"
        title="Лента"
        description="Дилеммы, мысли, рефлексии. Без подписок — только смыслы."
      />

      <Card className="glass p-4 mb-6">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Что у тебя сейчас в голове? Ситуация, дилемма, наблюдение…"
          rows={3}
        />
        <div className="flex justify-end mt-2">
          <Button onClick={post} disabled={!draft.trim()} className="">
            Опубликовать
          </Button>
        </div>
      </Card>

      <div className="space-y-3">
        {posts.map((p) => (
          <Card
            key={p.id}
            className={`p-5 ${p.ai ? "glass border-primary/40 bg-primary/5" : "glass"}`}
          >
            <div className="flex items-center gap-2 mb-3">
              {p.ai ? (
                <div className="size-7 rounded-full bg-primary/20 flex items-center justify-center">
                  <Sparkles className="size-4 text-primary" />
                </div>
              ) : (
                <div className="size-7 rounded-full bg-primary" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium flex items-center gap-2">
                  {p.author}
                  {p.type && (
                    <span className="text-[10px] mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {p.type}
                    </span>
                  )}
                </div>
                <div className="mono text-[10px] text-muted-foreground">{ago(p.ts)}</div>
              </div>
            </div>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{p.text}</p>
            {p.tags.length > 0 && (
              <div className="flex gap-2 mt-3">
                {p.tags.map((t) => (
                  <span key={t} className="text-[11px] text-primary/80">
                    #{t}
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border/40 text-xs text-muted-foreground">
              <button
                onClick={() => toggleLike(p.id)}
                className={`flex items-center gap-1.5 hover:text-foreground transition-colors ${
                  p.liked ? "text-tension" : ""
                }`}
              >
                <Heart className={`size-3.5 ${p.liked ? "fill-current" : ""}`} />
                {p.likes}
              </button>
              <button className="flex items-center gap-1.5 hover:text-foreground">
                <MessageSquare className="size-3.5" />
                {p.comments}
              </button>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
};

export default Feed;
