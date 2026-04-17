// Лента — мини-соцсеть смыслов. Тексты важнее картинок.
// Пока без бэкенда: локальный seed + черновик в стейте.
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Heart, MessageSquare, Sparkles, Filter, Bookmark, Share2, Flame,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  saved?: boolean;
  category: "дилемма" | "наблюдение" | "прорыв" | "вопрос" | "практика";
}

const M = 60_000;
const H = 60 * M;
const D = 24 * H;

const SEED: Post[] = [
  {
    id: "p1",
    author: "AI · Дилемма дня",
    ai: true,
    ts: Date.now() - 30 * M,
    category: "дилемма",
    text: "Друг постоянно отменяет встречи в последний момент. Сегодня снова — за час до. Сказать прямо «меня это бесит»? Молча отстраниться? Принять как есть, потому что «он такой»? Что ты выберешь — и почему именно это?",
    tags: ["дружба", "границы", "коммуникация"],
    likes: 124,
    comments: 38,
  },
  {
    id: "p2",
    author: "невидимый_кит",
    type: "интуит",
    ts: Date.now() - 2 * H,
    category: "наблюдение",
    text: "Заметил странное: чем меньше я выкладываю в сторис, тем спокойнее. Это что — я взрослею, или просто выгорел от перформанса? Кажется, разница в том, что раньше мне был важен факт «меня видят», а теперь — «я сам себя вижу».",
    tags: ["соцсети", "выгорание"],
    likes: 47,
    comments: 12,
  },
  {
    id: "p3",
    author: "ольга_не_ольга",
    type: "стратег",
    ts: Date.now() - 5 * H,
    category: "прорыв",
    text: "Закрыла гештальт с мамой за 6 сессий с психологом и одну ночь рыданий в подушку. Без шуток — карта событий показала, что я 11 лет ходила по кругу одной и той же истории. Графа реально работает как зеркало: ты не можешь спорить с собственными данными.",
    tags: ["прорыв", "семья", "терапия"],
    likes: 312,
    comments: 84,
  },
  {
    id: "p4",
    author: "AI · Практика недели",
    ai: true,
    ts: Date.now() - 7 * H,
    category: "практика",
    text: "Попробуй на этой неделе: каждый вечер 3 минуты записывай в чек-ин одну фразу — «что сегодня меня удивило». Не «что я сделал», не «что было хорошо», а именно — удивило. Через 7 дней посмотри список. Часто там — настоящие потребности, которые ты обычно игнорируешь.",
    tags: ["упражнение", "осознанность"],
    likes: 198,
    comments: 26,
  },
  {
    id: "p5",
    author: "костя_паттерн",
    type: "наблюдатель",
    ts: Date.now() - 11 * H,
    category: "наблюдение",
    text: "Третью неделю замечаю: после звонков с N. mood падает на 2 балла стабильно. До этого думал — ну, бывает, неудачные дни. Но граф не врёт. Теперь вопрос: что делать с тем, что отношения, которые казались близкими — на деле истощают?",
    tags: ["отношения", "паттерн", "энергия"],
    likes: 89,
    comments: 41,
  },
  {
    id: "p6",
    author: "марина.txt",
    type: "стратег",
    ts: Date.now() - 1 * D,
    category: "вопрос",
    text: "Вопрос в зал: как вы отличаете «лень» от «нужно отдохнуть»? У меня всё мешается в одну кучу: сижу, ничего не делаю, ругаю себя за лень, потом узнаю что это была усталость, потом расслабляюсь — и снова не могу понять, отдых это или прокрастинация.",
    tags: ["самоощущение", "энергия"],
    likes: 156,
    comments: 73,
  },
  {
    id: "p7",
    author: "AI · Дилемма дня",
    ai: true,
    ts: Date.now() - 1 * D - 3 * H,
    category: "дилемма",
    text: "Тебе предлагают повышение: больше денег, больше ответственности, меньше свободного времени. Текущая работа — комфортно, но ты её перерос. Чем ты руководствуешься в таком выборе — деньгами, страхом застрять, азартом, мнением близких? Что для тебя сейчас «весит» больше всего?",
    tags: ["карьера", "выбор"],
    likes: 211,
    comments: 95,
  },
  {
    id: "p8",
    author: "тёмный_кофе",
    type: "интуит",
    ts: Date.now() - 1 * D - 8 * H,
    category: "прорыв",
    text: "Понял через приложение: я не «сова», я просто избегаю утренней тревоги через залипание ночью. Ложился в 3 — потому что сон = снова утро = снова страх. Сейчас работаю с этим — впервые за годы. И всё началось с одной строчки в чек-ине: «не хочу завтра».",
    tags: ["сон", "тревога", "осознание"],
    likes: 267,
    comments: 52,
  },
  {
    id: "p9",
    author: "мирра",
    type: "наблюдатель",
    ts: Date.now() - 2 * D,
    category: "наблюдение",
    text: "Странное: в дни, когда я гуляю одна 30+ минут — mood стабильно +1.5. Без музыки, без подкастов. Просто иду. Раньше думала, нужны разговоры с близкими, чтобы «зарядиться». Оказалось, нужна тишина с собой.",
    tags: ["прогулки", "одиночество"],
    likes: 102,
    comments: 18,
  },
  {
    id: "p10",
    author: "AI · Зеркало",
    ai: true,
    ts: Date.now() - 2 * D - 5 * H,
    category: "вопрос",
    text: "Если бы тебе сегодня позвонил ты сам — из 5 лет назад — и спросил «как мы там?», что бы ты ответил? Не идеализированно, не пессимистично. Честно — одной фразой.",
    tags: ["рефлексия", "идентичность"],
    likes: 388,
    comments: 142,
  },
  {
    id: "p11",
    author: "даня_перерос",
    type: "стратег",
    ts: Date.now() - 3 * D,
    category: "практика",
    text: "Лайфхак, который реально работает у меня уже 2 месяца: перед сложным разговором — пишу в заметках 3 фразы «что я хочу сказать», 3 фразы «чего я боюсь услышать» и 1 фразу «что будет, если разговор провалится». Тревога падает в разы, потому что мозг видит реальный масштаб, а не катастрофу.",
    tags: ["коммуникация", "тревога", "практика"],
    likes: 421,
    comments: 67,
  },
  {
    id: "p12",
    author: "лиса_шипит",
    ts: Date.now() - 4 * D,
    category: "вопрос",
    text: "У кого-то ещё бывает так, что вы устаёте от хороших новостей сильнее, чем от плохих? Радостное событие — и неделю восстановления. Это норма или что-то со мной не так?",
    tags: ["энергия", "интроверсия"],
    likes: 73,
    comments: 29,
  },
];

