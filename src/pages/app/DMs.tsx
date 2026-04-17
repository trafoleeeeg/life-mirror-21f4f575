import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Chat {
  id: string;
  name: string;
  preview: string;
  ai?: boolean;
  unread?: number;
}
interface Msg {
  id: string;
  from: "me" | "them" | "ai";
  text: string;
  ts: number;
}

const CHATS: Chat[] = [
  { id: "c1", name: "Аня", preview: "поговорим вечером?", unread: 2 },
  { id: "c2", name: "Аня + AI-психолог", preview: "AI: предлагаю каждому по очереди…", ai: true },
  { id: "c3", name: "Саша", preview: "ок, в 19 в зале" },
];

const SEED_MSGS: Record<string, Msg[]> = {
  c1: [
    { id: "1", from: "them", text: "привет, как ты?", ts: Date.now() - 3600_000 },
    { id: "2", from: "me", text: "нормально, поговорим вечером?", ts: Date.now() - 3000_000 },
  ],
  c2: [
    { id: "1", from: "me", text: "@psy помоги нам разобрать вчерашнюю ссору", ts: Date.now() - 1800_000 },
    {
      id: "2",
      from: "ai",
      text: "Окей. Каждый коротко: что вы хотели получить от того разговора и что получили? Без обвинений.",
      ts: Date.now() - 1700_000,
    },
  ],
  c3: [{ id: "1", from: "them", text: "ок, в 19 в зале", ts: Date.now() - 7200_000 }],
};

const DMs = () => {
  const [active, setActive] = useState<string>("c2");
  const [allMsgs, setAllMsgs] = useState(SEED_MSGS);
  const [input, setInput] = useState("");

  const messages = allMsgs[active] || [];
  const chat = CHATS.find((c) => c.id === active)!;

  const send = () => {
    if (!input.trim()) return;
    const msg: Msg = { id: crypto.randomUUID(), from: "me", text: input, ts: Date.now() };
    setAllMsgs((p) => ({ ...p, [active]: [...(p[active] || []), msg] }));
    setInput("");
    if (chat.ai) {
      setTimeout(() => {
        setAllMsgs((p) => ({
          ...p,
          [active]: [
            ...(p[active] || []),
            {
              id: crypto.randomUUID(),
              from: "ai",
              text: "Слышу. Прежде чем отвечать второй стороне — что ты хочешь получить именно от этого разговора?",
              ts: Date.now(),
            },
          ],
        }));
      }, 800);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="личное"
        title="Сообщения"
        description="1-на-1 чаты. Можно пригласить AI-психолога как третьего — для парных разборов."
      />

      <div className="grid md:grid-cols-[280px,1fr] gap-4 h-[calc(100vh-16rem)]">
        <Card className="glass p-2 overflow-y-auto">
          {CHATS.map((c) => (
            <button
              key={c.id}
              onClick={() => setActive(c.id)}
              className={cn(
                "w-full text-left p-3 rounded-md flex items-center gap-3 hover:bg-muted/50 transition-colors",
                active === c.id && "bg-muted",
              )}
            >
              <div
                className={cn(
                  "size-9 rounded-full shrink-0 flex items-center justify-center",
                  c.ai ? "bg-primary/20" : "bg-aurora",
                )}
              >
                {c.ai && <Sparkles className="size-4 text-primary" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{c.name}</div>
                <div className="text-xs text-muted-foreground truncate">{c.preview}</div>
              </div>
              {c.unread && (
                <span className="size-5 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center mono">
                  {c.unread}
                </span>
              )}
            </button>
          ))}
          <Button variant="outline" size="sm" className="w-full mt-2">
            <UserPlus className="size-3.5" />
            Новый чат
          </Button>
        </Card>

        <Card className="glass flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
            <div className="font-medium text-sm">{chat.name}</div>
            {!chat.ai && (
              <Button size="sm" variant="ghost" className="text-xs">
                <Sparkles className="size-3.5" />
                Позвать психолога
              </Button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn("flex", m.from === "me" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm",
                    m.from === "me"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : m.from === "ai"
                        ? "bg-primary/10 border border-primary/30 rounded-bl-sm"
                        : "bg-muted rounded-bl-sm",
                  )}
                >
                  {m.from === "ai" && (
                    <div className="mono text-[10px] text-primary mb-1 flex items-center gap-1">
                      <Sparkles className="size-3" />
                      психолог
                    </div>
                  )}
                  {m.text}
                </div>
              </div>
            ))}
          </div>
          <div className="p-3 border-t border-border/60 flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Написать…"
            />
            <Button onClick={send}>Отправить</Button>
          </div>
        </Card>
      </div>
    </>
  );
};

export default DMs;
