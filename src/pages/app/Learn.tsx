// Знания в стиле Duolingo: сетка маленьких карточек.
// Изученные подсвечиваются зелёным с галочкой; неизученные — мягкие.
// Тап → попап с полным контентом и кнопкой «Отметить изученным».
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Brain, Heart, Sparkles, BookOpen, Anchor, Compass, Wind, Network, Sunrise,
  CheckCircle2, Lock, Clock, Target, Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

interface Item { title: string; detail: string }
interface Section {
  slug: string;
  icon: typeof Brain;
  title: string;
  short: string;
  desc: string;
  whenToUse: string;
  duration: string;
  items: Item[];
  exercise: { title: string; steps: string[] };
  tone: string;
}

const SECTIONS: Section[] = [
  {
    icon: Brain, slug: "cbt",
    title: "CBT",
    short: "Мысль → эмоция → действие",
    desc: "Как мысли формируют эмоции, а эмоции — поведение. И как разорвать круг автоматических искажений.",
    whenToUse: "Тревога, самокритика, перфекционизм, страх неудачи",
    duration: "5–10 мин в день",
    tone: "var(--stat-mind)",
    items: [
      { title: "10 когнитивных искажений", detail: "Чёрно-белое мышление, чтение мыслей, катастрофизация, обесценивание позитива, долженствование и др." },
      { title: "ABC-модель", detail: "A — событие, B — мысль о нём, C — эмоция/действие. Между A и C всегда есть B, и именно её можно менять." },
      { title: "Сократический диалог", detail: "5 вопросов, которые вытаскивают факты из эмоций: какие доказательства? что бы я сказал другу? как буду думать через год?" },
      { title: "Поведенческая активация", detail: "При апатии — не ждать «когда захочется», а делать маленькое действие первым. Эмоция приходит за движением." },
    ],
    exercise: { title: "Дневник мыслей (3 колонки)", steps: [
      "Запиши ситуацию максимально нейтрально (без оценок).",
      "Запиши автоматическую мысль и эмоцию (% интенсивности).",
      "Найди искажение → сформулируй более сбалансированную мысль и переоцени эмоцию.",
    ]},
  },
  {
    icon: Heart, slug: "ifs",
    title: "IFS",
    short: "Внутри тебя — команда",
    desc: "Внутри каждого живут «части»: критик, защитник, испуганный ребёнок. IFS учит не воевать с ними, а слушать.",
    whenToUse: "Внутренний конфликт, самокритика, саботаж",
    duration: "10–20 мин",
    tone: "var(--stat-emotions)",
    items: [
      { title: "3 типа частей", detail: "Изгнанники (раненые) · защитники (менеджеры контроля) · пожарные (экстренная помощь: алкоголь, переедание, прокрастинация)." },
      { title: "Self — ядро", detail: "Спокойное любопытное «Я», из которого можно говорить со всеми частями. Признаки: curiosity, calm, compassion, courage, clarity, confidence, creativity, connectedness." },
      { title: "Unblending", detail: "Когда тебя «накрывает» — это часть слилась с Self. Спроси: «кто во мне сейчас говорит?» Уже это создаёт зазор." },
      { title: "Без врагов внутри", detail: "Даже самый деструктивный паттерн — попытка защитить. Понять, от чего, — путь к освобождению, а не подавлению." },
    ],
    exercise: { title: "Знакомство с критиком", steps: [
      "Закрой глаза. Вспомни ситуацию, где включается внутренний критик.",
      "Заметь его — где он в теле? как звучит? сколько ему лет?",
      "Спроси: «От чего ты меня защищаешь?» — и просто слушай ответ, не споря.",
    ]},
  },
  {
    icon: Sparkles, slug: "mindfulness",
    title: "Осознанность",
    short: "Возвращение к себе",
    desc: "Не медитация ради медитации. Способность замечать «что со мной сейчас» без оценки — основа всего остального.",
    whenToUse: "Залипание в мыслях, реактивность, суматоха в голове",
    duration: "1–10 мин, много раз в день",
    tone: "var(--ring-stand)",
    items: [
      { title: "Якорь дыхания", detail: "3 цикла осознанного вдоха-выдоха = ресет внимания. Доступно везде: в очереди, в лифте, перед звонком." },
      { title: "Сканирование тела", detail: "От стоп до макушки — где напряжение? тепло? холод? Не менять — просто заметить." },
      { title: "STOP-техника", detail: "Stop · Take a breath · Observe (тело, мысли, эмоции) · Proceed. 30 секунд, спасает от автопилота." },
      { title: "Мысли как облака", detail: "Ты не мысль, ты — небо, в котором она проплывает. Не нужно её прогонять — нужно перестать с ней отождествляться." },
    ],
    exercise: { title: "Дыхание 4-7-8", steps: [
      "Вдох носом — 4 счёта.",
      "Задержка — 7 счётов.",
      "Медленный выдох ртом — 8 счётов. Повтори 4 цикла.",
    ]},
  },
  {
    icon: Compass, slug: "act",
    title: "ACT",
    short: "Действовать в сторону ценностей",
    desc: "Цель — не «избавиться от боли», а двигаться в сторону того, что важно, даже когда болит.",
    whenToUse: "Хроническая тревога, избегание, застревание",
    duration: "регулярная практика",
    tone: "var(--ring-exercise)",
    items: [
      { title: "Когнитивный дефьюжен", detail: "«У меня мысль, что я неудачник» вместо «я неудачник». Мысли — события в голове, а не правда о тебе." },
      { title: "Готовность принимать", detail: "Не любить боль, а перестать тратить силы на борьбу с тем, что нельзя устранить." },
      { title: "Контакт с настоящим", detail: "Большая часть страданий — в прошлом или будущем. Сейчас, в этот момент, чаще всего — терпимо." },
      { title: "Ценности vs цели", detail: "Цель — финиш. Ценность — направление. «Здоровье» — ценность, «10 кг» — цель." },
    ],
    exercise: { title: "Карта ценностей за 10 минут", steps: [
      "Выпиши 4 области: отношения, работа, тело, рост.",
      "В каждой — одно слово-ценность (например, «близость», «мастерство»).",
      "Одно действие на этой неделе, которое соответствует каждой ценности.",
    ]},
  },
  {
    icon: Anchor, slug: "attachment",
    title: "Привязанность",
    short: "Как мы любим — и почему",
    desc: "Стиль привязанности формируется в детстве и определяет, как ты ведёшь себя в близких отношениях.",
    whenToUse: "Сложности в отношениях, ревность, цикл «push-pull»",
    duration: "разовое исследование + практика",
    tone: "var(--stat-relationships)",
    items: [
      { title: "Безопасный", detail: "Комфортно близко, комфортно врозь. Партнёр — не источник тревоги, а ресурс. Около 50% людей." },
      { title: "Тревожный", detail: "Постоянная потребность в подтверждении любви, страх быть брошенным, гипер-чувствительность к дистанции." },
      { title: "Избегающий", detail: "Близость = угроза автономии. При сближении хочется отдалиться, при отдалении — снова приблизиться." },
      { title: "Earned secure", detail: "Безопасный стиль — не приговор. Можно «заработать» через осознание и опыт стабильных отношений (включая с собой)." },
    ],
    exercise: { title: "Карта триггеров близости", steps: [
      "Вспомни 3 ситуации, когда тебя «накрыло» в отношениях.",
      "Что было общим? (молчание партнёра? отказ? чрезмерная близость?)",
      "Какая детская история стоит за этим? Просто заметь — без выводов.",
    ]},
  },
  {
    icon: Wind, slug: "nervous-system",
    title: "Нервная система",
    short: "Тело первым, мысли потом",
    desc: "Когда нервная система в активации — никакая «работа с мыслями» не работает. Сначала телесное успокоение.",
    whenToUse: "Паника, гнев, диссоциация, бессонница",
    duration: "1–5 мин экстренно",
    tone: "var(--stat-body)",
    items: [
      { title: "3 состояния НС", detail: "Социальное вовлечение · мобилизация · замирание. Цель — вернуться в первое." },
      { title: "Вагус-нерв", detail: "Стимулируется через медленный выдох, холод на лице, напевание, гудение. Это не эзотерика — это физиология." },
      { title: "Окно толерантности", detail: "Зона, где ты можешь думать и чувствовать одновременно. За её пределами — либо реакция, либо ступор." },
      { title: "Заземление 5-4-3-2-1", detail: "5 вещей, что видишь · 4 что слышишь · 3 что чувствуешь телом · 2 запаха · 1 вкус. Возврат в «здесь»." },
    ],
    exercise: { title: "Длинный выдох", steps: [
      "Вдох 4 счёта через нос.",
      "Выдох 8 счётов через сжатые губы (как через трубочку).",
      "5 циклов. Парасимпатика активируется — пульс замедляется автоматически.",
    ]},
  },
  {
    icon: Network, slug: "systems",
    title: "Системное мышление",
    short: "Проблема — паттерн, а не человек",
    desc: "В любых отношениях повторяющийся конфликт — не «вина» одного. Это танец двух.",
    whenToUse: "Повторяющиеся конфликты, созависимость",
    duration: "наблюдение + эксперимент",
    tone: "var(--stat-career)",
    items: [
      { title: "Идентифицированный пациент", detail: "Тот, у кого «симптом» — часто несёт боль всей системы. Лечить нужно систему." },
      { title: "Триангуляция", detail: "Когда напряжение между двоими сбрасывается на третьего: ребёнка, друга, работу, болезнь." },
      { title: "Дифференциация", detail: "Способность оставаться собой в близости. Не сливаться, но и не убегать." },
      { title: "Эксперимент малого изменения", detail: "Измени одну реакцию (вместо защиты — пауза). Система отзовётся." },
    ],
    exercise: { title: "Карта повторяющегося конфликта", steps: [
      "Опиши последние 3 конфликта по схеме: триггер → твоя реакция → его реакция → исход.",
      "Найди общий паттерн (это будет «танец»).",
      "Придумай один шаг, который ты можешь сделать иначе в следующий раз.",
    ]},
  },
  {
    icon: Sunrise, slug: "sleep",
    title: "Гигиена сна",
    short: "Сон — это база",
    desc: "Большая часть «эмоциональных» проблем после плохого сна — это не личность, это нейрохимия.",
    whenToUse: "Плохое настроение без причины, тревожность, «туман в голове»",
    duration: "образ жизни",
    tone: "var(--stat-emotions)",
    items: [
      { title: "Утренний свет", detail: "10–20 мин дневного света в первый час после пробуждения. Запускает циркадные часы." },
      { title: "Температурное окно", detail: "Тело засыпает при понижении температуры. Спальня 18–20°C, душ за 1.5 часа до сна." },
      { title: "Кофеин — до 14:00", detail: "Период полураспада 5–7 часов. Чашка в 16:00 = ¼ дозы в крови в 22:00." },
      { title: "Окно сна, а не время", detail: "Просыпайся в одно и то же время даже на выходных. Это важнее, чем «во сколько лёг»." },
    ],
    exercise: { title: "Правило 90 минут", steps: [
      "За 90 минут до сна — выключи яркий свет.",
      "За 60 минут — последний экран (или включи max night-mode).",
      "За 30 минут — тёплый душ или растяжка.",
    ]},
  },
  {
    icon: BookOpen, slug: "values",
    title: "Идентичность и ценности",
    short: "Что из этого моё?",
    desc: "Большая часть «должно быть» — усвоено: из семьи, школы, культуры. Различить «своё» и «чужое» — отдельная работа.",
    whenToUse: "Кризис «зачем», ощущение «не моя жизнь», выгорание",
    duration: "глубокая разовая работа",
    tone: "var(--stat-meaning)",
    items: [
      { title: "Колесо ценностей", detail: "8–10 областей жизни. Оцени важность 1–10 и удовлетворённость 1–10. Где разрыв >3 — там зона работы." },
      { title: "Жизненные роли", detail: "Каждый из нас играет 5–8 ролей (партнёр, родитель, специалист, друг…)." },
      { title: "Автобиография на 1 страницу", detail: "Напиши историю своей жизни так, будто это книга. Какой жанр? кто герой?" },
      { title: "Письмо себе через 10 лет", detail: "От кого ты — себе будущему. Часто там — настоящие ценности." },
    ],
    exercise: { title: "Тест «5 раз почему»", steps: [
      "Возьми любую цель («хочу X»).",
      "Спроси: «зачем это?» — и так 5 раз подряд.",
      "На 4–5 уровне обычно проявляется настоящая ценность.",
    ]},
  },
];