const CATEGORIES = ["все", "дилемма", "наблюдение", "прорыв", "вопрос", "практика"] as const;
type Cat = typeof CATEGORIES[number];

const CAT_TONE: Record<Post["category"], string> = {
  дилемма: "var(--stat-emotions)",
  наблюдение: "var(--ring-exercise)",
  прорыв: "var(--primary)",
  вопрос: "var(--stat-mind)",
  практика: "var(--ring-meaning)",
};

const ago = (ts: number) => {
  const m = Math.round((Date.now() - ts) / M);
  if (m < 1) return "только что";
  if (m < 60) return `${m}м`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}ч`;
  const d = Math.round(h / 24);
  return `${d}д`;
};

const Feed = () => {
  const [posts, setPosts] = useState<Post[]>(SEED);
  const [draft, setDraft] = useState("");
  const [filter, setFilter] = useState<Cat>("все");
  const [sort, setSort] = useState<"hot" | "fresh">("hot");

  const visible = useMemo(() => {
    const filtered = filter === "все" ? posts : posts.filter((p) => p.category === filter);
    if (sort === "fresh") return [...filtered].sort((a, b) => b.ts - a.ts);
    // hot = (likes + comments*2) / возраст в часах^0.6
    return [...filtered].sort((a, b) => {
      const ha = Math.max(0.5, (Date.now() - a.ts) / H);
      const hb = Math.max(0.5, (Date.now() - b.ts) / H);
      const sa = (a.likes + a.comments * 2) / Math.pow(ha, 0.6);
      const sb = (b.likes + b.comments * 2) / Math.pow(hb, 0.6);
      return sb - sa;
    });
  }, [posts, filter, sort]);

  const post = () => {
    if (!draft.trim()) return;
    setPosts((p) => [
      {
        id: crypto.randomUUID(),
        author: "ты",
        ts: Date.now(),
        text: draft.trim(),
        tags: [],
        likes: 0,
        comments: 0,
        category: "наблюдение",
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

  const toggleSave = (id: string) =>
    setPosts((p) => p.map((x) => (x.id === id ? { ...x, saved: !x.saved } : x)));

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
        <div className="flex justify-between items-center mt-2 gap-2">
          <span className="text-[11px] text-muted-foreground">
            Без лайков-фабрик · только текст
          </span>
          <Button onClick={post} disabled={!draft.trim()} size="sm" className="rounded-full">
            Опубликовать
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

      <div className="space-y-3">
        {visible.map((p) => {
          const tone = CAT_TONE[p.category];
          return (
            <Card
              key={p.id}
              className={cn(
                "ios-card p-5 transition-shadow hover:shadow-md",
                p.ai && "border-primary/40",
              )}
              style={p.ai ? { background: "hsl(var(--primary) / 0.04)" } : undefined}
            >
              <div className="flex items-center gap-2 mb-3">
                {p.ai ? (
                  <div className="size-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <Sparkles className="size-4 text-primary" />
                  </div>
                ) : (
                  <div
                    className="size-8 rounded-full shrink-0"
                    style={{ background: `hsl(${tone} / 0.7)` }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium flex items-center gap-2 flex-wrap">
                    {p.author}
                    {p.type && (
                      <span className="text-[10px] mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {p.type}
                      </span>
                    )}
                  </div>
                  <div className="mono text-[10px] text-muted-foreground">{ago(p.ts)}</div>
                </div>
                <Badge
                  variant="outline"
                  className="text-[10px] py-0 px-1.5 shrink-0"
                  style={{ borderColor: `hsl(${tone} / 0.4)`, color: `hsl(${tone})` }}
                >
                  {p.category}
                </Badge>
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{p.text}</p>
              {p.tags.length > 0 && (
                <div className="flex gap-2 mt-3 flex-wrap">
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
                  className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                  style={p.liked ? { color: "hsl(var(--stat-emotions))" } : undefined}
                >
                  <Heart className={cn("size-3.5", p.liked && "fill-current")} />
                  {p.likes}
                </button>
                <button className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                  <MessageSquare className="size-3.5" />
                  {p.comments}
                </button>
                <button
                  onClick={() => toggleSave(p.id)}
                  className={cn(
                    "ml-auto flex items-center gap-1.5 hover:text-foreground transition-colors",
                    p.saved && "text-primary",
                  )}
                >
                  <Bookmark className={cn("size-3.5", p.saved && "fill-current")} />
                </button>
                <button className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                  <Share2 className="size-3.5" />
                </button>
              </div>
            </Card>
          );
        })}
        {visible.length === 0 && (
          <Card className="ios-card p-8 text-center text-sm text-muted-foreground">
            В этой категории пока пусто. Напиши что-нибудь сам.
          </Card>
        )}
      </div>
    </>
  );
};

export default Feed;
