import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { defaultGlyphState, type GlyphState } from "@/components/glyph/GlyphAvatar";
import { MoodOverview } from "@/components/dashboard/MoodOverview";
import { MoodKpis } from "@/components/dashboard/MoodKpis";
import { MoodHeatmap } from "@/components/dashboard/MoodHeatmap";
import { DailyBreakdown } from "@/components/dashboard/DailyBreakdown";
import { ActivityImpact } from "@/components/dashboard/ActivityImpact";
import { BalanceWheelAuto } from "@/components/balance/BalanceWheelAuto";

type Range = "today" | "7d" | "30d";

const RANGE_LABEL: Record<Range, string> = {
  today: "Сегодня",
  "7d": "7 дней",
  "30d": "30 дней",
};

const Dashboard = () => {
  const { user } = useAuth();
  const [name, setName] = useState<string>("");
  const [todayCount, setTodayCount] = useState(0);
  const [range, setRange] = useState<Range>("today");
  const [stats, setStats] = useState<GlyphState>(defaultGlyphState);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle();
      setName(profile?.display_name ?? user.email?.split("@")[0] ?? "друг");

      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from("mood_pings")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", start.toISOString());
      setTodayCount(count ?? 0);

      const { data: gs } = await supabase
        .from("glyph_stats")
        .select("body,mind,emotions,relationships,career,finance,creativity,meaning")
        .eq("user_id", user.id)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (gs) setStats(gs as GlyphState);
    })();
  }, [user]);

  return (
    <>
      {/* Greeting */}
      <header className="mb-6">
        <p className="text-muted-foreground text-sm">Привет,</p>
        <h1 className="text-3xl font-bold tracking-tight">
          {name} <span aria-hidden>👋</span>
        </h1>
      </header>

      {/* Today CTA */}
      <div className="mb-6">
        <p className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
          сегодня
          <span className="ml-2 normal-case tracking-normal text-muted-foreground/70">
            · {todayCount} {todayCount === 1 ? "чек-ин" : "чек-ина"}
          </span>
        </p>
        <Button
          asChild
          variant="outline"
          className="w-full h-14 rounded-2xl border-primary/40 text-base font-medium justify-start gap-3"
        >
          <Link to="/app/checkin">
            <span className="grid place-items-center size-8 rounded-full border border-primary/60 text-primary">
              <Plus className="size-4" />
            </span>
            Новый чек-ин
          </Link>
        </Button>
      </div>

      {/* Range tabs */}
      <div className="inline-flex p-1 rounded-full bg-secondary mb-6">
        {(Object.keys(RANGE_LABEL) as Range[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-4 py-1.5 rounded-full text-sm transition-colors ${
              range === r
                ? "bg-background text-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {RANGE_LABEL[r]}
          </button>
        ))}
      </div>

      {/* Concentric rings + legend */}
      <div className="mb-6">
        <MoodOverview range={range} />
      </div>

      {/* KPI cards */}
      <div className="mb-6">
        <MoodKpis />
      </div>

      {/* Heatmap */}
      <div className="mb-6">
        <MoodHeatmap days={range === "today" ? 7 : range === "7d" ? 14 : 30} />
      </div>

      {/* Daily breakdown */}
      <div className="mb-6">
        <DailyBreakdown days={range === "today" ? 3 : range === "7d" ? 7 : 14} />
      </div>

      {/* Activity impact */}
      <div className="mb-6">
        <ActivityImpact days={range === "today" ? 7 : range === "7d" ? 14 : 30} />
      </div>

      {/* Balance wheel */}
      <Card className="ios-card p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <p className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
            колесо баланса
          </p>
          <span className="mono text-[10px] text-muted-foreground">
            обновляется по чек-инам
          </span>
        </div>
        <div className="flex justify-center">
          <BalanceWheelAuto size={360} />
        </div>
      </Card>
    </>
  );
};

export default Dashboard;
