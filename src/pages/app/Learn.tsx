import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { BookOpen, Brain, Heart, Sparkles } from "lucide-react";

const sections = [
  {
    icon: Brain,
    title: "CBT — когнитивная терапия",
    desc: "Как мысли создают эмоции, а эмоции — поведение. И как разорвать круг автоматических искажений.",
    items: ["Когнитивные искажения 101", "ABC-модель", "Разговор с внутренним критиком"],
  },
  {
    icon: Heart,
    title: "IFS — внутренние части",
    desc: "Внутри тебя — не один «ты», а команда. Как услышать каждого, а не воевать с собой.",
    items: ["Изгнанники, защитники, менеджеры", "Self-energy", "Простые упражнения"],
  },
  {
    icon: Sparkles,
    title: "Осознанность",
    desc: "Не медитация ради медитации. Возвращение к себе — как навык, а не как духовная гонка.",
    items: ["Сканирование тела", "Дыхание 4-7-8", "Микропаузы в дне"],
  },
  {
    icon: BookOpen,
    title: "Идентичность и ценности",
    desc: "Как отличить «своё» от усвоенного из соцсетей и семьи. Карта собственных смыслов.",
    items: ["Колесо ценностей", "Жизненные роли", "Автобиография в 1 страницу"],
  },
];

const Learn = () => (
  <>
    <PageHeader
      eyebrow="опора, а не догма"
      title="Знания"
      description="Конспекты подходов, на которых стоит работа в приложении. Психолог-AI может ссылаться на них прямо в диалоге."
    />

    <div className="grid md:grid-cols-2 gap-4">
      {sections.map((s) => (
        <Card key={s.title} className="glass p-5 hover:border-primary/50 transition-colors">
          <div className="flex items-start gap-3 mb-3">
            <div className="size-10 rounded-md bg-primary/15 flex items-center justify-center shrink-0">
              <s.icon className="size-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">{s.title}</h3>
              <p className="text-xs text-muted-foreground mt-1">{s.desc}</p>
            </div>
          </div>
          <ul className="space-y-1.5 mt-4">
            {s.items.map((it) => (
              <li key={it} className="text-sm flex items-center gap-2 text-foreground/80">
                <span className="size-1 rounded-full bg-primary" />
                {it}
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  </>
);

export default Learn;
