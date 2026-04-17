import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Send,
  Sparkles,
  Plus,
  MessageCircle,
  Pencil,
  Trash2,
  Check,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { bumpAutoExtract } from "@/lib/autoExtract";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Msg {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  ts: number;
}

interface Session {
  id: string;
  title: string;
  updated_at: string;
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
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showSessions, setShowSessions] = useState(false);
  const [sessionSearch, setSessionSearch] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  // Load tone + sessions
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("ai_tone")
        .eq("user_id", user.id)
        .maybeSingle();
      setTone(((profile?.ai_tone as Tone) || "soft"));

      const { data: ss } = await supabase
        .from("chat_sessions")
        .select("id, title, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      let list = (ss || []) as Session[];
      if (!list.length) {
        const { data: created } = await supabase
          .from("chat_sessions")
          .insert({ user_id: user.id, title: "Новая сессия" })
          .select("id, title, updated_at")
          .single();
        if (created) list = [created as Session];
      }
      setSessions(list);
      if (list[0]) setSessionId(list[0].id);
    })();
  }, [user]);

  // Load messages when session changes
  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      const { data: msgs } = await supabase
        .from("chat_messages")
        .select("id, role, content, created_at")
        .eq("session_id", sessionId)
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
        setMessages([{ id: "greet", role: "assistant", content: GREETING[tone], ts: Date.now() }]);
      }
    })();
  }, [sessionId, tone]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  const updateTone = async (t: Tone) => {
    setTone(t);
    if (user) await supabase.from("profiles").update({ ai_tone: t }).eq("user_id", user.id);
  };

  const newSession = async () => {
    if (!user) return;
    const { data: created } = await supabase
      .from("chat_sessions")
      .insert({ user_id: user.id, title: `Сессия ${sessions.length + 1}` })
      .select("id, title, updated_at")
      .single();
    if (created) {
      setSessions((p) => [created as Session, ...p]);
      setSessionId(created.id);
      setShowSessions(false);
    }
  };

  const renameSession = async (id: string, title: string) => {
    if (!title.trim()) return;
    const { error } = await supabase
      .from("chat_sessions")
      .update({ title: title.trim() })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      setSessions((p) => p.map((s) => (s.id === id ? { ...s, title: title.trim() } : s)));
      setEditingId(null);
    }
  };

  const removeSession = async (id: string) => {
    await supabase.from("chat_messages").delete().eq("session_id", id);
    const { error } = await supabase.from("chat_sessions").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    const remaining = sessions.filter((s) => s.id !== id);
    setSessions(remaining);
    if (sessionId === id) {
      if (remaining[0]) setSessionId(remaining[0].id);
      else {
        // create fresh
        if (user) {
          const { data: created } = await supabase
            .from("chat_sessions")
            .insert({ user_id: user.id, title: "Новая сессия" })
            .select("id, title, updated_at")
            .single();
          if (created) {
            setSessions([created as Session]);
            setSessionId(created.id);
          }
        }
      }
    }
    setDeleteId(null);
    toast.success("Сессия удалена");
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

      setMessages((p) =>
        p.map((m) => (m.id === "streaming" ? { ...m, id: crypto.randomUUID() } : m)),
      );
      // bump updated_at locally
      setSessions((p) =>
        [...p]
          .map((s) =>
            s.id === sessionId ? { ...s, updated_at: new Date().toISOString() } : s,
          )
          .sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at)),
      );
      bumpAutoExtract();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Сеть недоступна");
    } finally {
      setStreaming(false);
    }
  };

  // Group sessions by recency bucket
  const groupedSessions = useMemo(() => {
    const q = sessionSearch.trim().toLowerCase();
    const filtered = q
      ? sessions.filter((s) => s.title.toLowerCase().includes(q))
      : sessions;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekStart = new Date(today);
    const dow = (today.getDay() + 6) % 7; // Mon = 0
    weekStart.setDate(weekStart.getDate() - dow);

    const groups: Record<string, Session[]> = {
      "Сегодня": [],
      "Вчера": [],
      "На этой неделе": [],
      "Раньше": [],
    };
    for (const s of filtered) {
      const d = new Date(s.updated_at);
      if (d >= today) groups["Сегодня"].push(s);
      else if (d >= yesterday) groups["Вчера"].push(s);
      else if (d >= weekStart) groups["На этой неделе"].push(s);
      else groups["Раньше"].push(s);
    }
    return groups;
  }, [sessions, sessionSearch]);

  const renderSessionItem = (s: Session) => (
    <div
      key={s.id}
      className={cn(
        "group flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm transition-colors",
        s.id === sessionId ? "bg-primary/15 text-primary" : "hover:bg-muted",
      )}
    >
      {editingId === s.id ? (
        <>
          <Input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") renameSession(s.id, editTitle);
              if (e.key === "Escape") setEditingId(null);
            }}
            className="h-7 text-sm"
            autoFocus
          />
          <button onClick={() => renameSession(s.id, editTitle)} className="p-1 hover:text-primary">
            <Check className="size-3.5" />
          </button>
          <button onClick={() => setEditingId(null)} className="p-1 hover:text-destructive">
            <X className="size-3.5" />
          </button>
        </>
      ) : (
        <>
          <button
            onClick={() => {
              setSessionId(s.id);
              setShowSessions(false);
            }}
            className="flex-1 flex items-center gap-2 min-w-0 text-left"
          >
            <MessageCircle className="size-3.5 shrink-0 opacity-60" />
            <span className="truncate">{s.title}</span>
          </button>
          <button
            onClick={() => {
              setEditingId(s.id);
              setEditTitle(s.title);
            }}
            className="p-1 opacity-0 group-hover:opacity-100 hover:text-primary transition-opacity"
            aria-label="Переименовать"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            onClick={() => setDeleteId(s.id)}
            className="p-1 opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
            aria-label="Удалить"
          >
            <Trash2 className="size-3.5" />
          </button>
        </>
      )}
    </div>
  );

  const SessionList = (
    <div className="space-y-2">
      <Button
        onClick={newSession}
        variant="outline"
        size="sm"
        className="w-full justify-start rounded-lg"
      >
        <Plus className="size-4 mr-1.5" /> Новая сессия
      </Button>
      <div className="relative">
        <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={sessionSearch}
          onChange={(e) => setSessionSearch(e.target.value)}
          placeholder="Поиск сессий"
          className="h-8 text-sm pl-8 rounded-lg"
        />
      </div>
      {Object.entries(groupedSessions).map(([label, list]) =>
        list.length === 0 ? null : (
          <div key={label} className="space-y-1">
            <p className="mono text-[9px] uppercase tracking-widest text-muted-foreground px-2 pt-1">
              {label}
            </p>
            {list.map(renderSessionItem)}
          </div>
        ),
      )}
      {sessionSearch && Object.values(groupedSessions).every((g) => g.length === 0) && (
        <p className="text-xs text-muted-foreground text-center py-3">Ничего не найдено</p>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-5rem)]">
      <PageHeader
        eyebrow="ai · с памятью"
        title="Психолог"
        description="Говори свободно. AI помнит контекст и может обновлять твои статы."
      >
        <div className="flex flex-wrap gap-1">
          <Button
            size="sm"
            variant="outline"
            className="md:hidden"
            onClick={() => setShowSessions((v) => !v)}
          >
            <MessageCircle className="size-4" />
          </Button>
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

      <div className="grid md:grid-cols-[220px,1fr] gap-3 flex-1 min-h-0">
        {/* Sessions sidebar (desktop) */}
        <Card className="ios-card p-2 hidden md:block overflow-y-auto">{SessionList}</Card>

        {/* Sessions overlay (mobile) */}
        {showSessions && (
          <Card className="ios-card p-2 md:hidden absolute z-40 inset-x-4 top-32 max-h-[60vh] overflow-y-auto">
            {SessionList}
          </Card>
        )}

        <Card className="ios-card flex-1 flex flex-col overflow-hidden min-h-0">
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
              <Button
                onClick={send}
                size="icon"
                className="shrink-0 size-11 rounded-full"
                disabled={streaming || !input.trim()}
              >
                <Send className="size-4" />
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить сессию?</AlertDialogTitle>
            <AlertDialogDescription>
              Сообщения этой сессии будут стёрты навсегда.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && removeSession(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Chat;
