// «Карта жизни» — заменяет старый force-граф.
// Состоит из 3 слоёв:
//   1. Рейтинг «Заряжает / Истощает» — корреляция упоминания сущности с твоим mood
//   2. Эмоциональный ландшафт — heatmap эмоций по дням + топ-триггеры
//   3. Карта связей — структурированная сетка по 4 секторам (без физики), кликабельная
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, RefreshCw, TrendingUp, TrendingDown, Flame, Waves } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type EntityType = "event" | "person" | "topic" | "emotion";

interface DbEntity {
  id: string;
  type: EntityType;
  label: string;
  mentions: number;
  last_seen_at: string;
}
interface DbEdge {
  id: string;
  a_id: string;
  b_id: string;
  strength: number;
  last_seen_at: string;
}
interface PingRow {
  created_at: string;
  mood: number;
  note: string | null;
  activities: string[];
}
interface CheckinRow {
  created_at: string;
  mood: number | null;
  note: string | null;
  intent: string | null;
  tags: string[];
}

const TYPE_LABEL: Record<EntityType, string> = {
  event: "События",
  person: "Люди",
  topic: "Темы",
  emotion: "Эмоции",
};
const TYPE_TOKEN: Record<EntityType, string> = {
  person: "var(--stat-relationships)",
  event: "var(--ring-exercise)",
  topic: "var(--stat-career)",
  emotion: "var(--stat-emotions)",
};

