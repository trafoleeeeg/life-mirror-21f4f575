// Mirror — single-screen layout (per ОС-апрель doc):
// 1) Greeting + quick check-in CTA
// 2) KPI / Stats compact
// 3) Activity impact (most important block)
// 4) Daily breakdown (по дням)
// 5) Mood trend chart (heatmap-replacement)
// 6) Sleep correlation
// 7) Balance wheel
// 8) Collapsed checkins list (last 3)
// + Sleep & History as Popup mini-cards
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Plus, History, Moon } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { defaultGlyphState, type GlyphState } from "@/components/glyph/GlyphAvatar";
import { BalanceWheel } from "@/components/balance/BalanceWheel";
import { MiniCheckin } from "@/components/mirror/MiniCheckin";
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
import { seedDemoData } from "@/lib/demoData";
import type { DateRange } from "react-day-picker";

const Mirror = () => {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [stats, setStats] = useState<GlyphState>(defaultGlyphState);
  const [todayCount, setTodayCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [seeding, setSeeding] = useState(false);
  const [showQuick, setShowQuick] = useState(false);

  const [day, setDay] = useState<Date>(new Date());
  const [preset, setPreset] = useState<Preset>("30d");
  const [range, setRange] = useState<DateRange>(presetToRange("30d"));

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

  return (
    <div className="space-y-5 pb-8">
      {/* 1. Greeting + CTA */}
      <header className="flex items-end justify-between flex-wrap gap-3 animate-fade-in">
        <div>
          <p className="text-muted-foreground text-sm">Зеркало</p>
          <h1 className="text-3xl font-bold tracking-tight">
            Привет, {name} <span aria-hidden>👋</span>
          </h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={seedDemo}
          disabled={seeding}
          className="rounded-full gap-2"
        >
          <Sparkles className="size-3.5" />
          {seeding ? "Загружаю…" : "Демо-данные"}
        </Button>
      </header>

      {/* Quick check-in CTA */}
      <Card
        role="button"
        tabIndex={0}
        onClick={() => setShowQuick((v) => !v)}
        className="ios-card p-4 cursor-pointer hover:border-primary/40 transition-all animate-slide-up"
        style={{ animationDelay: "60ms", animationFillMode: "both" }}
      >
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-full bg-primary/15 text-primary grid place-items-center shrink-0">
            <Plus className="size-5" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm">Новый чек-ин</p>
            <p className="text-xs text-muted-foreground">
              {todayCount > 0 ? `Сегодня: ${todayCount} ${todayCount === 1 ? "запись" : "записей"}` : "Запиши настроение за минуту"}
            </p>
          </div>
        </div>
      </Card>
      {showQuick && (
        <div className="animate-scale-in">
          <MiniCheckin
            onSaved={() => {
              setRefreshKey((k) => k + 1);
              setShowQuick(false);
            }}
          />
        </div>
      )}

      {/* 2. KPI compact */}
      <div className="animate-slide-up" style={{ animationDelay: "120ms", animationFillMode: "both" }}>
        <MoodKpis key={`kpi-${refreshKey}`} />
      </div>

      {/* Mini-cards row: History + Sleep */}
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

      {/* 3. Focus + Activity impact */}
      <div className="animate-slide-up" style={{ animationDelay: "180ms", animationFillMode: "both" }}>
        <FocusInsights days={7} key={`focus-${refreshKey}`} />
      </div>

      {/* Range picker — one for analytics block */}
      <div className="flex items-center justify-between flex-wrap gap-2 pt-2">
        <p className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
          аналитика
        </p>
        <DateRangePicker range={range} onChange={setRange} preset={preset} onPresetChange={setPreset} />
      </div>

      <div className="animate-slide-up" style={{ animationDelay: "220ms", animationFillMode: "both" }}>
        <ActivityImpact days={days} key={`act-${refreshKey}-${days}`} />
      </div>

      {/* 4. Daily breakdown */}
      <div className="animate-slide-up" style={{ animationDelay: "260ms", animationFillMode: "both" }}>
        <DailyBreakdown days={Math.min(days, 14)} key={`db-${refreshKey}-${days}`} />
      </div>

      {/* 5. Mood trend (heatmap replacement) */}
      <div className="animate-slide-up" style={{ animationDelay: "300ms", animationFillMode: "both" }}>
        <MoodTrendChart range={range} key={`trend-${refreshKey}`} />
      </div>

      {/* 6. Sleep correlation */}
      <div className="animate-slide-up" style={{ animationDelay: "340ms", animationFillMode: "both" }}>
        <SleepCorrelation days={Math.max(days, 30)} key={`corr-${refreshKey}-${days}`} />
      </div>

      {/* 7. Balance wheel */}
      <Card
        className="ios-card p-5 animate-slide-up"
        style={{ animationDelay: "380ms", animationFillMode: "both" }}
      >
        <div className="flex items-center justify-between mb-4">
          <p className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
            колесо баланса
          </p>
          <span className="mono text-[10px] text-muted-foreground">по чек-инам</span>
        </div>
        <div className="flex justify-center">
          <BalanceWheel state={stats} size={360} />
        </div>
      </Card>

      {/* 8. Today's checkins (collapsed) */}
      <CheckinsList refreshKey={refreshKey} />
    </div>
  );
};

export default Mirror;
