// Утренний прогноз дня + вечерняя сверка + неделя точности.
// Утром: считает predicted из morning-чек-ина и сохраняет в mood_forecasts.
// Вечером (после 18:00): показывает predicted vs actual.
// Также подтягивает прогнозы за 7 дней и считает MAE.
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sunrise, Moon, ArrowRight, TrendingUp, TrendingDown, Target } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  computeBaseline, computeImpact, forecastFromMentions, filterByDays,
} from "@/lib/lifeMap";
import {
  upsertForecast, reconcileForecasts, fetchRecentForecasts, accuracyStats,
  type StoredForecastRow,
} from "@/lib/forecast";
import { TYPE_TOKEN, displayLabel } from "@/types/lifeMap";
import type { DbEntity, PingRow, CheckinRow } from "@/types/lifeMap";

export const MorningForecast = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [morningText, setMorningText] = useState<string>("");
  const [entities, setEntities] = useState<DbEntity[]>([]);
  const [pings, setPings] = useState<PingRow[]>([]);
  const [checkins, setCheckins] = useState<CheckinRow[]>([]);
  const [recent, setRecent] = useState<StoredForecastRow[]>([]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const since = new Date(Date.now() - 60 * 86400_000).toISOString();

    // Сверка прошлых прогнозов — фоновая задача
    void reconcileForecasts(user.id);

    Promise.all([
      supabase
        .from("checkins")
        .select("note,intent,tags,mode,created_at")
        .eq("user_id", user.id)
        .eq("mode", "morning")
        .gte("created_at", todayStart.toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("graph_entities")
        .select("id,type,label,mentions,last_seen_at,pinned,hidden,category,custom_label")
        .eq("user_id", user.id),
      supabase
        .from("mood_pings")
        .select("created_at,mood,note,activities")
        .eq("user_id", user.id)
        .gte("created_at", since),
      supabase
        .from("checkins")
        .select("created_at,mood,note,intent,tags")
        .eq("user_id", user.id)
        .gte("created_at", since),
      fetchRecentForecasts(user.id, 8),
    ]).then(([m, e, mp, ch, rf]) => {
      const morning = m.data;
      const text = morning
        ? `${morning.intent ?? ""} ${morning.note ?? ""} ${(morning.tags ?? []).join(" ")}`
        : "";
      setMorningText(text.trim());
      setEntities(((e.data ?? []) as DbEntity[]).filter((x) => !x.hidden));
      setPings((mp.data ?? []) as PingRow[]);
      setCheckins((ch.data ?? []) as CheckinRow[]);
      setRecent(rf);
      setLoading(false);
    });
  }, [user]);

  const forecast = useMemo(() => {
    if (!morningText || !entities.length) return null;
    const periodPings = filterByDays(pings, 60);
    const periodCheckins = filterByDays(checkins, 60);
    const baseline = computeBaseline(periodPings, periodCheckins);
    if (baseline == null) return null;
    const impact = computeImpact(entities, periodPings, periodCheckins, baseline, 60);
    const words = morningText.split(/[\s,.;:!?()\\/]+/).filter((w) => w.length >= 2);
    return forecastFromMentions(words, entities, impact, baseline);
  }, [morningText, entities, pings, checkins]);

  // Сохраняем прогноз когда он появился
  useEffect(() => {
    if (!user || !forecast || forecast.contributions.length === 0) return;
    void upsertForecast({
      userId: user.id,
      predicted: forecast.predicted,
      baseline: forecast.baseline,
      contributions: forecast.contributions,
      morningText,
    });
  }, [user, forecast, morningText]);

  // Сегодня в БД (чтобы вечером показать predicted/actual если есть)
  const today = new Date().toISOString().slice(0, 10);
  const todayStored = recent.find((r) => r.day === today);
  const hour = new Date().getHours();
  const isEvening = hour >= 18;

  // Сегодня среднее настроение по мере накопления (для вечернего блока)
  const todayActual = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const ts = todayStart.getTime();
    const moods: number[] = [];
    pings.forEach((p) => {
      if (new Date(p.created_at).getTime() >= ts) moods.push(p.mood);
    });
    checkins.forEach((c) => {
      if (c.mood != null && new Date(c.created_at).getTime() >= ts) moods.push(c.mood);
    });
    return moods.length ? moods.reduce((s, x) => s + x, 0) / moods.length : null;
  }, [pings, checkins]);

  const accuracy = useMemo(() => accuracyStats(recent), [recent]);

  if (loading) return null;

  // === Нет утреннего чек-ина ===
  if (!morningText) {
    return (
      <Card className="ios-card p-4">
        <div className="flex items-center gap-3">
          <span className="size-10 rounded-full bg-primary/15 text-primary grid place-items-center shrink-0">
            <Sunrise className="size-5" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">Утренний прогноз</p>
            <p className="text-xs text-muted-foreground">
              Сделай morning-чек-ин с планами на день — покажу прогноз настроения.
            </p>
          </div>
          <Link
            to="/app/checkin-form"
            className="text-xs text-primary hover:underline shrink-0 flex items-center gap-1"
          >
            Чек-ин <ArrowRight className="size-3" />
          </Link>
        </div>
      </Card>
    );
  }

  // === Нет ни одной знакомой сущности ===
  if (!forecast || forecast.contributions.length === 0) {
    return (
      <Card className="ios-card p-4">
        <div className="flex items-center gap-3">
          <span className="size-10 rounded-full bg-primary/15 text-primary grid place-items-center shrink-0">
            <Sunrise className="size-5" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">Утренний прогноз</p>
            <p className="text-xs text-muted-foreground line-clamp-2">
              «{morningText}» — пока в этих планах нет знакомых сущностей. Прогноз появится, когда наберётся история.
            </p>
          </div>
          {accuracy.count > 0 && <AccuracyMini accuracy={accuracy} />}
        </div>
      </Card>
    );
  }

  const top = forecast.contributions
    .slice()
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 4);
  const diff = forecast.predicted - forecast.baseline;
  const tone = diff > 0.2 ? "up" : diff < -0.2 ? "down" : "neutral";
  const accent =
    tone === "up" ? "var(--ring-exercise)" : tone === "down" ? "var(--stat-body)" : "var(--muted-foreground)";
  const Trend = tone === "up" ? TrendingUp : tone === "down" ? TrendingDown : Sunrise;

  return (
    <Card className="ios-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="size-10 rounded-full bg-primary/15 text-primary grid place-items-center shrink-0">
          <Sunrise className="size-5" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="mono text-[10px] uppercase tracking-widest text-muted-foreground">прогноз дня</p>
          <p className="text-sm font-semibold leading-tight">
            Сегодня в планах:{" "}
            <span className="text-foreground/80 font-normal">
              {top.map((c) => displayLabel(c.ent)).join(", ")}
            </span>
          </p>
        </div>
        <div
          className="flex items-baseline gap-1 shrink-0 rounded-xl px-3 py-1.5"
          style={{ background: `hsl(${accent} / 0.12)` }}
        >
          <Trend className="size-4" style={{ color: `hsl(${accent})` }} />
          <span className="text-2xl font-bold tabular-nums" style={{ color: `hsl(${accent})` }}>
            {forecast.predicted.toFixed(1)}
          </span>
          <span className="text-[10px] text-muted-foreground">/10</span>
        </div>
      </div>

      {/* Контрибьюторы — кликабельные, ведут в Graph с фокусом */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">влияние:</span>
        {top.map((c) => {
          const positive = c.delta >= 0;
          return (
            <Link
              key={c.ent.id}
              to={`/app/graph?focus=${c.ent.id}`}
              title={`Открыть «${displayLabel(c.ent)}» в карте жизни`}
            >
              <Badge
                variant="outline"
                className="text-[10px] py-0 px-1.5 gap-1 hover:bg-secondary/70 cursor-pointer transition-colors"
                style={{ borderColor: `hsl(${TYPE_TOKEN[c.ent.type]} / 0.4)` }}
              >
                <span className="font-medium">{displayLabel(c.ent)}</span>
                <span
                  className="tabular-nums"
                  style={{ color: `hsl(${positive ? "var(--ring-exercise)" : "var(--stat-body)"})` }}
                >
                  {positive ? "+" : ""}
                  {c.delta.toFixed(1)}
                </span>
              </Badge>
            </Link>
          );
        })}
        <span className="text-[10px] text-muted-foreground ml-auto">
          base {forecast.baseline.toFixed(1)} · {diff > 0 ? "+" : ""}
          {diff.toFixed(1)}
        </span>
      </div>

      {/* Вечерний раздел: predicted vs actual */}
      {isEvening && todayActual != null && todayStored && (
        <EveningCompare predicted={todayStored.predicted} actual={todayActual} />
      )}

      {/* Точность за неделю */}
      {accuracy.count > 0 && <AccuracyBar accuracy={accuracy} rows={recent} />}
    </Card>
  );
};

