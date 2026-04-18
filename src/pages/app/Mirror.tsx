// Mirror — главная страница.
// Новый порядок (по умолчанию): колесо → CTA чек-ин → активности → тренды → корреляция сна → история-popup → компактные KPI.
// История-popup внутри содержит и календарь дня, и список «по дням».
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Plus, History, ListChecks, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { BalanceWheelAuto } from "@/components/balance/BalanceWheelAuto";
import { SpheresEditor } from "@/components/balance/SpheresEditor";
import { MiniCheckin } from "@/components/mirror/MiniCheckin";
import { BulkCheckin } from "@/components/mirror/BulkCheckin";
import { DayPicker } from "@/components/mirror/DayPicker";
import { DayDetailCard } from "@/components/mirror/DayDetailCard";
import { DateRangePicker, presetToRange, type Preset } from "@/components/mirror/DateRangePicker";
import { MoodTrendChart } from "@/components/mirror/MoodTrendChart";
import { ActivityImpact } from "@/components/dashboard/ActivityImpact";
import { DailyBreakdown } from "@/components/dashboard/DailyBreakdown";
import { CompactKpis } from "@/components/dashboard/CompactKpis";
import { FocusInsights } from "@/components/mirror/FocusInsights";
import { MorningForecast } from "@/components/dashboard/MorningForecast";
import { SleepCorrelation } from "@/components/mirror/SleepCorrelation";
import { SleepMiniCard } from "@/components/mirror/SleepMiniCard";
import { PopupCard } from "@/components/mirror/PopupCard";
import { SortableSection } from "@/components/mirror/SortableSection";
import { seedDemoData } from "@/lib/demoData";
import type { DateRange } from "react-day-picker";

