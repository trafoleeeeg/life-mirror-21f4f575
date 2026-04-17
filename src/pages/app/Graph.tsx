// «Карта жизни» — главный экран Graph.
// Структура:
//   • Toolbar: период, добавить сущность, обновить из AI
//   • Рекомендации (если есть)
//   • Рейтинг «Заряжает / Истощает» с трендами ↑/↓ и закреплёнными наверху
//   • Сочетания (синергии и токсичные комбо)
//   • Эмоциональный ландшафт + триггеры
//   • Сравнение с предыдущим периодом
//   • Карта связей с подсветкой и группировкой
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import {
  Sparkles, RefreshCw, TrendingUp, TrendingDown, Flame, Waves, Pin,
  ArrowUpRight, ArrowDownRight, Minus, EyeOff, Lightbulb,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { DbEntity, DbEdge, PingRow, CheckinRow, EntityType } from "@/types/lifeMap";
import { TYPE_LABEL, TYPE_TOKEN, displayLabel } from "@/types/lifeMap";
import {
  computeBaseline, computeImpact, computeCombos, computeRecommendations,
  compareImpactPeriods, filterByDays, computeEntitySeries,
  type PeriodDays, type ImpactRow, type ComboRow, type EntitySeriesPoint,
} from "@/lib/lifeMap";
import { EntityManager } from "@/components/graph/EntityManager";
import { AddEntityDialog } from "@/components/graph/AddEntityDialog";
import { EntitySparkline } from "@/components/graph/EntitySparkline";

const PERIODS: PeriodDays[] = [7, 30, 60, 90];

const Graph = () => {
  const { user, session } = useAuth();
  const [entities, setEntities] = useState<DbEntity[]>([]);
  const [edges, setEdges] = useState<DbEdge[]>([]);
  const [pings, setPings] = useState<PingRow[]>([]);
  const [checkins, setCheckins] = useState<CheckinRow[]>([]);
  const [selected, setSelected] = useState<DbEntity | null>(null);
  const [managerEnt, setManagerEnt] = useState<DbEntity | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodDays>(() => {
    const saved = localStorage.getItem("lifemap.period");
    return (saved && PERIODS.includes(Number(saved) as PeriodDays) ? Number(saved) : 30) as PeriodDays;
  });
  const [showHidden, setShowHidden] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    localStorage.setItem("lifemap.period", String(period));
  }, [period]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    // Always fetch 90 days so we can compare periods
    const since = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
    Promise.all([
      supabase
        .from("graph_entities")
        .select("id,type,label,mentions,last_seen_at,pinned,hidden,category,custom_label")
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
      const ents = ((e.data ?? []) as DbEntity[]).filter((x) =>
        ["event", "person", "topic", "emotion"].includes(x.type),
      );
      setEntities(ents);
      setEdges((ed.data ?? []) as DbEdge[]);
      setPings((mp.data ?? []) as PingRow[]);
      setCheckins((ch.data ?? []) as CheckinRow[]);
      setLoading(false);
    });
  }, [user, reloadKey]);

  const reload = () => setReloadKey((k) => k + 1);

  // Filter to current period
  const periodPings = useMemo(() => filterByDays(pings, period), [pings, period]);
  const periodCheckins = useMemo(() => filterByDays(checkins, period), [checkins, period]);
  // Previous period (same window before)
  const prevPings = useMemo(() => {
    const cutoffNew = Date.now() - period * 86400_000;
    const cutoffOld = Date.now() - period * 2 * 86400_000;
    return pings.filter((p) => {
      const t = new Date(p.created_at).getTime();
      return t >= cutoffOld && t < cutoffNew;
    });
  }, [pings, period]);
  const prevCheckins = useMemo(() => {
    const cutoffNew = Date.now() - period * 86400_000;
    const cutoffOld = Date.now() - period * 2 * 86400_000;
    return checkins.filter((c) => {
      const t = new Date(c.created_at).getTime();
      return t >= cutoffOld && t < cutoffNew;
    });
  }, [checkins, period]);

  // Visible entities
  const visibleEntities = useMemo(
    () => entities.filter((e) => showHidden || !e.hidden),
    [entities, showHidden],
  );

  const baseline = useMemo(() => computeBaseline(periodPings, periodCheckins), [periodPings, periodCheckins]);
  const prevBaseline = useMemo(() => computeBaseline(prevPings, prevCheckins), [prevPings, prevCheckins]);

  const impact = useMemo(
    () => computeImpact(visibleEntities, periodPings, periodCheckins, baseline, period),
    [visibleEntities, periodPings, periodCheckins, baseline, period],
  );
  const prevImpact = useMemo(
    () => computeImpact(visibleEntities, prevPings, prevCheckins, prevBaseline, period),
    [visibleEntities, prevPings, prevCheckins, prevBaseline, period],
  );

  const pinned = impact.filter((r) => r.ent.pinned && r.n > 0);
  const charging = impact
    .filter((r) => !r.ent.pinned && r.delta > 0.2)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 6);
  const draining = impact
    .filter((r) => !r.ent.pinned && r.delta < -0.2)
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 6);

  const combos = useMemo(
    () => computeCombos(visibleEntities, periodPings, periodCheckins, baseline),
    [visibleEntities, periodPings, periodCheckins, baseline],
  );
  const synergies = combos.filter((c) => c.delta > 0.3).slice(0, 4);
  const toxic = combos.filter((c) => c.delta < -0.3).slice(0, 4);

  const recommendations = useMemo(
    () => computeRecommendations(impact, visibleEntities, periodPings, periodCheckins),
    [impact, visibleEntities, periodPings, periodCheckins],
  );

  const comparison = useMemo(() => compareImpactPeriods(impact, prevImpact), [impact, prevImpact]);

  // Серии mood + маркеры упоминаний для каждой видимой сущности (для sparkline / timeline)
  const seriesMap = useMemo(() => {
    const m = new Map<string, EntitySeriesPoint[]>();
    visibleEntities.forEach((e) => {
      m.set(e.id, computeEntitySeries(e, periodPings, periodCheckins, period));
    });
    return m;
  }, [visibleEntities, periodPings, periodCheckins, period]);

  // === Эмоциональный ландшафт ===
  const emotions = visibleEntities.filter((e) => e.type === "emotion");
  const days = useMemo(() => {
    const arr: string[] = [];
    for (let i = period - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      arr.push(d.toISOString().slice(0, 10));
    }
    return arr;
  }, [period]);

  const emotionHeat = useMemo(() => {
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
    periodPings.forEach((p) => consider(`${p.note ?? ""} ${p.activities.join(" ")}`, p.created_at.slice(0, 10), 1));
    periodCheckins.forEach((c) =>
      consider(`${c.note ?? ""} ${c.intent ?? ""} ${c.tags.join(" ")}`, c.created_at.slice(0, 10), 1.5),
    );
    return map;
  }, [emotions, periodPings, periodCheckins]);

  const triggersFor = (emoId: string) => {
    const heat = emotionHeat.get(emoId);
    if (!heat) return [] as { ent: DbEntity; count: number }[];
    const emoDays = new Set(Array.from(heat.keys()));
    const counts = new Map<string, number>();
    const consider = (text: string, day: string) => {
      if (!emoDays.has(day)) return;
      const lc = text.toLowerCase();
      visibleEntities.forEach((e) => {
        if (e.id === emoId || e.type === "emotion") return;
        if (lc.includes(e.label.toLowerCase())) counts.set(e.id, (counts.get(e.id) ?? 0) + 1);
      });
    };
    periodPings.forEach((p) => consider(`${p.note ?? ""} ${p.activities.join(" ")}`, p.created_at.slice(0, 10)));
    periodCheckins.forEach((c) =>
      consider(`${c.note ?? ""} ${c.intent ?? ""} ${c.tags.join(" ")}`, c.created_at.slice(0, 10)),
    );
    return Array.from(counts.entries())
      .map(([id, count]) => ({ ent: visibleEntities.find((e) => e.id === id)!, count }))
      .filter((x) => x.ent)
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  };

  // === Карта связей: группы (по категории если есть, иначе по типу) ===
  const grouped = useMemo(() => {
    const useCats = visibleEntities.some((e) => e.category);
    if (useCats) {
      const g = new Map<string, DbEntity[]>();
      visibleEntities.forEach((e) => {
        const key = e.category || `(${TYPE_LABEL[e.type]})`;
        if (!g.has(key)) g.set(key, []);
        g.get(key)!.push(e);
      });
      g.forEach((arr) => arr.sort((a, b) => b.mentions - a.mentions));
      return Array.from(g.entries());
    }
    const g: Record<EntityType, DbEntity[]> = { person: [], event: [], topic: [], emotion: [] };
    visibleEntities.forEach((e) => g[e.type]?.push(e));
    (Object.keys(g) as EntityType[]).forEach((k) => g[k].sort((a, b) => b.mentions - a.mentions));
    return (["person", "event", "topic", "emotion"] as EntityType[]).map(
      (t) => [TYPE_LABEL[t], g[t]] as [string, DbEntity[]],
    );
  }, [visibleEntities]);

  const isLinkedToSelected = (id: string) => {
    if (!selected) return false;
    if (id === selected.id) return true;
    return edges.some(
      (e) =>
        (e.a_id === selected.id && e.b_id === id) ||
        (e.b_id === selected.id && e.a_id === id),
    );
  };

  const neighbors = (id: string) =>
    edges
      .filter((e) => e.a_id === id || e.b_id === id)
      .map((e) => ({
        edge: e,
        other: visibleEntities.find((n) => n.id === (e.a_id === id ? e.b_id : e.a_id))!,
      }))
      .filter((x) => x.other);

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
        reload();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Сеть недоступна");
    } finally {
      setExtracting(false);
    }
  };

  const hiddenCount = entities.filter((e) => e.hidden).length;

  return (
    <>
      <PageHeader
        eyebrow="карта жизни"
        title="Граф"
        description="Что заряжает, что истощает, какие эмоции живут рядом и что их вызывает."
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <ToggleGroup
          type="single"
          value={String(period)}
          onValueChange={(v) => v && setPeriod(Number(v) as PeriodDays)}
          className="rounded-full border"
        >
          {PERIODS.map((d) => (
            <ToggleGroupItem key={d} value={String(d)} className="text-xs h-8 px-3 rounded-full">
              {d}д
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <AddEntityDialog onAdded={reload} />
        {hiddenCount > 0 && (
          <Button
            size="sm"
            variant="ghost"
            className="rounded-full text-xs"
            onClick={() => setShowHidden((v) => !v)}
          >
            <EyeOff className="size-3.5 mr-1" />
            {showHidden ? "Скрыть скрытые" : `Показать скрытые (${hiddenCount})`}
          </Button>
        )}
        <div className="ml-auto" />
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
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Собираю карту…</p>
      ) : entities.length === 0 ? (
        <Card className="ios-card p-8 text-center">
          <Sparkles className="size-10 text-primary/60 mb-3 mx-auto" />
          <p className="font-medium mb-1">Карта пустая</p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Сделай несколько чек-инов с заметками или поговори с психологом — и нажми «Обновить из AI».
            Или добавь сущность вручную.
          </p>
        </Card>
      ) : (
        <div className="space-y-5">
          {/* === РЕКОМЕНДАЦИИ === */}
          {recommendations.length > 0 && (
            <Card className="ios-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="size-7 rounded-lg flex items-center justify-center"
                  style={{ background: "hsl(var(--primary) / 0.15)", color: "hsl(var(--primary))" }}
                >
                  <Lightbulb className="size-4" />
                </span>
                <h2 className="text-base font-semibold tracking-tight">Что попробовать</h2>
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                {recommendations.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => setSelected(r.ent)}
                    className="text-left p-3 rounded-lg border border-border/60 hover:border-primary/60 transition-colors"
                  >
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <span
                        className="size-1.5 rounded-full"
                        style={{ background: `hsl(${TYPE_TOKEN[r.ent.type]})` }}
                      />
                      {r.message}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{r.detail}</div>
                  </button>
                ))}
              </div>
            </Card>
          )}

          {/* === PINNED === */}
          {pinned.length > 0 && (
            <Card className="ios-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Pin className="size-4 text-muted-foreground" />
                <h2 className="text-base font-semibold tracking-tight">Закреплённые</h2>
              </div>
              <ul className="space-y-1.5">
                {pinned.map((row) => (
                  <ImpactRowItem
                    key={row.ent.id}
                    row={row}
                    series={seriesMap.get(row.ent.id)}
                    onPick={(e) => setSelected(e)}
                    onEdit={(e) => setManagerEnt(e)}
                  />
                ))}
              </ul>
            </Card>
          )}

          {/* === ЗАРЯЖАЕТ / ИСТОЩАЕТ === */}
          <div className="grid md:grid-cols-2 gap-4">
            <ImpactCard
              title="Заряжает"
              icon={<Flame className="size-4" />}
              tone="up"
              items={charging}
              baseline={baseline}
              seriesMap={seriesMap}
              onPick={(e) => setSelected(e)}
              onEdit={(e) => setManagerEnt(e)}
            />
            <ImpactCard
              title="Истощает"
              icon={<Waves className="size-4" />}
              tone="down"
              items={draining}
              baseline={baseline}
              seriesMap={seriesMap}
              onPick={(e) => setSelected(e)}
              onEdit={(e) => setManagerEnt(e)}
            />
          </div>

          {/* === СОЧЕТАНИЯ === */}
          {(synergies.length > 0 || toxic.length > 0) && (
            <Card className="ios-card p-5">
              <h2 className="text-base font-semibold tracking-tight mb-3">Сочетания</h2>
              <div className="grid md:grid-cols-2 gap-3">
                <ComboList title="Синергии" tone="up" items={synergies} />
                <ComboList title="Токсичные комбо" tone="down" items={toxic} />
              </div>
            </Card>
          )}

          {/* === ЭМОЦИОНАЛЬНЫЙ ЛАНДШАФТ === */}
          <Card className="ios-card p-5">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-lg font-semibold tracking-tight">Эмоциональный ландшафт</h2>
              <span className="text-xs text-muted-foreground">{period} дн.</span>
            </div>
            {emotions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Эмоции ещё не извлечены. Нажми «Обновить из AI» или добавь вручную.
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
                      <div className="flex items-center justify-between mb-2 gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="size-2.5 rounded-full" style={{ background: `hsl(${TYPE_TOKEN.emotion})` }} />
                          <span className="font-medium truncate">{displayLabel(e)}</span>
                          <span className="text-[11px] text-muted-foreground shrink-0">{e.mentions}×</span>
                        </div>
                        {trig.length > 0 && (
                          <div className="hidden sm:flex items-center gap-1.5 flex-wrap justify-end">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">триггеры:</span>
                            {trig.map((t) => (
                              <Badge
                                key={t.ent.id}
                                variant="outline"
                                className="text-[10px] py-0 px-1.5"
                                style={{ borderColor: `hsl(${TYPE_TOKEN[t.ent.type]} / 0.4)` }}
                              >
                                {displayLabel(t.ent)}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="grid gap-[2px]" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
                        {days.map((d) => {
                          const v = heat.get(d) ?? 0;
                          const op = v === 0 ? 0.06 : 0.18 + (v / max) * 0.82;
                          return (
                            <div
                              key={d}
                              className="h-5 rounded-[2px]"
                              style={{ background: `hsl(${TYPE_TOKEN.emotion} / ${op})` }}
                              title={`${d}: ${v}`}
                            />
                          );
                        })}
                      </div>
                      {trig.length > 0 && (
                        <div className="sm:hidden flex items-center gap-1.5 flex-wrap mt-2">
                          {trig.map((t) => (
                            <Badge key={t.ent.id} variant="outline" className="text-[10px] py-0 px-1.5">
                              {displayLabel(t.ent)}
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

          {/* === СРАВНЕНИЕ ПЕРИОДОВ === */}
          {(comparison.rising.length + comparison.falling.length + comparison.newly.length + comparison.gone.length > 0) && (
            <Card className="ios-card p-5">
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-base font-semibold tracking-tight">Сравнение с прошлым периодом</h2>
                <span className="text-xs text-muted-foreground">vs предыдущие {period} дн.</span>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <ChangeBlock title="Растут" tone="up" items={comparison.rising} onPick={setSelected} />
                <ChangeBlock title="Падают" tone="down" items={comparison.falling} onPick={setSelected} />
                <NewlyGoneBlock title="Появились" items={comparison.newly} onPick={setSelected} />
                <NewlyGoneBlock title="Исчезли" items={comparison.gone} onPick={setSelected} muted />
              </div>
            </Card>
          )}

          {/* === КАРТА СВЯЗЕЙ === */}
          <Card className="ios-card p-5">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-lg font-semibold tracking-tight">Карта связей</h2>
              <span className="text-xs text-muted-foreground">
                {visibleEntities.length} узлов · {edges.length} связей
              </span>
            </div>
            <div className={cn("grid gap-3", grouped.length > 4 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4")}>
              {grouped.map(([title, items]) => (
                <Sector
                  key={title}
                  title={title}
                  items={items}
                  selected={selected}
                  isLinked={isLinkedToSelected}
                  onPick={setSelected}
                />
              ))}
            </div>
            {selected && (
              <div className="mt-4 pt-4 border-t border-border/60">
                <div className="flex items-baseline justify-between mb-2 gap-2 flex-wrap">
                  <h3 className="font-semibold flex items-center gap-2">
                    {selected.pinned && <Pin className="size-3.5 text-primary" />}
                    {displayLabel(selected)}
                    <span className="text-xs font-normal text-muted-foreground">
                      · {TYPE_LABEL[selected.type].toLowerCase()}
                    </span>
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setManagerEnt(selected)}
                      className="text-xs text-primary hover:underline"
                    >
                      настроить
                    </button>
                    <button
                      onClick={() => setSelected(null)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      очистить
                    </button>
                  </div>
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
                      {displayLabel(other)}
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

      <EntityManager
        entity={managerEnt}
        allEntities={entities}
        open={!!managerEnt}
        onClose={() => setManagerEnt(null)}
        onChanged={reload}
      />
    </>
  );
};

// === СУБ-КОМПОНЕНТЫ ===

const ImpactRowItem = ({
  row, onPick, onEdit,
}: { row: ImpactRow; onPick: (e: DbEntity) => void; onEdit: (e: DbEntity) => void }) => {
  const tone = row.delta >= 0 ? "var(--ring-exercise)" : "var(--stat-body)";
  const Trend = row.delta >= 0 ? TrendingUp : TrendingDown;
  const TrendArrow = row.trend > 0.3 ? ArrowUpRight : row.trend < -0.3 ? ArrowDownRight : Minus;
  const trendColor = row.trend > 0.3 ? "var(--ring-exercise)" : row.trend < -0.3 ? "var(--stat-body)" : "var(--muted-foreground)";
  return (
    <li className="group">
      <div className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-secondary/50 transition-colors">
        <button onClick={() => onPick(row.ent)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
          {row.ent.pinned && <Pin className="size-3 text-primary shrink-0" />}
          <span className="size-2 rounded-full shrink-0" style={{ background: `hsl(${TYPE_TOKEN[row.ent.type]})` }} />
          <span className="font-medium truncate flex-1">{displayLabel(row.ent)}</span>
          <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
            {row.avg?.toFixed(1)} · {row.daysCount}d
          </span>
          <span className="flex items-center gap-0.5 text-xs font-medium tabular-nums shrink-0" style={{ color: `hsl(${tone})` }}>
            <Trend className="size-3" />
            {row.delta > 0 ? "+" : ""}{row.delta.toFixed(1)}
          </span>
          <span
            title={`Тренд: ${row.trend > 0 ? "+" : ""}${row.trend.toFixed(1)}`}
            className="flex items-center text-[10px] tabular-nums shrink-0"
            style={{ color: `hsl(${trendColor})` }}
          >
            <TrendArrow className="size-3" />
          </span>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(row.ent); }}
          className="opacity-0 group-hover:opacity-100 text-[10px] text-muted-foreground hover:text-foreground transition-opacity shrink-0"
        >
          ⋯
        </button>
      </div>
    </li>
  );
};

const ImpactCard = ({
  title, icon, tone, items, baseline, onPick, onEdit,
}: {
  title: string;
  icon: React.ReactNode;
  tone: "up" | "down";
  items: ImpactRow[];
  baseline: number | null;
  onPick: (e: DbEntity) => void;
  onEdit: (e: DbEntity) => void;
}) => {
  const accent = tone === "up" ? "var(--ring-exercise)" : "var(--stat-body)";
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
          {items.map((row) => (
            <ImpactRowItem key={row.ent.id} row={row} onPick={onPick} onEdit={onEdit} />
          ))}
        </ul>
      )}
    </Card>
  );
};

const ComboList = ({ title, tone, items }: { title: string; tone: "up" | "down"; items: ComboRow[] }) => {
  const accent = tone === "up" ? "var(--ring-exercise)" : "var(--stat-body)";
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{title}</div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground/70">Не найдено</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((c, i) => (
            <li key={i} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/30">
              <span className="text-sm font-medium truncate flex-1">
                {displayLabel(c.a)} <span className="text-muted-foreground">+</span> {displayLabel(c.b)}
              </span>
              <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                {c.coDays}d
              </span>
              <span className="text-xs font-medium tabular-nums shrink-0" style={{ color: `hsl(${accent})` }}>
                {c.delta > 0 ? "+" : ""}{c.delta.toFixed(1)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const ChangeBlock = ({
  title, tone, items, onPick,
}: {
  title: string;
  tone: "up" | "down";
  items: { ent: DbEntity; cur: number; prev: number; diff: number }[];
  onPick: (e: DbEntity) => void;
}) => {
  const accent = tone === "up" ? "var(--ring-exercise)" : "var(--stat-body)";
  const Arrow = tone === "up" ? ArrowUpRight : ArrowDownRight;
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{title}</div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground/70">Стабильно</p>
      ) : (
        <ul className="space-y-1">
          {items.map((m) => (
            <li key={m.ent.id}>
              <button
                onClick={() => onPick(m.ent)}
                className="w-full flex items-center gap-2 text-sm hover:bg-secondary/40 p-1.5 rounded transition-colors"
              >
                <span className="size-1.5 rounded-full" style={{ background: `hsl(${TYPE_TOKEN[m.ent.type]})` }} />
                <span className="truncate flex-1 text-left">{displayLabel(m.ent)}</span>
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {m.prev > 0 ? "+" : ""}{m.prev.toFixed(1)} → {m.cur > 0 ? "+" : ""}{m.cur.toFixed(1)}
                </span>
                <span className="flex items-center gap-0.5 text-xs font-medium tabular-nums" style={{ color: `hsl(${accent})` }}>
                  <Arrow className="size-3" />{Math.abs(m.diff).toFixed(1)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const NewlyGoneBlock = ({
  title, items, onPick, muted,
}: { title: string; items: DbEntity[]; onPick: (e: DbEntity) => void; muted?: boolean }) => (
  <div>
    <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{title}</div>
    {items.length === 0 ? (
      <p className="text-xs text-muted-foreground/70">—</p>
    ) : (
      <div className="flex flex-wrap gap-1.5">
        {items.map((e) => (
          <button
            key={e.id}
            onClick={() => onPick(e)}
            className={cn(
              "px-2 py-0.5 rounded-full text-xs border transition-colors",
              muted ? "opacity-60" : "",
            )}
            style={{
              background: `hsl(${TYPE_TOKEN[e.type]} / 0.08)`,
              borderColor: `hsl(${TYPE_TOKEN[e.type]} / 0.3)`,
            }}
          >
            {displayLabel(e)}
          </button>
        ))}
      </div>
    )}
  </div>
);

const Sector = ({
  title, items, selected, isLinked, onPick,
}: {
  title: string;
  items: DbEntity[];
  selected: DbEntity | null;
  isLinked: (id: string) => boolean;
  onPick: (e: DbEntity) => void;
}) => (
  <div className="rounded-xl border border-border/60 p-3 bg-card/40">
    <div className="flex items-center gap-2 mb-2">
      <span className="text-xs uppercase tracking-wider text-muted-foreground truncate">{title}</span>
      <span className="ml-auto text-[11px] text-muted-foreground">{items.length}</span>
    </div>
    <div className="flex flex-wrap gap-1.5">
      {items.length === 0 && <span className="text-xs text-muted-foreground/60">пусто</span>}
      {items.map((e) => {
        const active = selected?.id === e.id;
        const linked = selected ? isLinked(e.id) : true;
        const scale = Math.min(1.4, 0.85 + e.mentions / 30);
        const color = TYPE_TOKEN[e.type];
        return (
          <button
            key={e.id}
            onClick={() => onPick(e)}
            className={cn(
              "rounded-full border transition-all whitespace-nowrap inline-flex items-center gap-1",
              active
                ? "border-primary text-foreground"
                : linked ? "border-border/60 hover:border-primary/60" : "border-border/40 opacity-30",
              e.hidden && "opacity-50 italic",
            )}
            style={{
              background: active ? `hsl(${color} / 0.18)` : linked ? `hsl(${color} / 0.06)` : "transparent",
              fontSize: `${Math.round(11 * scale)}px`,
              padding: `${Math.round(2 * scale)}px ${Math.round(8 * scale)}px`,
            }}
          >
            {e.pinned && <Pin className="size-2.5 text-primary" />}
            {displayLabel(e)}
          </button>
        );
      })}
    </div>
  </div>
);

export default Graph;