// === Вечерний блок: прогноз vs факт ===
const EveningCompare = ({ predicted, actual }: { predicted: number; actual: number }) => {
  const err = Math.abs(actual - predicted);
  const tone = err <= 0.5 ? "good" : err <= 1.5 ? "ok" : "off";
  const label =
    tone === "good" ? "почти попал" : tone === "ok" ? "близко" : "промах";
  const color =
    tone === "good" ? "var(--ring-exercise)" : tone === "ok" ? "var(--stat-emotions)" : "var(--stat-body)";
  return (
    <div
      className="flex items-center gap-2 rounded-lg p-2.5 border"
      style={{ background: `hsl(${color} / 0.08)`, borderColor: `hsl(${color} / 0.25)` }}
    >
      <Moon className="size-4 shrink-0" style={{ color: `hsl(${color})` }} />
      <span className="text-xs font-medium">Прогноз был</span>
      <span className="tabular-nums text-sm font-semibold">{predicted.toFixed(1)}</span>
      <span className="text-xs text-muted-foreground">→ фактически</span>
      <span className="tabular-nums text-sm font-semibold">{actual.toFixed(1)}</span>
      <span
        className="ml-auto text-[11px] font-medium px-2 py-0.5 rounded-full"
        style={{ background: `hsl(${color} / 0.15)`, color: `hsl(${color})` }}
      >
        {label}
      </span>
    </div>
  );
};