import {
  DndContext, PointerSensor, TouchSensor, MouseSensor, useSensor, useSensors,
  closestCenter, DragOverlay, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";

const ORDER_KEY = "mirror.order.v2";
const DEFAULT_ORDER = [
  "forecast", "balance", "focus", "analytics-header",
  "activity", "trend", "sleep-corr", "history-row", "kpi",
] as const;
type SectionId = typeof DEFAULT_ORDER[number];

const Mirror = () => {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [todayCount, setTodayCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [seeding, setSeeding] = useState(false);
  const [quickMode, setQuickMode] = useState<"none" | "single" | "bulk">("none");

  const [day, setDay] = useState<Date>(new Date());
  const [preset, setPreset] = useState<Preset>("30d");
  const [range, setRange] = useState<DateRange>(presetToRange("30d"));

  const [order, setOrder] = useState<SectionId[]>(() => {
    try {
      const saved = localStorage.getItem(ORDER_KEY);
      if (!saved) return [...DEFAULT_ORDER];
      const parsed: SectionId[] = JSON.parse(saved);
      const merged = [...parsed.filter((id) => DEFAULT_ORDER.includes(id))];
      DEFAULT_ORDER.forEach((id) => { if (!merged.includes(id)) merged.push(id); });
      return merged;
    } catch { return [...DEFAULT_ORDER]; }
  });
  useEffect(() => { localStorage.setItem(ORDER_KEY, JSON.stringify(order)); }, [order]);

  // DnD активируется ТОЛЬКО через ручку (GripVertical слева). На мобиле long-press
  // по карточке убран — он конфликтовал со скроллом. Drag handle есть и на десктопе,
  // и на мобиле — поведение единое.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
  );
  const [activeId, setActiveId] = useState<SectionId | null>(null);
  const onDragStart = (e: DragStartEvent) => {
    setActiveId(e.active.id as SectionId);
    document.body.classList.add("dnd-dragging");
  };
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    document.body.classList.remove("dnd-dragging");
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setOrder((prev) => {
      const oldIdx = prev.indexOf(active.id as SectionId);
      const newIdx = prev.indexOf(over.id as SectionId);
      if (oldIdx < 0 || newIdx < 0) return prev;
      return arrayMove(prev, oldIdx, newIdx);
    });
  };
  const onDragCancel = () => {
    setActiveId(null);
    document.body.classList.remove("dnd-dragging");
  };

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const [{ data: profile }, { count }] = await Promise.all([
        supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle(),
        supabase.from("mood_pings").select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
      ]);
      setName(profile?.display_name ?? user.email?.split("@")[0] ?? "друг");
      setTodayCount(count ?? 0);
    })();
  }, [user, refreshKey]);

  const seedDemo = async () => {
    if (!user) return;
    setSeeding(true);
    try {
      const r = await seedDemoData(user.id);
      toast.success(`Демо: ${r.pings} чек-инов, ${r.sleeps} ночей, ${r.users} юзеров, ${r.posts} постов`);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка загрузки демо");
    } finally {
      setSeeding(false);
    }
  };

  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : preset === "90d" ? 90 : preset === "365d" ? 365 : 30;

  const sections: Record<SectionId, JSX.Element> = useMemo(() => ({
    forecast: <MorningForecast key={`forecast-${refreshKey}`} />,
    balance: (
      <Card className="ios-card p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
            колесо баланса
          </p>
          <PopupCard
            icon={<Settings2 className="size-4" />}
            title="Сферы"
            subtitle="Добавляй и настраивай"
            accentToken="--primary"
          >
            <h2 className="text-xl font-bold mb-1">Сферы баланса</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Добавляй свои сферы и привязывай к ним ключевые слова. Когда отметишь активность с таким словом — она автоматически попадёт в эту сферу.
            </p>
            <SpheresEditor />
          </PopupCard>
        </div>
        <div className="flex justify-center">
          <BalanceWheelAuto size={380} refreshKey={refreshKey} />
        </div>
      </Card>
    ),
    focus: <FocusInsights days={7} key={`focus-${refreshKey}`} />,
    "analytics-header": (
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="mono text-[10px] uppercase tracking-widest text-muted-foreground">аналитика</p>
        <DateRangePicker range={range} onChange={setRange} preset={preset} onPresetChange={setPreset} />
      </div>
    ),
    activity: <ActivityImpact days={days} key={`act-${refreshKey}-${days}`} />,
    trend: <MoodTrendChart range={range} key={`trend-${refreshKey}`} />,
    "sleep-corr": <SleepCorrelation days={Math.max(days, 30)} key={`corr-${refreshKey}-${days}`} />,
    "history-row": (
      <div className="grid sm:grid-cols-2 gap-3">
        <PopupCard
          icon={<History className="size-5" />}
          title="История"
          subtitle="Календарь · разбивка по дням"
          accentToken="--stat-emotions"
        >
          <h2 className="text-xl font-bold mb-3">История</h2>
          <div className="space-y-5">
            <div>
              <p className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                выбрать день
              </p>
              <DayPicker date={day} onChange={setDay} />
              <div className="mt-3">
                <DayDetailCard date={day} key={`${day.toDateString()}-${refreshKey}`} />
              </div>
            </div>
            <div>
              <p className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                последние 14 дней
              </p>
              <DailyBreakdown days={14} key={`db-${refreshKey}`} />
            </div>
          </div>
        </PopupCard>
        <SleepMiniCard refreshKey={refreshKey} onSaved={() => setRefreshKey((k) => k + 1)} />
      </div>
    ),
    kpi: <CompactKpis key={`kpi-${refreshKey}`} />,
  }), [refreshKey, day, range, preset, days]);

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

      {/* Quick check-in CTA — вся карточка кликабельна */}
      <Card
        className="ios-card p-4 animate-slide-up cursor-pointer hover:bg-muted/30 active:bg-muted/50 transition-colors"
        style={{ animationDelay: "60ms", animationFillMode: "both" }}
        onClick={() => setQuickMode((m) => m === "single" ? "none" : "single")}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setQuickMode((m) => m === "single" ? "none" : "single");
          }
        }}
      >
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
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
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

      {/* DnD — на мобиле перетаскивание активируется long-press; помечаем зону data-no-swipe */}
      <div data-no-swipe>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={onDragCancel}
        >
          <SortableContext items={order as string[]} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-5">
              {order.map((id, i) => (
                <SortableSection key={id} id={id}>
                  <div
                    className="animate-slide-up rounded-2xl"
                    style={{ animationDelay: `${120 + i * 40}ms`, animationFillMode: "both" }}
                  >
                    {sections[id]}
                  </div>
                </SortableSection>
              ))}
            </div>
          </SortableContext>
          <DragOverlay dropAnimation={{ duration: 220, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}>
            {activeId ? (
              <div className="rounded-2xl shadow-2xl ring-1 ring-primary/30 bg-background opacity-95 cursor-grabbing">
                {sections[activeId]}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
};

export default Mirror;
