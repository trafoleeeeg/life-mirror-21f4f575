import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { GlyphAvatar, GlyphState, STAT_META, STAT_ORDER, defaultGlyphState } from "@/components/glyph/GlyphAvatar";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, ClipboardCheck, MessageCircle, Network } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

const GlyphHome = () => {
  const { user } = useAuth();
  const [glyph, setGlyph] = useState<GlyphState>(defaultGlyphState);
  const [name, setName] = useState("Гость");

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [{ data: profile }, { data: stats }] = await Promise.all([
        supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle(),
        supabase
          .from("glyph_stats")
          .select("body,mind,emotions,relationships,career,finance,creativity,meaning")
          .eq("user_id", user.id)
          .order("recorded_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (profile?.display_name) setName(profile.display_name);
      if (stats) setGlyph(stats as GlyphState);
    };
    load();
    // refresh whenever a new stats row is inserted for this user
    const ch = supabase
      .channel("glyph-stats-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "glyph_stats", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as Record<string, number>;
          setGlyph({
            body: row.body, mind: row.mind, emotions: row.emotions, relationships: row.relationships,
            career: row.career, finance: row.finance, creativity: row.creativity, meaning: row.meaning,
          } as GlyphState);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const today = new Date().toLocaleDateString("ru", { weekday: "long", day: "numeric", month: "long" });

  return (
    <>
      <PageHeader
        eyebrow={today}
        title={`Привет, ${name}`}
        description="Восемь колец — восемь сфер жизни. Ближе к центру — глубже, наружу — шире."
      />

      <div className="grid lg:grid-cols-[1fr,1.2fr] gap-6">
        <Card className="ios-card p-6 flex flex-col items-center justify-center">
          <div className="animate-float">
            <GlyphAvatar state={glyph} size={300} />
          </div>
        </Card>

        <Card className="ios-card p-6">
          <p className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4">
            твои статы
          </p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            {STAT_ORDER.map((k) => {
              const v = glyph[k];
              return (
                <div key={k}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: `hsl(var(${STAT_META[k].tokenVar}))` }}
                      />
                      <span className="text-sm font-medium">{STAT_META[k].label}</span>
                    </div>
                    <span className="mono text-sm text-muted-foreground">{v}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${v}%`,
                        backgroundColor: `hsl(var(${STAT_META[k].tokenVar}))`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="grid sm:grid-cols-3 gap-3 mt-6">
        {[
          { to: "/app/checkin", icon: ClipboardCheck, title: "Чек-ин", text: "1 минута" },
          { to: "/app/chat", icon: MessageCircle, title: "Разговор", text: "с психологом" },
          { to: "/app/graph", icon: Network, title: "Граф", text: "связи событий" },
        ].map((c) => (
          <Card key={c.to} className="ios-card p-4 hover:bg-card/80 transition-colors">
            <Link to={c.to} className="block">
              <c.icon className="size-5 text-primary mb-2" />
              <div className="font-medium text-sm">{c.title}</div>
              <div className="text-xs text-muted-foreground flex items-center justify-between mt-0.5">
                {c.text}
                <ArrowRight className="size-3" />
              </div>
            </Link>
          </Card>
        ))}
      </div>

      <Card className="ios-card p-5 mt-4">
        <p className="mono text-[10px] uppercase tracking-widest text-primary mb-2">
          что говорит зеркало
        </p>
        <p className="text-base leading-relaxed">
          Сделай первый чек-ин — и кольца начнут оживать. Чем больше реальных данных, тем точнее
          зеркало. <span className="text-muted-foreground">Это гипотеза. Можешь отклонить.</span>
        </p>
        <Button asChild size="sm" className="mt-3 rounded-full">
          <Link to="/app/checkin">Начать чек-ин</Link>
        </Button>
      </Card>
    </>
  );
};

export default GlyphHome;
