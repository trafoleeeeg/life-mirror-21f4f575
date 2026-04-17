import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { AlertCircle, TrendingDown } from "lucide-react";
import { TodayWidget } from "@/components/dashboard/TodayWidget";

const days = Array.from({ length: 30 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() - (29 - i));
  return {
    date: d.toLocaleDateString("ru", { day: "2-digit", month: "2-digit" }),
    mood: 40 + Math.sin(i / 3) * 18 + Math.random() * 12,
    energy: 50 + Math.cos(i / 4) * 20 + Math.random() * 10,
  };
});

const topics = [
  { tag: "работа", real: 38, perceived: 60 },
  { tag: "соцсети", real: 22, perceived: 8 },
  { tag: "отношения", real: 14, perceived: 20 },
  { tag: "здоровье", real: 6, perceived: 15 },
  { tag: "проект мечты", real: 4, perceived: 25 },
];

const illusions = [
  {
    title: "«Я работаю над проектом мечты»",
    text: "Реально — 4% времени. Декларируешь как главное. Подумай, что в нём пугает на самом деле.",
  },
  {
    title: "«Соцсети — просто фон»",
    text: "22% активного времени. Это твой третий по объёму «партнёр» этого месяца.",
  },
  {
    title: "«У меня всё хорошо в отношениях»",
    text: "За 30 дней: 6 ссор, 0 разговоров про будущее. Хорошо — это какое именно?",
  },
];

const Dashboard = () => {
  const [scenario, setScenario] = useState("");
  const [forecast, setForecast] = useState<string | null>(null);

  const runScenario = () => {
    if (!scenario.trim()) return;
    setForecast(
      "По твоим данным: ты встаёшь в 7:30, спишь в среднем 6.4ч, последние 3 попытки изменить режим срывались на 4–6 день. Вероятность удержать новый режим > 2 недель: ~22%. Что поможет: сначала на неделю сдвинуть отбой на 22:30, без героики с подъёмом в 6. Гипотеза.",
    );
  };

  return (
    <>
      <PageHeader
        eyebrow="зеркало без фильтров"
        title="Дашборд осознанности"
        description="Не ради красивой картинки. Ради честной."
      />

      <TodayWidget />

      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <Card className="glass p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Настроение и энергия · 30 дней</h3>
            <div className="flex gap-1 text-xs">
              {["7", "30", "90"].map((d) => (
                <button
                  key={d}
                  className={`px-2 py-1 rounded ${d === "30" ? "bg-primary/20 text-primary" : "text-muted-foreground"}`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={days}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" />
                <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} interval={4} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Line type="monotone" dataKey="mood" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="energy" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="glass p-5">
          <h3 className="font-semibold mb-3">На что реально уходит время</h3>
          <div className="space-y-3">
            {topics.map((t) => (
              <div key={t.tag}>
                <div className="flex justify-between text-xs mb-1">
                  <span>#{t.tag}</span>
                  <span className="mono text-muted-foreground">
                    {t.real}% / <span className="text-accent">{t.perceived}%</span>
                  </span>
                </div>
                <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-accent/40"
                    style={{ width: `${t.perceived}%` }}
                  />
                  <div className="absolute inset-y-0 left-0 bg-primary" style={{ width: `${t.real}%` }} />
                </div>
              </div>
            ))}
            <p className="mono text-[10px] text-muted-foreground pt-2">
              <span className="text-primary">●</span> реально &nbsp;
              <span className="text-accent">●</span> как тебе кажется
            </p>
          </div>
        </Card>
      </div>

      <Card className="glass p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertCircle className="size-4 text-accent" />
          <h3 className="font-semibold">Иллюзии месяца</h3>
          <span className="mono text-[10px] text-muted-foreground ml-auto">гипотезы AI</span>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          {illusions.map((il) => (
            <div key={il.title} className="border border-border/60 rounded-lg p-4 hover:border-accent/50 transition-colors">
              <div className="flex items-start gap-2 mb-2">
                <TrendingDown className="size-4 text-accent shrink-0 mt-0.5" />
                <p className="text-sm font-medium">{il.title}</p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{il.text}</p>
              <div className="flex gap-2 mt-3">
                <Button size="sm" variant="ghost" className="text-xs h-7">
                  принять
                </Button>
                <Button size="sm" variant="ghost" className="text-xs h-7">
                  отклонить
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="glass p-5">
        <h3 className="font-semibold mb-2">Дерево «что если»</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Опиши план — AI на основе твоих данных оценит реалистичный сценарий, а не тот, что рисует фантазия.
        </p>
        <Textarea
          value={scenario}
          onChange={(e) => setScenario(e.target.value)}
          placeholder="Например: с понедельника начну вставать в 6 утра и бегать каждый день"
          rows={3}
        />
        <div className="flex justify-end mt-3">
          <Button onClick={runScenario} className="">
            Построить прогноз
          </Button>
        </div>
        {forecast && (
          <div className="mt-4 border-t border-border/60 pt-4">
            <p className="mono text-[10px] uppercase tracking-widest text-primary/80 mb-2">
              реалистичный сценарий
            </p>
            <p className="text-sm leading-relaxed">{forecast}</p>
          </div>
        )}
      </Card>
    </>
  );
};

export default Dashboard;
