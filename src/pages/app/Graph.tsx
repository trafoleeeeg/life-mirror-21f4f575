import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";

interface Node {
  id: string;
  label: string;
  type: "event" | "person" | "topic" | "emotion";
  x: number;
  y: number;
  vx: number;
  vy: number;
}
interface Edge {
  a: string;
  b: string;
  strength: number;
}

const SEED_NODES: Omit<Node, "x" | "y" | "vx" | "vy">[] = [
  { id: "me", label: "Я", type: "topic" },
  { id: "work", label: "Работа", type: "topic" },
  { id: "anya", label: "Аня", type: "person" },
  { id: "fight", label: "Ссора 12.03", type: "event" },
  { id: "anxiety", label: "Тревога", type: "emotion" },
  { id: "run", label: "Утренний бег", type: "event" },
  { id: "calm", label: "Покой", type: "emotion" },
  { id: "money", label: "Деньги", type: "topic" },
  { id: "sasha", label: "Саша", type: "person" },
  { id: "gym", label: "Зал", type: "event" },
  { id: "energy", label: "Энергия", type: "emotion" },
  { id: "sleep", label: "Недосып", type: "event" },
];
const SEED_EDGES: Edge[] = [
  { a: "me", b: "work", strength: 1 },
  { a: "me", b: "anya", strength: 1 },
  { a: "anya", b: "fight", strength: 0.9 },
  { a: "fight", b: "anxiety", strength: 1 },
  { a: "work", b: "money", strength: 0.7 },
  { a: "money", b: "anxiety", strength: 0.6 },
  { a: "me", b: "run", strength: 0.8 },
  { a: "run", b: "calm", strength: 0.9 },
  { a: "me", b: "sasha", strength: 0.6 },
  { a: "sasha", b: "gym", strength: 0.7 },
  { a: "gym", b: "energy", strength: 0.8 },
  { a: "sleep", b: "anxiety", strength: 0.7 },
  { a: "me", b: "sleep", strength: 0.6 },
];

const TYPE_COLOR: Record<Node["type"], string> = {
  event: "hsl(var(--primary))",
  person: "hsl(var(--accent))",
  topic: "hsl(var(--growth))",
  emotion: "hsl(var(--tension))",
};

const Graph = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nodes, setNodes] = useState<Node[]>(() =>
    SEED_NODES.map((n) => ({
      ...n,
      x: 400 + (Math.random() - 0.5) * 300,
      y: 300 + (Math.random() - 0.5) * 200,
      vx: 0,
      vy: 0,
    })),
  );
  const [filter, setFilter] = useState<Node["type"] | "all">("all");
  const [selected, setSelected] = useState<Node | null>(null);
  const draggingRef = useRef<{ id: string; ox: number; oy: number } | null>(null);

  useEffect(() => {
    let raf = 0;
    const step = () => {
      setNodes((prev) => {
        const next = prev.map((n) => ({ ...n }));
        // repulsion
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
        // springs
        for (const e of SEED_EDGES) {
          const a = next.find((n) => n.id === e.a)!;
          const b = next.find((n) => n.id === e.b)!;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) + 0.01;
          const target = 120;
          const f = (dist - target) * 0.02 * e.strength;
          a.vx += (dx / dist) * f;
          a.vy += (dy / dist) * f;
          b.vx -= (dx / dist) * f;
          b.vy -= (dy / dist) * f;
        }
        // center pull + damping + integration
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
  }, []);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d")!;
    const w = cv.width;
    const h = cv.height;
    ctx.clearRect(0, 0, w, h);

    // edges
    for (const e of SEED_EDGES) {
      const a = nodes.find((n) => n.id === e.a);
      const b = nodes.find((n) => n.id === e.b);
      if (!a || !b) continue;
      const visible =
        filter === "all" || a.type === filter || b.type === filter || a.id === "me" || b.id === "me";
      ctx.strokeStyle = visible ? `hsla(188, 95%, 60%, ${0.15 + e.strength * 0.25})` : "hsla(220,15%,40%,0.08)";
      ctx.lineWidth = 0.5 + e.strength * 1.2;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // nodes
    for (const n of nodes) {
      const dim = filter !== "all" && n.type !== filter && n.id !== "me";
      const r = n.id === "me" ? 14 : 9;
      ctx.shadowBlur = dim ? 0 : 16;
      ctx.shadowColor = TYPE_COLOR[n.type];
      ctx.fillStyle = dim ? "hsla(220,15%,30%,0.5)" : TYPE_COLOR[n.type];
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = dim ? "hsla(220,15%,50%,0.6)" : "hsla(220,25%,92%,0.95)";
      ctx.font = `${n.id === "me" ? 13 : 11}px ui-sans-serif, system-ui`;
      ctx.textAlign = "center";
      ctx.fillText(n.label, n.x, n.y + r + 14);
    }
  }, [nodes, filter]);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * e.currentTarget.width;
    const y = ((e.clientY - rect.top) / rect.height) * e.currentTarget.height;
    const hit = nodes.find((n) => Math.hypot(n.x - x, n.y - y) < 18);
    if (hit) {
      draggingRef.current = { id: hit.id, ox: x - hit.x, oy: y - hit.y };
      setSelected(hit);
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!draggingRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * e.currentTarget.width;
    const y = ((e.clientY - rect.top) / rect.height) * e.currentTarget.height;
    setNodes((p) =>
      p.map((n) =>
        n.id === draggingRef.current!.id ? { ...n, x: x - draggingRef.current!.ox, y: y - draggingRef.current!.oy } : n,
      ),
    );
  };
  const onPointerUp = () => {
    draggingRef.current = null;
  };

  return (
    <>
      <PageHeader
        eyebrow="зеркало связей"
        title="Граф"
        description="События, люди, темы, эмоции — и связи между ними. Тяни узлы, чтобы исследовать."
      />

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
            {f === "all" ? "всё" : f}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1fr,260px] gap-4">
        <Card className="glass p-2 overflow-hidden">
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            className="w-full h-[500px] rounded-md cursor-grab active:cursor-grabbing"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          />
        </Card>

        <Card className="glass p-4">
          {selected ? (
            <div className="space-y-3">
              <div>
                <span
                  className="inline-block size-2 rounded-full mr-2 align-middle"
                  style={{ background: TYPE_COLOR[selected.type] }}
                />
                <span className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {selected.type}
                </span>
              </div>
              <h3 className="text-lg font-semibold">{selected.label}</h3>
              <p className="text-sm text-muted-foreground">
                Связан с {SEED_EDGES.filter((e) => e.a === selected.id || e.b === selected.id).length} узлами.
              </p>
              <div className="border-t border-border/60 pt-3">
                <p className="mono text-[10px] uppercase tracking-widest text-primary/80 mb-2">
                  паттерн
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  В дни после «{selected.label}» энергия в среднем ниже на 23%.{" "}
                  <span className="text-foreground/70">Гипотеза.</span>
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Кликни узел, чтобы увидеть детали и паттерны.</p>
          )}
        </Card>
      </div>
    </>
  );
};

export default Graph;
