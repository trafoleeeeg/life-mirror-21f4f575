// Mirror — единый главный экран с DnD-блоками и popup-зонами.
// Порядок блоков сохраняется в localStorage('mirror.order.v1').
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Plus, History, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { defaultGlyphState, type GlyphState } from "@/components/glyph/GlyphAvatar";
import { BalanceWheel } from "@/components/balance/BalanceWheel";
import { MiniCheckin } from "@/components/mirror/MiniCheckin";
import { BulkCheckin } from "@/components/mirror/BulkCheckin";
import { DayPicker } from "@/components/mirror/DayPicker";
import { DayDetailCard } from "@/components/mirror/DayDetailCard";
import { DateRangePicker, presetToRange, type Preset } from "@/components/mirror/DateRangePicker";
import { MoodTrendChart } from "@/components/mirror/MoodTrendChart";
import { ActivityImpact } from "@/components/dashboard/ActivityImpact";
import { DailyBreakdown } from "@/components/dashboard/DailyBreakdown";
import { MoodKpis } from "@/components/dashboard/MoodKpis";
import { FocusInsights } from "@/components/mirror/FocusInsights";
import { SleepCorrelation } from "@/components/mirror/SleepCorrelation";
import { CheckinsList } from "@/components/mirror/CheckinsList";
import { SleepMiniCard } from "@/components/mirror/SleepMiniCard";
import { PopupCard } from "@/components/mirror/PopupCard";
import { SortableSection } from "@/components/mirror/SortableSection";
import { seedDemoData } from "@/lib/demoData";
import type { DateRange } from "react-day-picker";