const Learn = () => {
  const { user } = useAuth();
  const [learned, setLearned] = useState<Set<string>>(new Set());
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await supabase
        .from("learn_progress")
        .select("section_slug")
        .eq("user_id", user.id);
      setLearned(new Set((data ?? []).map((d) => d.section_slug)));
    })();
  }, [user]);

  // Deep-link from chat: /app/learn#cbt opens that card
  useEffect(() => {
    const applyHash = () => {
      const slug = window.location.hash.replace(/^#/, "");
      if (slug && SECTIONS.some((s) => s.slug === slug)) setOpenSlug(slug);
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);

  const current = useMemo(
    () => SECTIONS.find((s) => s.slug === openSlug) ?? null,
    [openSlug],
  );

  const toggleLearned = async (slug: string) => {
    if (!user) return;
    setBusy(true);
    if (learned.has(slug)) {
      await supabase.from("learn_progress")
        .delete().eq("user_id", user.id).eq("section_slug", slug);
      const next = new Set(learned); next.delete(slug); setLearned(next);
      toast("Снято");
    } else {
      await supabase.from("learn_progress")
        .insert({ user_id: user.id, section_slug: slug });
      const next = new Set(learned); next.add(slug); setLearned(next);
      toast.success("Изучено!");
    }
    setBusy(false);
  };

  const total = SECTIONS.length;
  const done = learned.size;
  const pct = Math.round((done / total) * 100);

  return (
    <>
      <PageHeader
        eyebrow="опора, а не догма"
        title="Знания"
        description="Конспекты подходов, на которых стоит работа AI-психолога. Открывай карточки, изучай, отмечай пройденные."
      />

      {/* Progress */}
      <Card className="ios-card p-4 mb-4 flex items-center gap-4 animate-fade-in">
        <div
          className="size-12 rounded-full flex items-center justify-center shrink-0"
          style={{ background: "hsl(var(--stat-finance) / 0.15)", color: "hsl(var(--stat-finance))" }}
        >
          <Trophy className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2 mb-1.5">
            <p className="text-sm font-semibold">
              Изучено {done} из {total}
            </p>
            <p className="mono text-xs text-muted-foreground">{pct}%</p>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${pct}%`,
                background: "linear-gradient(90deg, hsl(var(--stat-finance) / 0.6), hsl(var(--stat-finance)))",
              }}
            />
          </div>
        </div>
      </Card>

      {/* Card grid (Duolingo-like) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          const isDone = learned.has(s.slug);
          return (
            <button
              key={s.slug}
              onClick={() => setOpenSlug(s.slug)}
              className={cn(
                "relative aspect-square rounded-2xl p-3 flex flex-col items-center justify-center text-center gap-2 border transition-all hover:scale-[1.03] active:scale-[0.97]",
                isDone
                  ? "border-transparent"
                  : "border-border/50 bg-card hover:border-primary/40",
              )}
              style={
                isDone
                  ? {
                      background:
                        "linear-gradient(135deg, hsl(var(--stat-finance) / 0.18), hsl(var(--stat-finance) / 0.06))",
                      borderColor: "hsl(var(--stat-finance) / 0.4)",
                    }
                  : undefined
              }
            >
              {isDone && (
                <div className="absolute top-1.5 right-1.5">
                  <CheckCircle2 className="size-4" style={{ color: "hsl(var(--stat-finance))" }} />
                </div>
              )}
              <div
                className="size-11 rounded-xl flex items-center justify-center"
                style={{
                  background: isDone
                    ? "hsl(var(--stat-finance) / 0.2)"
                    : `hsl(${s.tone} / 0.15)`,
                  color: isDone ? "hsl(var(--stat-finance))" : `hsl(${s.tone})`,
                }}
              >
                <Icon className="size-5" />
              </div>
              <p className="text-xs font-semibold leading-tight line-clamp-2">{s.title}</p>
              <p className="text-[10px] text-muted-foreground line-clamp-2 leading-tight">
                {s.short}
              </p>
            </button>
          );
        })}
      </div>

      <Dialog open={!!current} onOpenChange={(v) => !v && setOpenSlug(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {current && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className="size-11 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `hsl(${current.tone} / 0.15)`, color: `hsl(${current.tone})` }}
                  >
                    <current.icon className="size-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <DialogTitle className="text-left">{current.title}</DialogTitle>
                    <p className="text-xs mt-0.5" style={{ color: `hsl(${current.tone})` }}>
                      {current.short}
                    </p>
                  </div>
                </div>
              </DialogHeader>

              <p className="text-sm text-muted-foreground leading-relaxed">{current.desc}</p>

              <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <Target className="size-3" /> {current.whenToUse}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="size-3" /> {current.duration}
                </span>
              </div>

              <div className="space-y-3 mt-2">
                <p className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  ключевые идеи
                </p>
                <ul className="space-y-2.5">
                  {current.items.map((it) => (
                    <li key={it.title} className="text-sm">
                      <span className="font-medium">{it.title}</span>
                      <span className="text-muted-foreground"> — {it.detail}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div
                className="rounded-xl p-3.5 border mt-1"
                style={{
                  background: `hsl(${current.tone} / 0.06)`,
                  borderColor: `hsl(${current.tone} / 0.25)`,
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Badge
                    variant="outline"
                    className="text-[10px] py-0 px-1.5"
                    style={{ borderColor: `hsl(${current.tone} / 0.5)`, color: `hsl(${current.tone})` }}
                  >
                    упражнение
                  </Badge>
                  <span className="text-sm font-semibold">{current.exercise.title}</span>
                </div>
                <ol className="space-y-1.5 text-sm text-muted-foreground list-decimal list-inside">
                  {current.exercise.steps.map((step, idx) => (
                    <li key={idx} className="leading-relaxed">{step}</li>
                  ))}
                </ol>
              </div>

              <Button
                onClick={() => toggleLearned(current.slug)}
                disabled={busy}
                className="w-full rounded-full mt-2"
                variant={learned.has(current.slug) ? "outline" : "default"}
              >
                {learned.has(current.slug) ? (
                  <>
                    <Lock className="size-4 mr-1.5" />
                    Снять отметку «Изучено»
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-4 mr-1.5" />
                    Отметить как изученное
                  </>
                )}
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Learn;
