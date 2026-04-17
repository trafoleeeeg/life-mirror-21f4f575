import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { GlyphAvatar, defaultGlyphState, STAT_META, STAT_ORDER } from "@/components/glyph/GlyphAvatar";
import { ArrowRight, Eye, Network, Sparkles } from "lucide-react";

const features = [
  {
    icon: Eye,
    title: "Зеркало без фильтров",
    text: "Не лента достижений. Реальная картина: настроения, отношения, привычки — как они есть.",
  },
  {
    icon: Network,
    title: "Граф жизни",
    text: "AI собирает события, людей и эмоции в связный слепок. Ты видишь паттерны, которые раньше не замечал.",
  },
  {
    icon: Sparkles,
    title: "Глиф — статы жизни",
    text: "Восемь колец активности — твои сферы жизни в одном взгляде. Меняются вместе с тобой.",
  },
];

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen relative overflow-hidden bg-background">
      <div className="absolute -top-40 -right-40 size-[600px] rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 size-[600px] rounded-full bg-accent/10 blur-3xl pointer-events-none" />

      <header className="relative z-10 max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground text-xs font-bold">IG</span>
          </div>
          <span className="font-semibold tracking-tight">Inner Glyph</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/auth")}>
            Войти
          </Button>
          <Button size="sm" onClick={() => navigate("/auth")} className="rounded-full">
            Начать
          </Button>
        </div>
      </header>

      <section className="relative z-10 max-w-6xl mx-auto px-6 pt-12 md:pt-20 pb-20 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <p className="mono text-xs uppercase tracking-[0.25em] text-primary mb-4">
            digital mirror · v0.1
          </p>
          <h1 className="text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
            Твоё <span className="text-primary">цифровое зеркало</span> — а не очередная лента лайков
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-xl">
            Соцсети показывают, кем тебе хочется казаться. Inner Glyph показывает, кем ты на самом
            деле становишься день за днём — мягко, честно, без морали.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" onClick={() => navigate("/auth")} className="rounded-full">
              Создать свой Глиф
              <ArrowRight className="ml-1" />
            </Button>
            <Button size="lg" variant="secondary" onClick={() => navigate("/install")} className="rounded-full">
              Установить на телефон
            </Button>
          </div>
          <p className="mt-6 mono text-xs text-muted-foreground">
            Никаких dark patterns. Данные — твои. Экспорт и удаление в один клик.
          </p>
        </div>

        <div className="flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/10 blur-3xl scale-110 rounded-full" />
            <GlyphAvatar state={defaultGlyphState} size={360} />
          </div>
        </div>
      </section>

      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-12">
        <div className="ios-card p-6">
          <p className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4">
            8 сфер жизни
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {STAT_ORDER.map((k) => (
              <div key={k} className="flex items-center gap-2.5">
                <span
                  className="size-3 rounded-full"
                  style={{ backgroundColor: `hsl(var(${STAT_META[k].tokenVar}))` }}
                />
                <span className="text-sm">{STAT_META[k].label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-24 grid md:grid-cols-3 gap-4">
        {features.map((f) => (
          <Card key={f.title} className="ios-card p-6">
            <f.icon className="size-6 text-primary mb-4" />
            <h3 className="font-semibold mb-2">{f.title}</h3>
            <p className="text-sm text-muted-foreground">{f.text}</p>
          </Card>
        ))}
      </section>

      <footer className="relative z-10 border-t border-border/40 py-6 text-center text-xs text-muted-foreground mono">
        zerkalo · made with care
      </footer>
    </div>
  );
};

export default Landing;
