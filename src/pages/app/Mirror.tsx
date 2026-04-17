// Mirror — unified main page: Today / History / Analytics / Sleep tabs.
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
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
import { SleepTracker } from "@/components/sleep/SleepTracker";
import { SleepHistory } from "@/components/sleep/SleepHistory";
import { seedDemoData } from "@/lib/demoData";
import type { DateRange } from "react-day-picker";

const Mirror = () => {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "today";
  const [name, setName] = useState("");
  const [stats, setStats] = useState<GlyphState>(defaultGlyphState);
  const [todayCount, setTodayCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [seeding, setSeeding] = useState(false);

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

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between flex-wrap gap-3">
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

      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v })}>
        <TabsList className="w-full grid grid-cols-4 rounded-full">
          <TabsTrigger value="today" className="rounded-full">Сегодня</TabsTrigger>
          <TabsTrigger value="history" className="rounded-full">История</TabsTrigger>
          <TabsTrigger value="analytics" className="rounded-full">Аналитика</TabsTrigger>
          <TabsTrigger value="sleep" className="rounded-full">Сон</TabsTrigger>
        </TabsList>

        {/* TODAY */}
        <TabsContent value="today" className="space-y-5 mt-5">
          <p className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
            сегодня · {todayCount} {todayCount === 1 ? "запись" : "записей"}
          </p>
          <MiniCheckin onSaved={() => setRefreshKey((k) => k + 1)} />
          <Card className="ios-card p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
                колесо баланса
              </p>
              <span className="mono text-[10px] text-muted-foreground">
                по последним чек-инам
              </span>
            </div>
            <div className="flex justify-center">
              <BalanceWheel state={stats} size={360} />
            </div>
          </Card>
        </TabsContent>

        {/* HISTORY */}
        <TabsContent value="history" className="space-y-5 mt-5">
          <DayPicker date={day} onChange={setDay} />
          <DayDetailCard date={day} key={`${day.toDateString()}-${refreshKey}`} />
        </TabsContent>

        {/* ANALYTICS */}
        <TabsContent value="analytics" className="space-y-5 mt-5">
          <DateRangePicker
            range={range}
            onChange={setRange}
            preset={preset}
            onPresetChange={setPreset}
          />
          <MoodTrendChart range={range} />
          <ActivityImpact
            days={
              preset === "7d" ? 7 : preset === "30d" ? 30 : preset === "90d" ? 90 : preset === "365d" ? 365 : 30
            }
          />
        </TabsContent>

        {/* SLEEP */}
        <TabsContent value="sleep" className="space-y-5 mt-5">
          <SleepTracker onSaved={() => setRefreshKey((k) => k + 1)} />
          <SleepHistory key={refreshKey} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Mirror;
