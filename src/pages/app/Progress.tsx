import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { GlyphAvatar, GlyphState } from "@/components/glyph/GlyphAvatar";
import { loadProfile } from "@/lib/profile";
import { Trophy, Flame } from "lucide-react";

const Progress = () => {
  const profile = loadProfile();

  // Synthetic weekly snapshots
  const snapshots: { date: string; state: GlyphState }[] = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (5 - i) * 7);
    return {
      date: d.toLocaleDateString("ru", { day: "2-digit", month: "short" }),
      state: {
        ...profile.glyph,
        integrity: Math.max(20, Math.min(95, profile.glyph.integrity - (5 - i) * 4 + Math.random() * 8)),
        energy: Math.max(20, Math.min(95, profile.glyph.energy - (5 - i) * 2 + Math.random() * 8)),
        seed: profile.glyph.seed + i,
      },
    };
  });

  const themes = [
    { title: "Перфекционизм на работе", weeks: 4, status: "в работе" },
    { title: "Конфликты с мамой", weeks: 7, status: "сдвиг" },
    { title: "Откладывание спорта", weeks: 2, status: "в работе" },
    { title: "Страх публичных выступлений", weeks: 12, status: "проработано" },
  ];

  const leaderboard = [
    { name: "айсберг", theme: "Прокрастинация", days: 9 },
    { name: "ты", theme: "Сон", days: 14, you: true },
    { name: "ольга_не_ольга", theme: "Семья", days: 21 },
    { name: "невидимый_кит", theme: "Соцсети", days: 28 },
  ];

  return (
    <>
      <PageHeader
        eyebrow="отпечатки личности"
        title="Прогресс"
        description="Не очки и уровни — а честная динамика. Сравни себя нынешнего с собой 6 недель назад."
      />

      <Card className="glass p-5 mb-6">
        <h3 className="font-semibold mb-4">Снапшоты Глифа</h3>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {snapshots.map((s, i) => (
            <div key={i} className="shrink-0 text-center">
              <div
                className={`p-2 rounded-lg border ${
                  i === snapshots.length - 1 ? "border-primary shadow-neon" : "border-border"
                }`}
              >
                <GlyphAvatar state={s.state} size={120} animated={false} />
              </div>
              <div className="mono text-[10px] text-muted-foreground mt-2">{s.date}</div>
              <div className="mono text-xs">{Math.round(s.state.integrity)}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="glass p-5">
          <h3 className="font-semibold mb-4">Темы, с которыми ты работал</h3>
          <div className="space-y-2">
            {themes.map((t) => (
              <div
                key={t.title}
                className="flex items-center justify-between p-3 rounded-md border border-border/60"
              >
                <div>
                  <div className="text-sm font-medium">{t.title}</div>
                  <div className="text-xs text-muted-foreground mono">{t.weeks} нед.</div>
                </div>
                <span
                  className={`text-[10px] mono uppercase tracking-wider px-2 py-1 rounded ${
                    t.status === "проработано"
                      ? "bg-growth/20 text-growth"
                      : t.status === "сдвиг"
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {t.status}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="glass p-5">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="size-4 text-energy" />
            <h3 className="font-semibold">Сезонный топ быстрых проработок</h3>
          </div>
          <div className="space-y-2">
            {leaderboard.map((l, i) => (
              <div
                key={l.name}
                className={`flex items-center gap-3 p-2.5 rounded-md ${
                  l.you ? "bg-primary/10 border border-primary/40" : ""
                }`}
              >
                <span className="mono text-sm w-5 text-muted-foreground">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{l.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{l.theme}</div>
                </div>
                <div className="flex items-center gap-1 text-xs mono">
                  <Flame className="size-3 text-tension" />
                  {l.days}д
                </div>
              </div>
            ))}
          </div>
          <p className="mono text-[10px] text-muted-foreground mt-4">
            мягкий рейтинг · без давления, без публичных штрафов
          </p>
        </Card>
      </div>
    </>
  );
};

export default Progress;
