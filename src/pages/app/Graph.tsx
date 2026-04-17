import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type EntityType = "event" | "person" | "topic" | "emotion";

interface DbEntity {
  id: string;
  type: EntityType;
  label: string;
  mentions: number;
}
interface DbEdge {
  id: string;
  a_id: string;
  b_id: string;
  strength: number;
}

interface Node extends DbEntity {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

const TYPE_COLOR: Record<EntityType, string> = {
  event: "hsl(var(--primary))",
  person: "hsl(var(--accent))",
  topic: "hsl(var(--growth))",
  emotion: "hsl(var(--tension))",
};

const TYPE_LABEL: Record<EntityType | "all", string> = {
  all: "всё",
  event: "события",
  person: "люди",
  topic: "темы",
  emotion: "эмоции",
};

const Graph = () => {
  const { user, session } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [entities, setEntities] = useState<DbEntity[]>([]);
  const [edges, setEdges] = useState<DbEdge[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [filter, setFilter] = useState<EntityType | "all">("all");
  const [selected, setSelected] = useState<Node | null>(null);
  const [extracting, setExtracting] = useState(false);
  const draggingRef = useRef<{ id: string; ox: number; oy: number } | null>(null);

  // Load from DB
  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: ents }, { data: eds }] = await Promise.all([
        supabase
          .from("graph_entities")
          .select("id, type, label, mentions")
          .eq("user_id", user.id),
        supabase.from("graph_edges").select("id, a_id, b_id, strength").eq("user_id", user.id),
      ]);
      const e = (ents || []) as DbEntity[];
      setEntities(e);
      setEdges((eds || []) as DbEdge[]);
      setNodes(
        e.map((n) => ({
          ...n,
          x: 400 + (Math.random() - 0.5) * 300,
          y: 300 + (Math.random() - 0.5) * 200,
          vx: 0,
          vy: 0,
        })),
      );
    })();
  }, [user]);

  // Physics
  useEffect(() => {
    if (!nodes.length) return;
    let raf = 0;
    const step = () => {
      setNodes((prev) => {
        const next = prev.map((n) => ({ ...n }));
        for (let i = 0; i < next.length; i++) {
          for (let j = i + 1; j < next.length; j++) {
            const dx = next[j].x - next[i].x;
            const dy = next[j].y - next[i].y;
            const d2 = dx * dx + dy * dy + 0.01;
            const f = 1800 / d2;
            const fx = (dx / Math.sqrt(d2)) * f;
            const fy = (dy / Math.sqrt(d2)) * f;
            next[i].vx -= fx;
            next[i].vy -= fy;
            next[j].vx += fx;
            next[j].vy += fy;
          }
        }
        for (const e of edges) {
          const a = next.find((n) => n.id === e.a_id);
          const b = next.find((n) => n.id === e.b_id);
          if (!a || !b) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) + 0.01;
          const target = 130;
          const f = (dist - target) * 0.02 * Number(e.strength);
          a.vx += (dx / dist) * f;
          a.vy += (dy / dist) * f;
          b.vx -= (dx / dist) * f;
          b.vy -= (dy / dist) * f;
        }
        for (const n of next) {
          if (draggingRef.current?.id === n.id) {
            n.vx = 0;
            n.vy = 0;
            continue;
          }
          n.vx += (400 - n.x) * 0.001;
          n.vy += (300 - n.y) * 0.001;
          n.vx *= 0.85;
          n.vy *= 0.85;
          n.x += n.vx;
          n.y += n.vy;
        }
        return next;
      });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [edges, nodes.length]);

  // Render
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d")!;
    const w = cv.width;
    const h = cv.height;
    ctx.clearRect(0, 0, w, h);

    for (const e of edges) {
      const a = nodes.find((n) => n.id === e.a_id);
      const b = nodes.find((n) => n.id === e.b_id);
      if (!a || !b) continue;
      const visible = filter === "all" || a.type === filter || b.type === filter;
      ctx.strokeStyle = visible
        ? `hsla(188, 95%, 60%, ${0.15 + Number(e.strength) * 0.25})`
        : "hsla(220,15%,40%,0.06)";
      ctx.lineWidth = 0.5 + Number(e.strength) * 1.5;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    for (const n of nodes) {
      const dim = filter !== "all" && n.type !== filter;
      const r = 8 + Math.min(8, n.mentions);
      ctx.shadowBlur = dim ? 0 : 16;
      ctx.shadowColor = TYPE_COLOR[n.type];
      ctx.fillStyle = dim ? "hsla(220,15%,30%,0.5)" : TYPE_COLOR[n.type];
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = dim ? "hsla(220,15%,50%,0.6)" : "hsla(220,25%,92%,0.95)";
      ctx.font = "11px ui-sans-serif, system-ui";
      ctx.textAlign = "center";
      ctx.fillText(n.label, n.x, n.y + r + 14);
    }
  }, [nodes, edges, filter]);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * e.currentTarget.width;
    const y = ((e.clientY - rect.top) / rect.height) * e.currentTarget.height;
    const hit = nodes.find((n) => Math.hypot(n.x - x, n.y - y) < 20);
    if (hit) {
      draggingRef.current = { id: hit.id, ox: x - hit.x, oy: y - hit.y };
      setSelected(hit);
      e.currentTarget.setPointerCapture(e.pointerId);
    } else {
      setSelected(null);
    }
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!draggingRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * e.currentTarget.width;
    const y = ((e.clientY - rect.top) / rect.height) * e.currentTarget.height;
    setNodes((p) =>
      p.map((n) =>
        n.id === draggingRef.current!.id
          ? { ...n, x: x - draggingRef.current!.ox, y: y - draggingRef.current!.oy }
          : n,
      ),
    );
  };
  const onPointerUp = () => {
    draggingRef.current = null;
  };

  const extractNow = async () => {
    if (!session) return;
    setExtracting(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-graph`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const json = await resp.json();
      if (!resp.ok) {
        toast.error(json.error || "Не удалось извлечь");
      } else if (!json.entities) {
        toast("Пока нет данных для графа", {
          description: "Сделай чек-ин или поговори с психологом.",
        });
      } else {
        toast.success(`Найдено: ${json.entities} узлов`, {
          description: "Граф обновлён.",
        });
        // reload
        if (user) {
          const [{ data: ents }, { data: eds }] = await Promise.all([
            supabase.from("graph_entities").select("id, type, label, mentions").eq("user_id", user.id),
            supabase.from("graph_edges").select("id, a_id, b_id, strength").eq("user_id", user.id),
          ]);
          const e = (ents || []) as DbEntity[];
          setEntities(e);
          setEdges((eds || []) as DbEdge[]);
          setNodes((prev) => {
            const map = new Map(prev.map((n) => [n.id, n]));
            return e.map((n) => {
              const old = map.get(n.id);
              return old
                ? { ...n, x: old.x, y: old.y, vx: old.vx, vy: old.vy }
                : {
                    ...n,
                    x: 400 + (Math.random() - 0.5) * 300,
                    y: 300 + (Math.random() - 0.5) * 200,
                    vx: 0,
                    vy: 0,
                  };
            });
          });
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Сеть недоступна");
    } finally {
      setExtracting(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="зеркало связей"
        title="Граф"
        description="Люди, события, темы, эмоции и связи — извлечены из твоих чек-инов и разговоров с AI."
      >
        <Button onClick={extractNow} disabled={extracting} size="sm" className="rounded-full">
          {extracting ? (
            <>
              <RefreshCw className="size-4 mr-1.5 animate-spin" />
              Анализирую…
            </>
          ) : (
            <>
              <Sparkles className="size-4 mr-1.5" />
              Обновить из AI
            </>
          )}
        </Button>
      </PageHeader>

      <div className="flex flex-wrap gap-2 mb-4">
        {(["all", "event", "person", "topic", "emotion"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
              filter === f
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border hover:border-primary/50"
            }`}
          >
            {TYPE_LABEL[f]}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground self-center">
          {entities.length} узлов · {edges.length} связей
        </span>
      </div>

      <div className="grid lg:grid-cols-[1fr,260px] gap-4">
        <Card className="ios-card p-2 overflow-hidden">
          {entities.length === 0 ? (
            <div className="h-[500px] flex flex-col items-center justify-center text-center px-6">
              <Sparkles className="size-10 text-primary/60 mb-3" />
              <p className="font-medium mb-1">Граф пуст</p>
              <p className="text-sm text-muted-foreground max-w-md">
                Сделай несколько чек-инов с заметками или поговори с психологом — и нажми «Обновить
                из AI». Я найду людей, события, темы и эмоции в твоих текстах и нарисую связи.
              </p>
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              width={800}
              height={600}
              className="w-full h-[500px] rounded-md cursor-grab active:cursor-grabbing"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            />
          )}
        </Card>

        <Card className="ios-card p-4">
          {selected ? (
            <div className="space-y-3">
              <div>
                <span
                  className="inline-block size-2 rounded-full mr-2 align-middle"
                  style={{ background: TYPE_COLOR[selected.type] }}
                />
                <span className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {TYPE_LABEL[selected.type]}
                </span>
              </div>
              <h3 className="text-lg font-semibold">{selected.label}</h3>
              <p className="text-sm text-muted-foreground">
                Упоминаний: <span className="text-foreground">{selected.mentions}</span>
                <br />
                Связан с {edges.filter((e) => e.a_id === selected.id || e.b_id === selected.id).length}{" "}
                узлами.
              </p>
              <div className="border-t border-border/60 pt-3">
                <p className="mono text-[10px] uppercase tracking-widest text-primary/80 mb-2">
                  ближайшие
                </p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {edges
                    .filter((e) => e.a_id === selected.id || e.b_id === selected.id)
                    .slice(0, 5)
                    .map((e) => {
                      const otherId = e.a_id === selected.id ? e.b_id : e.a_id;
                      const other = entities.find((n) => n.id === otherId);
                      if (!other) return null;
                      return (
                        <li key={e.id} className="flex items-center justify-between">
                          <span>{other.label}</span>
                          <span className="mono opacity-70">
                            {Math.round(Number(e.strength) * 100)}%
                          </span>
                        </li>
                      );
                    })}
                </ul>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Кликни узел, чтобы увидеть детали и ближайшие связи.
            </p>
          )}
        </Card>
      </div>
    </>
  );
};

export default Graph;
