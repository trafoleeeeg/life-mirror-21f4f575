import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { GlyphAvatar, GlyphState, STAT_ORDER, defaultGlyphState } from "@/components/glyph/GlyphAvatar";
import { Trophy, Flame } from "lucide-react";

const Progress = () => {
  // Synthetic weekly snapshots based on default state
  const snapshots: { date: string; state: GlyphState }[] = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (5 - i) * 7);
    const drift = (5 - i) * 3;
    const state = Object.fromEntries(
      STAT_ORDER.map((k) => [
        k,
        Math.max(20, Math.min(95, defaultGlyphState[k] - drift + Math.random() * 6)),
      ]),
    ) as GlyphState;
    return {
      date: d.toLocaleDateString("ru", { day: "numeric", month: "short" }),
      state,
    };
  });

  const overall = (s: GlyphState) =>
    Math.round(STAT_ORDER.reduce((sum, k) => sum + s[k], 0) / STAT_ORDER.length);

  return (
    <>
      <PageHeader
        eyebrow="отпечатки личности"
        title="Прогресс"
        description="Снимки Глифа по неделям. Сравнивай — и видь, как ты на самом деле меняешься."
      />

      <Card className="ios-card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <p className="mono text-[10px] uppercase tracking-widest text-muted-foreground">6 недель</p>
          <div className="flex items-center gap-3 text-sm">
            <span className="flex items-center gap-1.5">
              <Trophy className="size-4 text-primary" /> {snapshots.length} снимков
            </span>
            <span className="flex items-center gap-1.5">
              <Flame className="size-4 text-destructive" /> 4 дня подряд
            </span>
          </div>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {snapshots.map((s, i) => (
            <div key={i} className="text-center">
              <div
                className={`p-2 rounded-xl border ${
                  i === snapshots.length - 1 ? "border-primary" : "border-border"
                }`}
              >
                <GlyphAvatar state={s.state} size={90} showCenter={false} />
              </div>
              <div className="mono text-[10px] text-muted-foreground mt-2">{s.date}</div>
              <div className="mono text-xs">{overall(s.state)}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="ios-card p-6">
        <h3 className="font-semibold mb-3">Темы, проработанные за месяц</h3>
        <div className="flex flex-wrap gap-2">
          {["сон", "тревога", "карьера", "близкие", "деньги", "тело"].map((t) => (
            <span key={t} className="px-3 py-1 rounded-full bg-muted text-sm">
              {t}
            </span>
          ))}
        </div>
      </Card>
    </>
  );
};

export default Progress;
