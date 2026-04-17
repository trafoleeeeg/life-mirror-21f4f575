import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heatmap } from "@/components/Heatmap";
import { STAT_META, STAT_ORDER, StatKey, defaultGlyphState } from "@/components/glyph/GlyphAvatar";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { TrendingDown, TrendingUp, Minus, Flame, Trophy, Lock } from "lucide-react";

interface Achievement {
  id: string;
  code: string;
  title: string;
  description: string;
  emoji: string;
  category: string;
}
interface UserAch {
  achievement_id: string;
  unlocked_at: string;
}
interface PingRow {
  mood: number;
  created_at: string;
}

type Range = 7 | 30 | 90;

interface StatRow {
  recorded_at: string;
  body: number;
  mind: number;
  emotions: number;
  relationships: number;
  career: number;
  finance: number;
  creativity: number;
  meaning: number;
}

const Progress = () => {
  const { user } = useAuth();
  const [range, setRange] = useState<Range>(30);
  const [rows, setRows] = useState<StatRow[]>([]);
  const [active, setActive] = useState<Set<StatKey>>(new Set(STAT_ORDER));
  const [checkinDates, setCheckinDates] = useState<string[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [unlocked, setUnlocked] = useState<Map<string, string>>(new Map());
  const [streak, setStreak] = useState<number>(0);
  const [pings, setPings] = useState<PingRow[]>([]);

  useEffect(() => {
    if (!user) return;
    const since = new Date(Date.now() - range * 24 * 3600 * 1000).toISOString();
    supabase
      .from("glyph_stats")
      .select("recorded_at, body, mind, emotions, relationships, career, finance, creativity, meaning")
      .eq("user_id", user.id)
      .gte("recorded_at", since)
      .order("recorded_at", { ascending: true })
      .then(({ data }) => setRows((data || []) as StatRow[]));
  }, [user, range]);

  useEffect(() => {
    if (!user) return;
    const since90 = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
    void (async () => {
      const [checkRes, achRes, uaRes, streakRes, pingRes] = await Promise.all([
        supabase.from("checkins").select("created_at").eq("user_id", user.id).gte("created_at", since90),
        supabase.from("achievements").select("*").order("threshold", { ascending: true }),
        supabase.from("user_achievements").select("achievement_id, unlocked_at").eq("user_id", user.id),
        supabase.rpc("compute_ping_streak", { _user: user.id }),
        supabase
          .from("mood_pings")
          .select("mood, created_at")
          .eq("user_id", user.id)
          .gte("created_at", since90)
          .order("created_at", { ascending: false })
          .limit(1000),
      ]);
      setCheckinDates((checkRes.data || []).map((c) => c.created_at));
      setAchievements((achRes.data || []) as Achievement[]);
      const m = new Map<string, string>();
      (uaRes.data || []).forEach((u: UserAch) => m.set(u.achievement_id, u.unlocked_at));
      setUnlocked(m);
      setStreak(typeof streakRes.data === "number" ? streakRes.data : 0);
      setPings((pingRes.data || []) as PingRow[]);
    })();
  }, [user]);

  // mood by hour of day
  const hourlyMood = useMemo(() => {
    const buckets: { sum: number; n: number }[] = Array.from({ length: 24 }, () => ({
      sum: 0,
      n: 0,
    }));
    for (const p of pings) {
      const h = new Date(p.created_at).getHours();
      buckets[h].sum += p.mood;
      buckets[h].n += 1;
    }
    return buckets.map((b, h) => ({
      hour: h,
      label: `${String(h).padStart(2, "0")}:00`,
      mood: b.n ? Number((b.sum / b.n).toFixed(2)) : 0,
      count: b.n,
    }));
  }, [pings]);

  const bestWorst = useMemo(() => {
    const valid = hourlyMood.filter((h) => h.count >= 2);
    if (!valid.length) return null;
    const best = valid.reduce((a, b) => (b.mood > a.mood ? b : a));
    const worst = valid.reduce((a, b) => (b.mood < a.mood ? b : a));
    return { best, worst };
  }, [hourlyMood]);

  const chartData = useMemo(() => {
    return rows.map((r) => {
      const overall = Math.round(
        STAT_ORDER.reduce((s, k) => s + r[k], 0) / STAT_ORDER.length,
      );
      const d = new Date(r.recorded_at);
      return {
        date: d.toLocaleDateString("ru", { day: "numeric", month: "short" }),
        ts: d.getTime(),
        ...Object.fromEntries(STAT_ORDER.map((k) => [k, r[k]])),
        overall,
      };
    });
  }, [rows]);

  const summary = useMemo(() => {
    if (rows.length < 1) return null;
    const first = rows[0];
    const last = rows[rows.length - 1];
    const overallFirst =
      STAT_ORDER.reduce((s, k) => s + first[k], 0) / STAT_ORDER.length;
    const overallLast =
      STAT_ORDER.reduce((s, k) => s + last[k], 0) / STAT_ORDER.length;
    const delta = Math.round(overallLast - overallFirst);
    const perStat = STAT_ORDER.map((k) => ({
      key: k,
      delta: Math.round(last[k] - first[k]),
      current: last[k],
    }));
    return { delta, current: Math.round(overallLast), perStat };
  }, [rows]);

  const toggleStat = (k: StatKey) => {
    setActive((p) => {
      const n = new Set(p);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  };

  return (
    <>
      <PageHeader
        eyebrow="отпечатки личности"
        title="Прогресс"
        description="Динамика твоих 8 сфер. Реальные данные — из чек-инов и разговоров с AI."
      >
        <div className="flex gap-1">
          {([7, 30, 90] as Range[]).map((r) => (
            <Button
              key={r}
              size="sm"
              variant={range === r ? "default" : "outline"}
              onClick={() => setRange(r)}
              className="rounded-full"
            >
              {r} дн
            </Button>
          ))}
        </div>
      </PageHeader>

      {/* Summary */}
      <div className="grid sm:grid-cols-4 gap-3 mb-4">
        <Card className="ios-card p-4">
          <p className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
            life score
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-semibold">{summary?.current ?? "—"}</span>
            {summary && (
              <span
                className={`inline-flex items-center text-sm ${
                  summary.delta > 0
                    ? "text-primary"
                    : summary.delta < 0
                    ? "text-destructive"
                    : "text-muted-foreground"
                }`}
              >
                {summary.delta > 0 ? (
                  <TrendingUp className="size-3.5 mr-0.5" />
                ) : summary.delta < 0 ? (
                  <TrendingDown className="size-3.5 mr-0.5" />
                ) : (
                  <Minus className="size-3.5 mr-0.5" />
                )}
                {summary.delta > 0 ? `+${summary.delta}` : summary.delta}
              </span>
            )}
          </div>
        </Card>
        <Card className="ios-card p-4 relative overflow-hidden">
          <p className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
            стрик пингов
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <Flame className={`size-6 ${streak > 0 ? "text-orange-500" : "text-muted-foreground"}`} />
            <span className="text-3xl font-semibold">{streak}</span>
            <span className="text-xs text-muted-foreground">дн</span>
          </div>
        </Card>
        <Card className="ios-card p-4">
          <p className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
            ачивок
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <Trophy className="size-5 text-primary" />
            <span className="text-3xl font-semibold">{unlocked.size}</span>
            <span className="text-xs text-muted-foreground">/ {achievements.length}</span>
          </div>
        </Card>
        <Card className="ios-card p-4">
          <p className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
            окно
          </p>
          <p className="text-3xl font-semibold mt-1">{range} дн</p>
        </Card>
      </div>

      {/* Heatmap of check-ins */}
      <Card className="ios-card p-4 mb-4">
        <p className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
          активность чек-инов · 90 дней
        </p>
        <Heatmap dates={checkinDates} days={90} />
      </Card>

      {/* Chart */}
      <Card className="ios-card p-4 mb-4">
        {chartData.length < 2 ? (
          <div className="h-[320px] flex items-center justify-center text-sm text-muted-foreground text-center px-6">
            Пока недостаточно снимков. Сделай ещё пару чек-инов или поговори с психологом — и динамика
            появится.
          </div>
        ) : (
          <div className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11 }}
                  iconType="circle"
                  iconSize={8}
                />
                <Line
                  type="monotone"
                  dataKey="overall"
                  name="Средний"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                {STAT_ORDER.filter((k) => active.has(k)).map((k) => (
                  <Line
                    key={k}
                    type="monotone"
                    dataKey={k}
                    name={STAT_META[k].label}
                    stroke={`hsl(var(${STAT_META[k].tokenVar}))`}
                    strokeWidth={1.5}
                    dot={false}
                    strokeOpacity={0.85}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* Mood by hour of day */}
      <Card className="ios-card p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
            настроение по часам · 90 дней
          </p>
          {bestWorst && (
            <div className="flex gap-3 text-xs">
              <span className="text-primary">
                ↑ лучший {bestWorst.best.label} ({bestWorst.best.mood.toFixed(1)})
              </span>
              <span className="text-destructive">
                ↓ худший {bestWorst.worst.label} ({bestWorst.worst.mood.toFixed(1)})
              </span>
            </div>
          )}
        </div>
        {pings.length < 3 ? (
          <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground text-center px-6">
            Сделай ещё пару пингов — и появятся твои лучшие и худшие часы дня.
          </div>
        ) : (
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyMood} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                  interval={1}
                />
                <YAxis
                  domain={[0, 10]}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v: number, _n, p) => [
                    `${v} (${(p.payload as { count: number }).count} пингов)`,
                    "Настроение",
                  ]}
                  labelFormatter={(h) => `${String(h).padStart(2, "0")}:00`}
                />
                <Bar dataKey="mood" radius={[4, 4, 0, 0]}>
                  {hourlyMood.map((h) => {
                    const color =
                      h.count === 0
                        ? "hsl(var(--muted))"
                        : h.mood >= 7
                        ? "hsl(var(--primary))"
                        : h.mood >= 5
                        ? "hsl(var(--stat-emotions))"
                        : "hsl(var(--destructive))";
                    return <Cell key={h.hour} fill={color} opacity={h.count === 0 ? 0.2 : 1} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* Achievements */}
      <Card className="ios-card p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
            ачивки · {unlocked.size} из {achievements.length}
          </p>
        </div>
        {achievements.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ачивки скоро появятся.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {achievements.map((a) => {
              const isUnlocked = unlocked.has(a.id);
              return (
                <div
                  key={a.id}
                  className={`relative p-3 rounded-xl border transition-all ${
                    isUnlocked
                      ? "border-primary/40 bg-gradient-to-br from-primary/10 to-primary/5"
                      : "border-border bg-muted/30 opacity-60"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className={`text-2xl ${!isUnlocked && "grayscale"}`}>{a.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold leading-tight truncate">{a.title}</p>
                      <p className="text-[11px] text-muted-foreground leading-tight mt-0.5 line-clamp-2">
                        {a.description}
                      </p>
                    </div>
                    {!isUnlocked && (
                      <Lock className="size-3 text-muted-foreground shrink-0 mt-0.5" />
                    )}
                  </div>
                  {isUnlocked && (
                    <p className="mono text-[9px] uppercase text-primary/70 mt-2">
                      {new Date(unlocked.get(a.id)!).toLocaleDateString("ru", {
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Toggle stats + per-stat delta */}
      <Card className="ios-card p-4">
        <p className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
          сферы
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {STAT_ORDER.map((k) => {
            const stat = summary?.perStat.find((s) => s.key === k);
            const on = active.has(k);
            return (
              <button
                key={k}
                onClick={() => toggleStat(k)}
                className={`text-left p-3 rounded-xl border transition-colors ${
                  on
                    ? "border-primary/40 bg-primary/5"
                    : "border-border opacity-60 hover:opacity-100"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: `hsl(var(${STAT_META[k].tokenVar}))` }}
                  />
                  <span className="text-sm font-medium">{STAT_META[k].label}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="mono text-lg">
                    {stat?.current ?? defaultGlyphState[k]}
                  </span>
                  {stat && (
                    <span
                      className={`text-xs ${
                        stat.delta > 0
                          ? "text-primary"
                          : stat.delta < 0
                          ? "text-destructive"
                          : "text-muted-foreground"
                      }`}
                    >
                      {stat.delta > 0 ? `+${stat.delta}` : stat.delta}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </Card>
    </>
  );
};

export default Progress;
