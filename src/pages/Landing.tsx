import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { GlyphAvatar, defaultGlyphState } from "@/components/glyph/GlyphAvatar";
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
    title: "Глиф — твой аватар",
    text: "Живой символ твоего состояния. Меняется ежедневно вместе с тобой.",
  },
];

const Landing = () => {
  const navigate = useNavigate();
  const [glyph] = useState(defaultGlyphState);

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Hero */}
      <div className="absolute inset-0 bg-mirror opacity-60 pointer-events-none" />
      <div className="absolute -top-40 -right-40 size-[600px] rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 size-[600px] rounded-full bg-accent/10 blur-3xl pointer-events-none" />

      <header className="relative z-10 max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-primary shadow-neon" />
          <span className="font-semibold tracking-wide">Inner Glyph</span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/app")}>
            Войти
          </Button>
          <Button size="sm" onClick={() => navigate("/onboarding")} className="shadow-neon">
            Начать
          </Button>
        </div>
      </header>

      <section className="relative z-10 max-w-6xl mx-auto px-6 pt-12 md:pt-24 pb-20 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <p className="mono text-xs uppercase tracking-[0.25em] text-primary/80 mb-4">
            digital exocortex · v0.1
          </p>
          <h1 className="text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
            Твоё <span className="bg-aurora bg-clip-text text-transparent">цифровое зеркало</span> —{" "}
            а не очередная лента лайков
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-xl">
            Соцсети показывают, кем тебе хочется казаться. Inner Glyph показывает, кем ты на самом
            деле становишься день за днём — мягко, честно, без морали.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" onClick={() => navigate("/onboarding")} className="shadow-neon">
              Создать свой Глиф
              <ArrowRight className="ml-1" />
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/app">Посмотреть демо</Link>
            </Button>
          </div>
          <p className="mt-6 mono text-xs text-muted-foreground">
            Никаких dark patterns. Данные — твои. Экспорт и удаление в один клик.
          </p>
        </div>

        <div className="flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-glyph-radial blur-2xl scale-125" />
            <GlyphAvatar state={glyph} size={360} />
          </div>
        </div>
      </section>

      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-24 grid md:grid-cols-3 gap-4">
        {features.map((f) => (
          <Card key={f.title} className="glass p-6">
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
