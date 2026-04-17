import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Msg {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  ts: number;
}

const TONE_LABEL = { soft: "Мягкий", hard: "Жёсткий", socratic: "Сократ" } as const;
type Tone = keyof typeof TONE_LABEL;

const GREETING: Record<Tone, string> = {
  soft: "Привет. Я здесь. С чем пришёл сегодня? Можно начать с маленького — что ощущаешь прямо сейчас?",
  socratic: "Здравствуй. Один вопрос для начала: что в этом дне ты бы хотел понять про себя яснее?",
  hard: "Так. Без прелюдий. Что прямо сейчас тебя жжёт — но ты делаешь вид, что норм?",
};

const Chat = () => {
  const { user, session } = useAuth();
  const [tone, setTone] = useState<Tone>("soft");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Bootstrap: load profile tone, last session, messages
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("ai_tone")
        .eq("user_id", user.id)
        .maybeSingle();
      const t = ((profile?.ai_tone as Tone) || "soft");
      setTone(t);

      // get latest session or create
      const { data: existing } = await supabase
        .from("chat_sessions")
        .select("id")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let sid = existing?.id;
      if (!sid) {
        const { data: created } = await supabase
          .from("chat_sessions")
          .insert({ user_id: user.id, title: "Первая сессия" })
          .select("id")
          .single();
        sid = created?.id;
      }
      if (!sid) return;
      setSessionId(sid);

      const { data: msgs } = await supabase
        .from("chat_messages")
        .select("id, role, content, created_at")
        .eq("session_id", sid)
        .order("created_at", { ascending: true });

      if (msgs && msgs.length) {
        setMessages(
          msgs
            .filter((m) => m.role !== "system")
            .map((m) => ({
              id: m.id,
              role: m.role as Msg["role"],
              content: m.content,
              ts: new Date(m.created_at).getTime(),
            })),
        );
      } else {
        setMessages([{ id: "greet", role: "assistant", content: GREETING[t], ts: Date.now() }]);
      }
    })();
  }, [user]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  const updateTone = async (t: Tone) => {
    setTone(t);
    if (user) await supabase.from("profiles").update({ ai_tone: t }).eq("user_id", user.id);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || !sessionId || !session) return;

    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", content: text, ts: Date.now() };
    setMessages((p) => [...p, userMsg]);
    setInput("");
    setStreaming(true);

    let acc = "";
    const upsert = (chunk: string) => {
      acc += chunk;
      setMessages((p) => {
        const last = p[p.length - 1];
        if (last?.role === "assistant" && last.id === "streaming") {
          return p.map((m, i) => (i === p.length - 1 ? { ...m, content: acc } : m));
        }
        return [...p, { id: "streaming", role: "assistant", content: acc, ts: Date.now() }];
      });
    };

    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ sessionId, message: text }),
      });

      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        if (resp.status === 429) toast.error("Слишком много запросов — подожди немного.");
        else if (resp.status === 402) toast.error("Закончились кредиты Lovable AI.");
        else toast.error(body.error || "Ошибка AI");
        setStreaming(false);
        return;
      }

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let done = false;

      while (!done) {
        const r = await reader.read();
        if (r.done) break;
        buf += decoder.decode(r.value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") {
            done = true;
            break;
          }
          try {
            const json = JSON.parse(payload);
            const delta = json.choices?.[0]?.delta?.content as string | undefined;
            if (delta) upsert(delta);
            if (json.next && json.reason) {
              toast.success("Глиф обновлён", { description: json.reason });
            }
          } catch {
            buf = line + "\n" + buf;
            break;
          }
        }
      }

      // Replace streaming id with stable one
      setMessages((p) =>
        p.map((m) => (m.id === "streaming" ? { ...m, id: crypto.randomUUID() } : m)),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Сеть недоступна");
    } finally {
      setStreaming(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-5rem)]">
      <PageHeader
        eyebrow="ai · с памятью"
        title="Психолог"
        description="Говори свободно. AI помнит контекст и может обновлять твои статы."
      >
        <div className="flex gap-1">
          {(Object.keys(TONE_LABEL) as Tone[]).map((t) => (
            <Button
              key={t}
              size="sm"
              variant={tone === t ? "default" : "outline"}
              onClick={() => updateTone(t)}
            >
              {TONE_LABEL[t]}
            </Button>
          ))}
        </div>
      </PageHeader>

      <Card className="ios-card flex-1 flex flex-col overflow-hidden">
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
                  "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
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
          {streaming && messages[messages.length - 1]?.id !== "streaming" && (
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
              className="resize-none min-h-[44px] max-h-32 rounded-xl"
              rows={1}
              disabled={streaming}
            />
            <Button onClick={send} size="icon" className="shrink-0 size-11 rounded-full" disabled={streaming || !input.trim()}>
              <Send className="size-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Chat;
