import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { GlyphAvatar, GlyphState } from "@/components/glyph/GlyphAvatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Question {
  id: string;
  text: string;
  options: { label: string; value: number }[];
  /** how this question maps to glyph axes */
  affects: Partial<Record<keyof GlyphState, number>>;
}

const QUESTIONS: Question[] = [
  {
    id: "q1",
    text: "Когда ты последний раз чувствовал, что живёшь свою жизнь, а не чужой сценарий?",
    affects: { integrity: 1, growth: 1 },
    options: [
      { label: "Сегодня", value: 4 },
      { label: "На этой неделе", value: 3 },
      { label: "В этом году", value: 2 },
      { label: "Не помню", value: 1 },
    ],
  },
  {
    id: "q2",
    text: "Сколько времени в день уходит на то, что реально приближает тебя к твоей цели?",
    affects: { growth: 1, energy: 0.5 },
    options: [
      { label: "Больше 3 часов", value: 4 },
      { label: "1–3 часа", value: 3 },
      { label: "Меньше часа", value: 2 },
      { label: "Почти ничего", value: 1 },
    ],
  },
  {
    id: "q3",
    text: "Как ты спишь?",
    affects: { energy: 1, calm: 0.5 },
    options: [
      { label: "Высыпаюсь", value: 4 },
      { label: "Бывает по-разному", value: 3 },
      { label: "Часто не высыпаюсь", value: 2 },
      { label: "Хронически разбит", value: 1 },
    ],
  },
  {
    id: "q4",
    text: "Отношения с близким человеком сейчас — это про…",
    affects: { calm: 1, integrity: 0.5 },
    options: [
      { label: "Поддержку и тепло", value: 4 },
      { label: "Привычку", value: 2.5 },
      { label: "Ссоры и напряжение", value: 1.5 },
      { label: "Нет таких отношений", value: 2 },
    ],
  },
  {
    id: "q5",
    text: "Когда ты последний раз пробовал что-то по-настоящему новое?",
    affects: { growth: 1 },
    options: [
      { label: "На этой неделе", value: 4 },
      { label: "В этом месяце", value: 3 },
      { label: "В этом году", value: 2 },
      { label: "Давно", value: 1 },
    ],
  },
  {
    id: "q6",
    text: "Соцсети для тебя — это…",
    affects: { calm: 1, energy: 0.5 },
    options: [
      { label: "Инструмент", value: 4 },
      { label: "Привычка", value: 2.5 },
      { label: "Зависимость", value: 1.5 },
      { label: "Бегство", value: 1 },
    ],
  },
  {
    id: "q7",
    text: "Если бы у тебя было свободное воскресенье без обязательств — ты бы знал, как его провести так, чтобы было хорошо?",
    affects: { integrity: 1 },
    options: [
      { label: "Точно знаю", value: 4 },
      { label: "Примерно", value: 3 },
      { label: "Растерялся бы", value: 2 },
      { label: "Скорее залип бы в телефоне", value: 1 },
    ],
  },
  {
    id: "q8",
    text: "Ты честен с собой о том, чего реально хочешь?",
    affects: { integrity: 1, growth: 0.5 },
    options: [
      { label: "Да, в основном", value: 4 },
      { label: "Иногда увиливаю", value: 3 },
      { label: "Часто вру себе", value: 2 },
      { label: "Не знаю, чего хочу", value: 1 },
    ],
  },
  {
    id: "q9",
    text: "Тело — энергия, осанка, дыхание — сейчас оно с тобой как?",
    affects: { energy: 1, calm: 0.5 },
    options: [
      { label: "В тонусе", value: 4 },
      { label: "Нормально", value: 3 },
      { label: "Подсажено", value: 2 },
      { label: "Разваливается", value: 1 },
    ],
  },
  {
    id: "q10",
    text: "Что тебе нужнее всего прямо сейчас?",
    affects: { calm: 0.5, growth: 0.5, integrity: 0.5 },
    options: [
      { label: "Покой", value: 3 },
      { label: "Движение", value: 3 },
      { label: "Ясность", value: 3 },
      { label: "Близость", value: 3 },
    ],
  },
];

