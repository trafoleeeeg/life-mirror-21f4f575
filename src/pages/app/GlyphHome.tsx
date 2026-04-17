import { Card } from "@/components/ui/card";
import { GlyphAvatar } from "@/components/glyph/GlyphAvatar";
import { loadProfile } from "@/lib/profile";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, ClipboardCheck, MessageCircle, Network } from "lucide-react";

const GlyphHome = () => {
  const profile = loadProfile();
  const { glyph } = profile;
  const axes = [
    { key: "integrity", label: "Целостность", color: "bg-primary" },
    { key: "energy", label: "Энергия", color: "bg-energy" },
    { key: "calm", label: "Покой", color: "bg-calm" },
    { key: "growth", label: "Рост", color: "bg-growth" },
  ] as const;

  const today = new Date().toLocaleDateString("ru", { weekday: "long", day: "numeric", month: "long" });

  return (
    <>
      <PageHeader
        eyebrow={today}
        title={`Привет, ${profile.name}`}
        description="Это твой Глиф сегодня. Он отражает твоё состояние и будет меняться вместе с тобой."
      />

      <div className="grid lg:grid-cols-[1fr,1.2fr] gap-6">
        <Card className="surface-elevated p-6 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 bg-glyph-radial opacity-60" />
          <div className="relative animate-float">
            <GlyphAvatar state={glyph} size={300} />
          </div>
          <div className="relative grid grid-cols-4 gap-2 w-full mt-6">
            {axes.map((a) => (
              <div key={a.key} className="text-center">
                <div className="mono text-2xl">{glyph[a.key]}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
                  {a.label}
                </div>
                <div className="h-1 mt-1.5 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full ${a.color}`} style={{ width: `${glyph[a.key]}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="glass p-5">
            <p className="mono text-[10px] uppercase tracking-widest text-primary/80 mb-2">
              что говорит зеркало
            </p>
            <p className="text-lg leading-relaxed">
              Твой уровень <span className="text-primary">энергии</span> сейчас выше среднего, но{" "}
              <span className="text-accent">целостность</span> просела — похоже, ты делаешь много, но
              не своё. <span className="text-muted-foreground">Гипотеза. Можешь отклонить.</span>
            </p>
          </Card>

          <div className="grid sm:grid-cols-3 gap-3">
            {[
              { to: "/app/checkin", icon: ClipboardCheck, title: "Чек-ин", text: "1 минута" },
              { to: "/app/chat", icon: MessageCircle, title: "Разговор", text: "с психологом" },
              { to: "/app/graph", icon: Network, title: "Граф", text: "связи событий" },
            ].map((c) => (
              <Card key={c.to} className="glass p-4 hover:border-primary/60 transition-colors">
                <Link to={c.to} className="block">
                  <c.icon className="size-5 text-primary mb-2" />
                  <div className="font-medium text-sm">{c.title}</div>
                  <div className="text-xs text-muted-foreground flex items-center justify-between">
                    {c.text}
                    <ArrowRight className="size-3" />
                  </div>
                </Link>
              </Card>
            ))}
          </div>

          <Card className="glass p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
                ритуал дня
              </p>
              <span className="text-xs text-primary">2 из 3</span>
            </div>
            <div className="space-y-2">
              {[
                { label: "Утренний чек-ин", done: true },
                { label: "5 минут разговора с собой", done: true },
                { label: "Вечерний чек-ин", done: false },
              ].map((r) => (
                <div key={r.label} className="flex items-center gap-3 text-sm">
                  <span
                    className={`size-4 rounded-full border ${
                      r.done ? "bg-primary border-primary shadow-neon" : "border-border"
                    }`}
                  />
                  <span className={r.done ? "" : "text-muted-foreground"}>{r.label}</span>
                </div>
              ))}
            </div>
            <Button asChild size="sm" variant="outline" className="mt-4 w-full">
              <Link to="/app/checkin">Закрыть день</Link>
            </Button>
          </Card>
        </div>
      </div>
    </>
  );
};

export default GlyphHome;