// === Точность за неделю — мини полоса ===
const AccuracyMini = ({ accuracy }: { accuracy: { mae: number | null; count: number; hits: number } }) => {
  if (accuracy.mae == null) return null;
  const pct = Math.round((accuracy.hits / accuracy.count) * 100);
  return (
    <div className="text-right shrink-0">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">точность</div>
      <div className="text-sm font-semibold tabular-nums">{pct}%</div>
    </div>
  );
};

const AccuracyBar = ({
  accuracy, rows,
}: { accuracy: { mae: number | null; count: number; hits: number }; rows: StoredForecastRow[] }) => {
  if (accuracy.mae == null) return null;
  const reconciled = rows.filter((r) => r.actual != null).slice(0, 7).reverse();
  const pct = Math.round((accuracy.hits / accuracy.count) * 100);
  return (
    <div className="pt-2 border-t border-border/50">
      <div className="flex items-center gap-2 mb-1.5">
        <Target className="size-3.5 text-muted-foreground" />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          точность за неделю
        </span>
        <span className="ml-auto text-[11px] tabular-nums">
          <span className="font-semibold">{pct}%</span>{" "}
          <span className="text-muted-foreground">попаданий · ±{accuracy.mae.toFixed(1)} в среднем</span>
        </span>
      </div>
      <div className="flex items-end gap-0.5 h-7">
        {reconciled.map((r) => {
          const err = Math.abs((r.actual as number) - r.predicted);
          const hit = err <= 1;
          const h = Math.max(15, Math.min(100, 100 - err * 20));
          return (
            <div
              key={r.id}
              className="flex-1 rounded-sm"
              title={`${r.day}: прогноз ${r.predicted.toFixed(1)} → факт ${(r.actual as number).toFixed(1)}`}
              style={{
                height: `${h}%`,
                background: `hsl(${hit ? "var(--ring-exercise)" : "var(--stat-body)"} / 0.7)`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
};
