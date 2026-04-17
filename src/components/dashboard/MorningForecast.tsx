// Утренний прогноз дня: берём сегодняшний morning-чек-ин (если есть),
// извлекаем упоминания сущностей и считаем ожидаемое настроение.
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sunrise, ArrowRight, TrendingUp, TrendingDown } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  computeBaseline, computeImpact, forecastFromMentions, filterByDays,
} from "@/lib/lifeMap";
import { TYPE_TOKEN, displayLabel } from "@/types/lifeMap";
import type { DbEntity, PingRow, CheckinRow } from "@/types/lifeMap";

export const MorningForecast = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [morningText, setMorningText] = useState<string>("");
  const [entities, setEntities] = useState<DbEntity[]>([]);
  const [pings, setPings] = useState<PingRow[]>([]);
  const [checkins, setCheckins] = useState<CheckinRow[]>([]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const since = new Date(Date.now() - 60 * 86400_000).toISOString();

    Promise.all([
      // Сегодняшний morning-чек-ин
      supabase
        .from("checkins")
        .select("note,intent,tags,mode,created_at")
        .eq("user_id", user.id)
        .eq("mode", "morning")
        .gte("created_at", todayStart.toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      // Сущности
      supabase
        .from("graph_entities")
        .select("id,type,label,mentions,last_seen_at,pinned,hidden,category,custom_label")
        .eq("user_id", user.id),
      // История за 60д для импакта
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
    ]).then(([m, e, mp, ch]) => {
      const morning = m.data;
      const text = morning
        ? `${morning.intent ?? ""} ${morning.note ?? ""} ${(morning.tags ?? []).join(" ")}`
        : "";
      setMorningText(text.trim());
      setEntities(((e.data ?? []) as DbEntity[]).filter((x) => !x.hidden));
      setPings((mp.data ?? []) as PingRow[]);
      setCheckins((ch.data ?? []) as CheckinRow[]);
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
    // Слова из morning текста — режем по пробелам/пунктуации
    const words = morningText.split(/[\s,.;:!?()\\/]+/).filter((w) => w.length >= 2);
    return forecastFromMentions(words, entities, impact, baseline);
  }, [morningText, entities, pings, checkins]);

  if (loading) return null;

  // Нет утреннего чек-ина — нативная подсказка
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
    <Card className="ios-card p-4">
      <div className="flex items-center gap-3 mb-3">
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
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">влияние:</span>
        {top.map((c) => {
          const positive = c.delta >= 0;
          return (
            <Badge
              key={c.ent.id}
              variant="outline"
              className="text-[10px] py-0 px-1.5 gap-1"
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
          );
        })}
        <span className="text-[10px] text-muted-foreground ml-auto">
          base {forecast.baseline.toFixed(1)} · {diff > 0 ? "+" : ""}
          {diff.toFixed(1)}
        </span>
      </div>
    </Card>
  );
};