const Graph = () => {
  const { user, session } = useAuth();
  const [entities, setEntities] = useState<DbEntity[]>([]);
  const [edges, setEdges] = useState<DbEdge[]>([]);
  const [pings, setPings] = useState<PingRow[]>([]);
  const [checkins, setCheckins] = useState<CheckinRow[]>([]);
  const [selected, setSelected] = useState<DbEntity | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [loading, setLoading] = useState(true);

  // === ЗАГРУЗКА ===
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const since = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString();
    Promise.all([
      supabase
        .from("graph_entities")
        .select("id,type,label,mentions,last_seen_at")
        .eq("user_id", user.id),
      supabase
        .from("graph_edges")
        .select("id,a_id,b_id,strength,last_seen_at")
        .eq("user_id", user.id),
      supabase
        .from("mood_pings")
        .select("created_at,mood,note,activities")
        .eq("user_id", user.id)
        .gte("created_at", since)
        .order("created_at", { ascending: true }),
      supabase
        .from("checkins")
        .select("created_at,mood,note,intent,tags")
        .eq("user_id", user.id)
        .gte("created_at", since)
        .order("created_at", { ascending: true }),
    ]).then(([e, ed, mp, ch]) => {
      setEntities(((e.data ?? []) as DbEntity[]).filter((x) => ["event", "person", "topic", "emotion"].includes(x.type)));
      setEdges((ed.data ?? []) as DbEdge[]);
      setPings((mp.data ?? []) as PingRow[]);
      setCheckins((ch.data ?? []) as CheckinRow[]);
      setLoading(false);
    });
  }, [user]);

  // === BASELINE MOOD ===
  const baseline = useMemo(() => {
    const all: number[] = [];
    pings.forEach((p) => all.push(p.mood));
    checkins.forEach((c) => c.mood != null && all.push(c.mood));
    if (!all.length) return null;
    return all.reduce((s, x) => s + x, 0) / all.length;
  }, [pings, checkins]);

  // === ВЛИЯНИЕ СУЩНОСТИ НА MOOD ===
  // Для каждой сущности считаем средний mood в дни, когда она упоминалась
  // (по тегам/note/activities/intent), и сравниваем с baseline.
  const impact = useMemo(() => {
    if (!entities.length || baseline == null) return [];
    const dayKey = (d: string) => d.slice(0, 10);
    const dayMood = new Map<string, number[]>();
    pings.forEach((p) => {
      const k = dayKey(p.created_at);
      if (!dayMood.has(k)) dayMood.set(k, []);
      dayMood.get(k)!.push(p.mood);
    });
    checkins.forEach((c) => {
      if (c.mood == null) return;
      const k = dayKey(c.created_at);
      if (!dayMood.has(k)) dayMood.set(k, []);
      dayMood.get(k)!.push(c.mood);
    });

    return entities
      .map((ent) => {
        const lc = ent.label.toLowerCase();
        // дни, в которых сущность упоминается
        const days = new Set<string>();
        pings.forEach((p) => {
          const hay = `${p.note ?? ""} ${p.activities.join(" ")}`.toLowerCase();
          if (hay.includes(lc)) days.add(dayKey(p.created_at));
        });
        checkins.forEach((c) => {
          const hay = `${c.note ?? ""} ${c.intent ?? ""} ${c.tags.join(" ")}`.toLowerCase();
          if (hay.includes(lc)) days.add(dayKey(c.created_at));
        });
        // если нет прямых упоминаний — используем last_seen как «эпизод» (вес меньше)
        const moods: number[] = [];
        days.forEach((d) => {
          const arr = dayMood.get(d);
          if (arr) moods.push(...arr);
        });
        if (!moods.length) {
          // fallback: ничего не считаем — недостаточно данных
          return { ent, avg: null as number | null, delta: 0, n: 0 };
        }
        const avg = moods.reduce((s, x) => s + x, 0) / moods.length;
        return { ent, avg, delta: avg - baseline, n: moods.length };
      })
      .filter((x) => x.n >= 1);
  }, [entities, pings, checkins, baseline]);

  const charging = impact
    .filter((x) => x.delta > 0.2)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 6);
  const draining = impact
    .filter((x) => x.delta < -0.2)
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 6);

  // === ЭМОЦИОНАЛЬНЫЙ ЛАНДШАФТ ===
  // Heatmap: для каждой эмоции — её "интенсивность" по дням (упоминания × magnitude).
  const emotions = entities.filter((e) => e.type === "emotion");
  const days30 = useMemo(() => {
    const arr: string[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      arr.push(d.toISOString().slice(0, 10));
    }
    return arr;
  }, []);
  const emotionHeat = useMemo(() => {
    // Map<emotionId, Map<dayKey, intensity>>
    const map = new Map<string, Map<string, number>>();
    emotions.forEach((e) => map.set(e.id, new Map()));
    const bump = (id: string, day: string, w = 1) => {
      const m = map.get(id);
      if (!m) return;
      m.set(day, (m.get(day) ?? 0) + w);
    };
    const consider = (text: string, day: string, weight = 1) => {
      const lc = text.toLowerCase();
      emotions.forEach((e) => {
        if (lc.includes(e.label.toLowerCase())) bump(e.id, day, weight);
      });
    };
    pings.forEach((p) => {
      const day = p.created_at.slice(0, 10);
      consider(`${p.note ?? ""} ${p.activities.join(" ")}`, day, 1);
    });
    checkins.forEach((c) => {
      const day = c.created_at.slice(0, 10);
      consider(`${c.note ?? ""} ${c.intent ?? ""} ${c.tags.join(" ")}`, day, 1.5);
    });
    return map;
  }, [emotions, pings, checkins]);

  // Триггеры эмоции — что чаще всего упоминается в один день с ней
  const triggersFor = (emoId: string) => {
    const emo = entities.find((e) => e.id === emoId);
    if (!emo) return [] as { ent: DbEntity; count: number }[];
    const heat = emotionHeat.get(emoId);
    if (!heat) return [];
    const emoDays = new Set(Array.from(heat.keys()));
    const counts = new Map<string, number>();
    const consider = (text: string, day: string) => {
      if (!emoDays.has(day)) return;
      const lc = text.toLowerCase();
      entities.forEach((e) => {
        if (e.id === emoId || e.type === "emotion") return;
        if (lc.includes(e.label.toLowerCase())) {
          counts.set(e.id, (counts.get(e.id) ?? 0) + 1);
        }
      });
    };
    pings.forEach((p) =>
      consider(`${p.note ?? ""} ${p.activities.join(" ")}`, p.created_at.slice(0, 10)),
    );
    checkins.forEach((c) =>
      consider(
        `${c.note ?? ""} ${c.intent ?? ""} ${c.tags.join(" ")}`,
        c.created_at.slice(0, 10),
      ),
    );
    return Array.from(counts.entries())
      .map(([id, count]) => ({ ent: entities.find((e) => e.id === id)!, count }))
      .filter((x) => x.ent)
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  };

  // === КАРТА СВЯЗЕЙ — структурированная по секторам ===
  const grouped = useMemo(() => {
    const g: Record<EntityType, DbEntity[]> = { person: [], event: [], topic: [], emotion: [] };
    entities.forEach((e) => g[e.type]?.push(e));
    (Object.keys(g) as EntityType[]).forEach((k) =>
      g[k].sort((a, b) => b.mentions - a.mentions),
    );
    return g;
  }, [entities]);

  const neighbors = (id: string) => {
    return edges
      .filter((e) => e.a_id === id || e.b_id === id)
      .map((e) => ({
        edge: e,
        other: entities.find((n) => n.id === (e.a_id === id ? e.b_id : e.a_id))!,
      }))
      .filter((x) => x.other);
  };

  const isLinkedToSelected = (id: string) => {
    if (!selected) return false;
    if (id === selected.id) return true;
    return edges.some(
      (e) =>
        (e.a_id === selected.id && e.b_id === id) ||
        (e.b_id === selected.id && e.a_id === id),
    );
  };

  // === AI EXTRACT ===
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
      if (!resp.ok) toast.error(json.error || "Не удалось извлечь");
      else {
        toast.success(json.entities ? `Найдено: ${json.entities} узлов` : "Готово");
        // reload
        if (user) {
          const { data: ents } = await supabase
            .from("graph_entities")
            .select("id,type,label,mentions,last_seen_at")
            .eq("user_id", user.id);
          setEntities((ents ?? []) as DbEntity[]);
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
        eyebrow="карта жизни"
        title="Граф"
        description="Что заряжает, что истощает, какие эмоции живут с тобой и что их вызывает."
      >
        <Button onClick={extractNow} disabled={extracting} size="sm" className="rounded-full">
          {extracting ? (
            <>
              <RefreshCw className="size-4 mr-1.5 animate-spin" /> Анализирую…
            </>
          ) : (
            <>
              <Sparkles className="size-4 mr-1.5" /> Обновить из AI
            </>
          )}
        </Button>
      </PageHeader>

      {loading ? (
        <p className="text-sm text-muted-foreground">Собираю карту…</p>
      ) : entities.length === 0 ? (
        <Card className="ios-card p-8 text-center">
          <Sparkles className="size-10 text-primary/60 mb-3 mx-auto" />
          <p className="font-medium mb-1">Карта пустая</p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Сделай несколько чек-инов с заметками или поговори с психологом — и нажми «Обновить
            из AI».
          </p>
        </Card>
      ) : (
        <div className="space-y-5">
          {/* === 1. ЗАРЯЖАЕТ / ИСТОЩАЕТ === */}
          <div className="grid md:grid-cols-2 gap-4">
            <ImpactCard
              title="Заряжает"
              icon={<Flame className="size-4" />}
              tone="up"
              items={charging}
              baseline={baseline}
              onPick={(e) => setSelected(e)}
            />
            <ImpactCard
              title="Истощает"
              icon={<Waves className="size-4" />}
              tone="down"
              items={draining}
              baseline={baseline}
              onPick={(e) => setSelected(e)}
            />
          </div>

          {/* === 2. ЭМОЦИОНАЛЬНЫЙ ЛАНДШАФТ === */}
          <Card className="ios-card p-5">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-lg font-semibold tracking-tight">Эмоциональный ландшафт</h2>
              <span className="text-xs text-muted-foreground">последние 30 дней</span>
            </div>
            {emotions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Эмоции ещё не извлечены. Нажми «Обновить из AI».
              </p>
            ) : (
              <div className="space-y-2.5">
                {emotions.map((e) => {
                  const heat = emotionHeat.get(e.id) ?? new Map();
                  const max = Math.max(1, ...Array.from(heat.values() as Iterable<number>));
                  const trig = triggersFor(e.id);
                  return (
                    <div
                      key={e.id}
                      className={cn(
                        "rounded-xl p-3 border transition-colors cursor-pointer",
                        selected?.id === e.id
                          ? "border-primary/60 bg-primary/5"
                          : "border-border/60 hover:border-border",
                      )}
                      onClick={() => setSelected(e)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="size-2.5 rounded-full"
                            style={{ background: `hsl(${TYPE_TOKEN.emotion})` }}
                          />
                          <span className="font-medium">{e.label}</span>
                          <span className="text-[11px] text-muted-foreground">
                            {e.mentions} упоминаний
                          </span>
                        </div>
                        {trig.length > 0 && (
                          <div className="hidden sm:flex items-center gap-1.5 flex-wrap justify-end">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                              триггеры:
                            </span>
                            {trig.map((t) => (
                              <Badge
                                key={t.ent.id}
                                variant="outline"
                                className="text-[10px] py-0 px-1.5"
                                style={{
                                  borderColor: `hsl(${TYPE_TOKEN[t.ent.type]} / 0.4)`,
                                }}
                              >
                                {t.ent.label}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      {/* heatmap-полоска */}
                      <div className="grid gap-[2px]" style={{ gridTemplateColumns: `repeat(${days30.length}, minmax(0, 1fr))` }}>
                        {days30.map((d) => {
                          const v = heat.get(d) ?? 0;
                          const op = v === 0 ? 0.06 : 0.18 + (v / max) * 0.82;
                          return (
                            <div
                              key={d}
                              className="h-5 rounded-[2px]"
                              style={{
                                background: `hsl(${TYPE_TOKEN.emotion} / ${op})`,
                              }}
                              title={`${d}: ${v}`}
                            />
                          );
                        })}
                      </div>
                      {/* триггеры на мобиле */}
                      {trig.length > 0 && (
                        <div className="sm:hidden flex items-center gap-1.5 flex-wrap mt-2">
                          {trig.map((t) => (
                            <Badge
                              key={t.ent.id}
                              variant="outline"
                              className="text-[10px] py-0 px-1.5"
                            >
                              {t.ent.label}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* === 3. КАРТА СВЯЗЕЙ === */}
          <Card className="ios-card p-5">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-lg font-semibold tracking-tight">Карта связей</h2>
              <span className="text-xs text-muted-foreground">
                {entities.length} узлов · {edges.length} связей
              </span>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {(["person", "event", "topic", "emotion"] as EntityType[]).map((t) => (
                <Sector
                  key={t}
                  title={TYPE_LABEL[t]}
                  items={grouped[t]}
                  color={TYPE_TOKEN[t]}
                  selected={selected}
                  isLinked={isLinkedToSelected}
                  onPick={setSelected}
                />
              ))}
            </div>
            {selected && (
              <div className="mt-4 pt-4 border-t border-border/60">
                <div className="flex items-baseline justify-between mb-2">
                  <h3 className="font-semibold">
                    {selected.label}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      · {TYPE_LABEL[selected.type].toLowerCase()}
                    </span>
                  </h3>
                  <button
                    onClick={() => setSelected(null)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    очистить
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {neighbors(selected.id).length === 0 && (
                    <span className="text-xs text-muted-foreground">Нет связей</span>
                  )}
                  {neighbors(selected.id).map(({ edge, other }) => (
                    <button
                      key={edge.id}
                      onClick={() => setSelected(other)}
                      className="px-2 py-1 rounded-full text-xs border border-border/60 hover:border-primary/60 transition-colors"
                      style={{ background: `hsl(${TYPE_TOKEN[other.type]} / 0.08)` }}
                    >
                      {other.label}
                      <span className="ml-1.5 text-[10px] opacity-60">
                        {Math.round(Number(edge.strength) * 10) / 10}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </>
  );
};

// === ВНУТРЕННИЕ КОМПОНЕНТЫ ===

const ImpactCard = ({
  title,
  icon,
  tone,
  items,
  baseline,
  onPick,
}: {
  title: string;
  icon: React.ReactNode;
  tone: "up" | "down";
  items: { ent: DbEntity; avg: number | null; delta: number; n: number }[];
  baseline: number | null;
  onPick: (e: DbEntity) => void;
}) => {
  const accent = tone === "up" ? "var(--ring-exercise)" : "var(--stat-body)";
  const Trend = tone === "up" ? TrendingUp : TrendingDown;
  return (
    <Card className="ios-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className="size-7 rounded-lg flex items-center justify-center"
            style={{ background: `hsl(${accent} / 0.15)`, color: `hsl(${accent})` }}
          >
            {icon}
          </span>
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        </div>
        {baseline != null && (
          <span className="text-[11px] text-muted-foreground">
            base: <span className="tabular-nums">{baseline.toFixed(1)}</span>
          </span>
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Пока недостаточно данных. Делай чек-ины с заметками — и сущности проявятся здесь.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {items.map(({ ent, avg, delta, n }) => (
            <li key={ent.id}>
              <button
                onClick={() => onPick(ent)}
                className="w-full flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-secondary/50 transition-colors text-left"
              >
                <span
                  className="size-2 rounded-full shrink-0"
                  style={{ background: `hsl(${TYPE_TOKEN[ent.type]})` }}
                />
                <span className="font-medium truncate flex-1">{ent.label}</span>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {avg?.toFixed(1)} · {n}d
                </span>
                <span
                  className="flex items-center gap-0.5 text-xs font-medium tabular-nums"
                  style={{ color: `hsl(${accent})` }}
                >
                  <Trend className="size-3" />
                  {delta > 0 ? "+" : ""}
                  {delta.toFixed(1)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};

const Sector = ({
  title,
  items,
  color,
  selected,
  isLinked,
  onPick,
}: {
  title: string;
  items: DbEntity[];
  color: string;
  selected: DbEntity | null;
  isLinked: (id: string) => boolean;
  onPick: (e: DbEntity) => void;
}) => {
  return (
    <div className="rounded-xl border border-border/60 p-3 bg-card/40">
      <div className="flex items-center gap-2 mb-2">
        <span
          className="size-2 rounded-full"
          style={{ background: `hsl(${color})` }}
        />
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        <span className="ml-auto text-[11px] text-muted-foreground">{items.length}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.length === 0 && (
          <span className="text-xs text-muted-foreground/60">пусто</span>
        )}
        {items.map((e) => {
          const active = selected?.id === e.id;
          const linked = selected ? isLinked(e.id) : true;
          // size by mentions
          const scale = Math.min(1.4, 0.85 + e.mentions / 30);
          return (
            <button
              key={e.id}
              onClick={() => onPick(e)}
              className={cn(
                "rounded-full border transition-all whitespace-nowrap",
                active
                  ? "border-primary text-foreground"
                  : linked
                    ? "border-border/60 hover:border-primary/60"
                    : "border-border/40 opacity-30",
              )}
              style={{
                background: active
                  ? `hsl(${color} / 0.18)`
                  : linked
                    ? `hsl(${color} / 0.06)`
                    : "transparent",
                fontSize: `${Math.round(11 * scale)}px`,
                padding: `${Math.round(2 * scale)}px ${Math.round(8 * scale)}px`,
              }}
            >
              {e.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default Graph;