import {
  DndContext, PointerSensor, useSensor, useSensors,
  closestCenter, type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";

const ORDER_KEY = "mirror.order.v1";
const DEFAULT_ORDER = [
  "kpi", "minirow", "focus", "analytics-header",
  "activity", "daily", "trend", "sleep-corr", "balance", "checkins",
] as const;
type SectionId = typeof DEFAULT_ORDER[number];

const Mirror = () => {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [stats, setStats] = useState<GlyphState>(defaultGlyphState);
  const [todayCount, setTodayCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [seeding, setSeeding] = useState(false);
  const [quickMode, setQuickMode] = useState<"none" | "single" | "bulk">("none");

  const [day, setDay] = useState<Date>(new Date());
  const [preset, setPreset] = useState<Preset>("30d");
  const [range, setRange] = useState<DateRange>(presetToRange("30d"));

  // DnD order
  const [order, setOrder] = useState<SectionId[]>(() => {
    try {
      const saved = localStorage.getItem(ORDER_KEY);
      if (!saved) return [...DEFAULT_ORDER];
      const parsed: SectionId[] = JSON.parse(saved);
      // ensure all default sections present (forward compat)
      const merged = [...parsed.filter((id) => DEFAULT_ORDER.includes(id))];
      DEFAULT_ORDER.forEach((id) => { if (!merged.includes(id)) merged.push(id); });
      return merged;
    } catch { return [...DEFAULT_ORDER]; }
  });

  useEffect(() => {
    localStorage.setItem(ORDER_KEY, JSON.stringify(order));
  }, [order]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setOrder((prev) => {
      const oldIdx = prev.indexOf(active.id as SectionId);
      const newIdx = prev.indexOf(over.id as SectionId);
      if (oldIdx < 0 || newIdx < 0) return prev;
      return arrayMove(prev, oldIdx, newIdx);
    });
  };

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const [{ data: profile }, { data: gs }, { count }] = await Promise.all([
        supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle(),
        supabase.from("glyph_stats")
          .select("body,mind,emotions,relationships,career,finance,creativity,meaning")
          .eq("user_id", user.id).order("recorded_at", { ascending: false })
          .limit(1).maybeSingle(),
        supabase.from("mood_pings").select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
      ]);
      setName(profile?.display_name ?? user.email?.split("@")[0] ?? "друг");
      if (gs) setStats(gs as GlyphState);
      setTodayCount(count ?? 0);
    })();
  }, [user, refreshKey]);

  const seedDemo = async () => {
    if (!user) return;
    setSeeding(true);
    try {
      const r = await seedDemoData(user.id);
      toast.success(`Загружено: ${r.pings} чек-инов, ${r.sleeps} ночей`);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка загрузки демо");
    } finally {
      setSeeding(false);
    }
  };

  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : preset === "90d" ? 90 : preset === "365d" ? 365 : 30;

  // Map id → JSX
  const sections: Record<SectionId, JSX.Element> = useMemo(() => ({
    kpi: <MoodKpis key={`kpi-${refreshKey}`} />,
    minirow: (
      <div className="grid sm:grid-cols-2 gap-3">
        <PopupCard
          icon={<History className="size-5" />}
          title="История"
          subtitle="Любая дата · детали дня"
          accentToken="--stat-emotions"
        >
          <div className="space-y-4">
            <DayPicker date={day} onChange={setDay} />
            <DayDetailCard date={day} key={`${day.toDateString()}-${refreshKey}`} />
          </div>
        </PopupCard>
        <SleepMiniCard refreshKey={refreshKey} onSaved={() => setRefreshKey((k) => k + 1)} />
      </div>
    ),
    focus: <FocusInsights days={7} key={`focus-${refreshKey}`} />,
    "analytics-header": (
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="mono text-[10px] uppercase tracking-widest text-muted-foreground">аналитика</p>
        <DateRangePicker range={range} onChange={setRange} preset={preset} onPresetChange={setPreset} />
      </div>
    ),
    activity: <ActivityImpact days={days} key={`act-${refreshKey}-${days}`} />,
    daily: <DailyBreakdown days={Math.min(days, 14)} key={`db-${refreshKey}-${days}`} />,
    trend: <MoodTrendChart range={range} key={`trend-${refreshKey}`} />,
    "sleep-corr": <SleepCorrelation days={Math.max(days, 30)} key={`corr-${refreshKey}-${days}`} />,
    balance: (
      <Card className="ios-card p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="mono text-[10px] uppercase tracking-widest text-muted-foreground">колесо баланса</p>
          <span className="mono text-[10px] text-muted-foreground">по чек-инам</span>
        </div>
        <div className="flex justify-center">
          <BalanceWheel state={stats} size={360} />
        </div>
      </Card>
    ),
    checkins: <CheckinsList refreshKey={refreshKey} />,
  }), [refreshKey, day, range, preset, days, stats]);

  return (
    <div className="space-y-5 pb-8">
      {/* Greeting */}
      <header className="flex items-end justify-between flex-wrap gap-3 animate-fade-in">
        <div>
          <p className="text-muted-foreground text-sm">Зеркало</p>
          <h1 className="text-3xl font-bold tracking-tight">
            Привет, {name} <span aria-hidden>👋</span>
          </h1>
        </div>
        <Button variant="outline" size="sm" onClick={seedDemo} disabled={seeding} className="rounded-full gap-2">
          <Sparkles className="size-3.5" />
          {seeding ? "Загружаю…" : "Демо-данные"}
        </Button>
      </header>

      {/* Quick check-in CTA + bulk toggle */}
      <Card className="ios-card p-4 animate-slide-up" style={{ animationDelay: "60ms", animationFillMode: "both" }}>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="size-10 rounded-full bg-primary/15 text-primary grid place-items-center shrink-0">
            <Plus className="size-5" />
          </div>
          <div className="flex-1 min-w-[140px]">
            <p className="font-semibold text-sm">Новый чек-ин</p>
            <p className="text-xs text-muted-foreground">
              {todayCount > 0 ? `Сегодня: ${todayCount} ${todayCount === 1 ? "запись" : "записей"}` : "Запиши настроение за минуту"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={quickMode === "single" ? "default" : "outline"}
              onClick={() => setQuickMode((m) => m === "single" ? "none" : "single")}
              className="rounded-full gap-1.5"
            >
              <Plus className="size-3.5" /> Один
            </Button>
            <Button
              size="sm"
              variant={quickMode === "bulk" ? "default" : "outline"}
              onClick={() => setQuickMode((m) => m === "bulk" ? "none" : "bulk")}
              className="rounded-full gap-1.5"
            >
              <ListChecks className="size-3.5" /> Несколько
            </Button>
          </div>
        </div>
      </Card>

      {quickMode === "single" && (
        <MiniCheckin onSaved={() => { setRefreshKey((k) => k + 1); setQuickMode("none"); }} />
      )}
      {quickMode === "bulk" && (
        <BulkCheckin onSaved={() => { setRefreshKey((k) => k + 1); setQuickMode("none"); }} />
      )}

      {/* DnD blocks */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={order as string[]} strategy={verticalListSortingStrategy}>
          <div className="space-y-5">
            {order.map((id, i) => (
              <SortableSection key={id} id={id}>
                <div
                  className="animate-slide-up"
                  style={{ animationDelay: `${120 + i * 40}ms`, animationFillMode: "both" }}
                >
                  {sections[id]}
                </div>
              </SortableSection>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
};

export default Mirror;