const Onboarding = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0); // 0 = name/tone, 1..10 = questions, 11 = result
  const [name, setName] = useState("");
  const [tone, setTone] = useState<"soft" | "hard" | "socratic">("soft");
  const [answers, setAnswers] = useState<Record<string, number>>({});

  const totalSteps = QUESTIONS.length + 2;
  const progress = (step / (totalSteps - 1)) * 100;

  const computedGlyph: GlyphState = (() => {
    const axes = { integrity: 0, energy: 0, calm: 0, growth: 0 };
    const weights = { integrity: 0, energy: 0, calm: 0, growth: 0 };
    for (const q of QUESTIONS) {
      const a = answers[q.id];
      if (a == null) continue;
      const norm = (a - 1) / 3; // 0..1
      for (const [k, w] of Object.entries(q.affects) as [keyof typeof axes, number][]) {
        axes[k] += norm * w * 100;
        weights[k] += w;
      }
    }
    const safe = (k: keyof typeof axes) => (weights[k] ? Math.round(axes[k] / weights[k]) : 50);
    return {
      integrity: safe("integrity"),
      energy: safe("energy"),
      calm: safe("calm"),
      growth: safe("growth"),
      seed: name.length || 7,
    };
  })();

  const handleAnswer = (qid: string, value: number) => {
    setAnswers((p) => ({ ...p, [qid]: value }));
    setTimeout(() => setStep((s) => s + 1), 180);
  };

  const finish = () => {
    localStorage.setItem(
      "ig:profile",
      JSON.stringify({ name, tone, glyph: computedGlyph, answers, createdAt: Date.now() }),
    );
    navigate("/app");
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-mirror">
      <Card className="glass w-full max-w-2xl p-6 md:p-10">
        <div className="mb-6">
          <Progress value={progress} className="h-1" />
          <p className="mono text-[10px] uppercase tracking-widest text-muted-foreground mt-2">
            шаг {step + 1} из {totalSteps}
          </p>
        </div>

        {step === 0 && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h2 className="text-2xl font-semibold">Давай знакомиться</h2>
              <p className="text-muted-foreground mt-2">
                Это не регистрация в соцсети. Это начало диалога с собой.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Как тебя называть?</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Имя или ник"
              />
            </div>
            <div className="space-y-3">
              <Label>Какой тон AI-психолога тебе ближе?</Label>
              <div className="grid sm:grid-cols-3 gap-2">
                {[
                  { id: "soft", title: "Мягкий", desc: "Поддержка, бережность" },
                  { id: "socratic", title: "Сократ", desc: "Вопросами в суть" },
                  { id: "hard", title: "Жёсткий", desc: "Без сахара, по фактам" },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTone(t.id as typeof tone)}
                    className={`text-left p-3 rounded-md border transition-colors ${
                      tone === t.id
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="font-medium text-sm">{t.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">{t.desc}</div>
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Сменить можно в любой момент.</p>
            </div>
            <Button
              onClick={() => setStep(1)}
              disabled={!name.trim()}
              className="w-full shadow-neon"
              size="lg"
            >
              Поехали
            </Button>
          </div>
        )}

        {step >= 1 && step <= QUESTIONS.length && (
          <div className="space-y-6 animate-fade-in" key={step}>
            <h2 className="text-xl md:text-2xl font-semibold leading-snug">
              {QUESTIONS[step - 1].text}
            </h2>
            <div className="grid gap-2">
              {QUESTIONS[step - 1].options.map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => handleAnswer(QUESTIONS[step - 1].id, opt.value)}
                  className="text-left px-4 py-3 rounded-md border border-border hover:border-primary hover:bg-primary/5 transition-colors"
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {step > 1 && (
              <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)}>
                ← назад
              </Button>
            )}
          </div>
        )}

        {step === totalSteps - 1 && (
          <div className="text-center animate-fade-in space-y-6">
            <p className="mono text-xs uppercase tracking-widest text-primary/80">
              твой глиф готов
            </p>
            <div className="flex justify-center">
              <GlyphAvatar state={computedGlyph} size={260} />
            </div>
            <div className="grid grid-cols-4 gap-3 max-w-md mx-auto">
              {(["integrity", "energy", "calm", "growth"] as const).map((k) => (
                <div key={k} className="text-center">
                  <div className="mono text-2xl">{computedGlyph[k]}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {k}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Это снимок «как сейчас». Дальше Глиф будет меняться вместе с тобой — на основе
              чек-инов, разговоров и реальных событий.
            </p>
            <Button onClick={finish} size="lg" className="shadow-neon">
              Войти в зеркало
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};

export default Onboarding;
