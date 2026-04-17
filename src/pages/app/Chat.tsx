import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { loadProfile, saveProfile } from "@/lib/profile";
import { Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
  ts: number;
}

const TONE_LABEL = { soft: "Мягкий", hard: "Жёсткий", socratic: "Сократ" } as const;

const GREETING: Record<"soft" | "hard" | "socratic", string> = {
  soft: "Привет. Я здесь. С чем пришёл сегодня? Можно начать с маленького — что ощущаешь прямо сейчас?",
  socratic: "Здравствуй. Один вопрос для начала: что в этом дне ты бы хотел понять про себя яснее?",
  hard: "Так. Давай без прелюдий. Что прямо сейчас тебя жжёт — но ты делаешь вид, что норм?",
};

const Chat = () => {
  const [profile, setProfile] = useState(loadProfile());
  const [messages, setMessages] = useState<Msg[]>(() => {
    const raw = localStorage.getItem("ig:chat");
    if (raw) return JSON.parse(raw) as Msg[];
    return [
      { id: "m0", role: "assistant", content: GREETING[profile.tone], ts: Date.now() },
    ];
  });
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem("ig:chat", JSON.stringify(messages));
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const setTone = (t: typeof profile.tone) => {
    const next = { ...profile, tone: t };
    setProfile(next);
    saveProfile(next);
  };

  const send = () => {
    const text = input.trim();
    if (!text) return;
    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", content: text, ts: Date.now() };
    setMessages((p) => [...p, userMsg]);
    setInput("");
    setThinking(true);
    // Local stub. Backend (Lovable Cloud + Lovable AI) подключим следующим шагом.
    setTimeout(() => {
      const stubs: Record<typeof profile.tone, string[]> = {
        soft: [
          "Слышу тебя. Расскажи чуть подробнее — что предшествовало этому ощущению?",
          "Это важно. Где в теле ты это чувствуешь сейчас?",
        ],
        socratic: [
          "А если убрать слово «должен» из того, что ты сказал — что останется?",
          "Что бы ты сказал другу в такой же ситуации?",
        ],
        hard: [
          "Окей, и сколько ты уже это себе рассказываешь? Месяц? Год?",
          "Что конкретно ты сделаешь сегодня, не завтра?",
        ],
      };
      const reply: Msg = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: stubs[profile.tone][Math.floor(Math.random() * 2)],
        ts: Date.now(),
      };
      setMessages((p) => [...p, reply]);
      setThinking(false);
    }, 700);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-5rem)]">
      <PageHeader
        eyebrow="ai · с памятью"
        title="Психолог"
        description="Говори свободно. AI извлекает события и связи в твой граф автоматически."
      >
        <div className="flex gap-1">
          {(Object.keys(TONE_LABEL) as Array<keyof typeof TONE_LABEL>).map((t) => (
            <Button
              key={t}
              size="sm"
              variant={profile.tone === t ? "default" : "outline"}
              onClick={() => setTone(t)}
            >
              {TONE_LABEL[t]}
            </Button>
          ))}
        </div>
      </PageHeader>

      <Card className="glass flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={cn("flex gap-3", m.role === "user" ? "justify-end" : "justify-start")}
            >
              {m.role === "assistant" && (
                <div className="size-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <Sparkles className="size-4 text-primary" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-muted text-foreground rounded-bl-sm",
                )}
              >
                {m.content}
                <div className="mono text-[10px] opacity-60 mt-1">
                  {new Date(m.ts).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          ))}
          {thinking && (
            <div className="flex gap-3">
              <div className="size-8 rounded-full bg-primary/20 flex items-center justify-center">
                <Sparkles className="size-4 text-primary animate-pulse" />
              </div>
              <div className="bg-muted rounded-2xl px-4 py-3 text-sm">
                <span className="inline-flex gap-1">
                  <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                  <span className="size-1.5 rounded-full bg-primary animate-pulse [animation-delay:150ms]" />
                  <span className="size-1.5 rounded-full bg-primary animate-pulse [animation-delay:300ms]" />
                </span>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="border-t border-border/60 p-3 md:p-4">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Что у тебя сейчас на душе?"
              className="resize-none min-h-[44px] max-h-32"
              rows={1}
            />
            <Button onClick={send} size="icon" className="shrink-0 size-11 ">
              <Send className="size-4" />
            </Button>
          </div>
          <p className="mono text-[10px] text-muted-foreground mt-2">
            демо-режим · подключение к AI gateway будет на следующем шаге
          </p>
        </div>
      </Card>
    </div>
  );
};

export default Chat;
