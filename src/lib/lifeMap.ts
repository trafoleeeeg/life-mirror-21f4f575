// Life Map analytics: impact, trends, combos, recommendations, period comparisons.
// Pure functions — easy to test, reuse across components.
import type { DbEntity, PingRow, CheckinRow, DbEdge } from "@/types/lifeMap";

export type PeriodDays = 7 | 30 | 60 | 90;

const dayKey = (d: string | Date) => (typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10));

const buildHaystacks = (pings: PingRow[], checkins: CheckinRow[]) => ({
  pings: pings.map((p) => ({
    day: dayKey(p.created_at),
    ts: new Date(p.created_at).getTime(),
    mood: p.mood,
    text: `${p.note ?? ""} ${p.activities.join(" ")}`.toLowerCase(),
  })),
  checks: checkins.map((c) => ({
    day: dayKey(c.created_at),
    ts: new Date(c.created_at).getTime(),
    mood: c.mood,
    text: `${c.note ?? ""} ${c.intent ?? ""} ${c.tags.join(" ")}`.toLowerCase(),
  })),
});

export const filterByDays = <T extends { created_at: string }>(rows: T[], days: number) => {
  const cutoff = Date.now() - days * 86400_000;
  return rows.filter((r) => new Date(r.created_at).getTime() >= cutoff);
};

export interface ImpactRow {
  ent: DbEntity;
  avg: number | null;
  delta: number;
  n: number; // mood points
  daysCount: number;
  trend: number; // delta(recent half) - delta(older half)
}

export const computeBaseline = (pings: PingRow[], checkins: CheckinRow[]): number | null => {
  const all: number[] = [];
  pings.forEach((p) => all.push(p.mood));
  checkins.forEach((c) => c.mood != null && all.push(c.mood));
  if (!all.length) return null;
  return all.reduce((s, x) => s + x, 0) / all.length;
};

/**
 * Impact = how avg mood on days an entity is mentioned differs from baseline.
 * Trend = same delta computed for recent half vs older half of period.
 */
export const computeImpact = (
  entities: DbEntity[],
  pings: PingRow[],
  checkins: CheckinRow[],
  baseline: number | null,
  periodDays: number,
): ImpactRow[] => {
  if (baseline == null) return [];
  const { pings: ph, checks: ch } = buildHaystacks(pings, checkins);
  const dayMood = new Map<string, number[]>();
  ph.forEach((p) => {
    if (!dayMood.has(p.day)) dayMood.set(p.day, []);
    dayMood.get(p.day)!.push(p.mood);
  });
  ch.forEach((c) => {
    if (c.mood == null) return;
    if (!dayMood.has(c.day)) dayMood.set(c.day, []);
    dayMood.get(c.day)!.push(c.mood);
  });

  const halfCutoff = Date.now() - (periodDays / 2) * 86400_000;

  return entities.map((ent) => {
    const lc = ent.label.toLowerCase();
    const days = new Set<string>();
    const recentDays = new Set<string>();
    const olderDays = new Set<string>();
    const collect = (rows: { day: string; ts: number; text: string }[]) => {
      rows.forEach((r) => {
        if (r.text.includes(lc)) {
          days.add(r.day);
          (r.ts >= halfCutoff ? recentDays : olderDays).add(r.day);
        }
      });
    };
    collect(ph);
    collect(ch);

    const moodsFor = (set: Set<string>) => {
      const m: number[] = [];
      set.forEach((d) => {
        const arr = dayMood.get(d);
        if (arr) m.push(...arr);
      });
      return m;
    };
    const moods = moodsFor(days);
    const recentMoods = moodsFor(recentDays);
    const olderMoods = moodsFor(olderDays);
    if (!moods.length) return { ent, avg: null, delta: 0, n: 0, daysCount: 0, trend: 0 };
    const avg = moods.reduce((s, x) => s + x, 0) / moods.length;
    const delta = avg - baseline;
    const recentAvg = recentMoods.length ? recentMoods.reduce((s, x) => s + x, 0) / recentMoods.length : null;
    const olderAvg = olderMoods.length ? olderMoods.reduce((s, x) => s + x, 0) / olderMoods.length : null;
    const trend = recentAvg != null && olderAvg != null ? recentAvg - olderAvg : 0;
    return { ent, avg, delta, n: moods.length, daysCount: days.size, trend };
  });
};

export interface ComboRow {
  a: DbEntity;
  b: DbEntity;
  avg: number;
  delta: number;
  coDays: number;
}

/**
 * Combos: pairs of entities co-occurring on the same day, ranked by joint mood delta.
 */
export const computeCombos = (
  entities: DbEntity[],
  pings: PingRow[],
  checkins: CheckinRow[],
  baseline: number | null,
): ComboRow[] => {
  if (baseline == null || entities.length < 2) return [];
  const { pings: ph, checks: ch } = buildHaystacks(pings, checkins);
  const dayMood = new Map<string, number[]>();
  ph.forEach((p) => {
    if (!dayMood.has(p.day)) dayMood.set(p.day, []);
    dayMood.get(p.day)!.push(p.mood);
  });
  ch.forEach((c) => {
    if (c.mood == null) return;
    if (!dayMood.has(c.day)) dayMood.set(c.day, []);
    dayMood.get(c.day)!.push(c.mood);
  });

  // map: entity.id -> Set<day>
  const entDays = new Map<string, Set<string>>();
  entities.forEach((e) => entDays.set(e.id, new Set()));
  const lcMap = entities.map((e) => ({ id: e.id, lc: e.label.toLowerCase() }));
  const all = [...ph, ...ch];
  all.forEach((r) => {
    lcMap.forEach((m) => {
      if (r.text.includes(m.lc)) entDays.get(m.id)!.add(r.day);
    });
  });

  const out: ComboRow[] = [];
  for (let i = 0; i < entities.length; i++) {
    for (let j = i + 1; j < entities.length; j++) {
      const a = entities[i];
      const b = entities[j];
      // skip emotion-emotion combos (less actionable)
      if (a.type === "emotion" && b.type === "emotion") continue;
      const sa = entDays.get(a.id)!;
      const sb = entDays.get(b.id)!;
      const inter: string[] = [];
      sa.forEach((d) => {
        if (sb.has(d)) inter.push(d);
      });
      if (inter.length < 2) continue;
      const moods: number[] = [];
      inter.forEach((d) => {
        const arr = dayMood.get(d);
        if (arr) moods.push(...arr);
      });
      if (!moods.length) continue;
      const avg = moods.reduce((s, x) => s + x, 0) / moods.length;
      out.push({ a, b, avg, delta: avg - baseline, coDays: inter.length });
    }
  }
  return out.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
};

export interface Recommendation {
  kind: "reconnect" | "avoid" | "more" | "trend_up" | "trend_down";
  ent: DbEntity;
  message: string;
  detail: string;
}

export const computeRecommendations = (
  impact: ImpactRow[],
  entities: DbEntity[],
  pings: PingRow[],
  checkins: CheckinRow[],
): Recommendation[] => {
  const out: Recommendation[] = [];
  const lastSeen = new Map<string, number>();
  const { pings: ph, checks: ch } = buildHaystacks(pings, checkins);
  entities.forEach((e) => {
    const lc = e.label.toLowerCase();
    let last = 0;
    ph.forEach((p) => {
      if (p.text.includes(lc)) last = Math.max(last, p.ts);
    });
    ch.forEach((c) => {
      if (c.text.includes(lc)) last = Math.max(last, c.ts);
    });
    if (last) lastSeen.set(e.id, last);
  });

  // Reconnect: positive impact (delta > 0.7) + people/event + not seen >= 10 days
  impact
    .filter((r) => r.delta > 0.7 && (r.ent.type === "person" || r.ent.type === "event") && r.daysCount >= 2)
    .forEach((r) => {
      const last = lastSeen.get(r.ent.id);
      if (!last) return;
      const daysAgo = Math.floor((Date.now() - last) / 86400_000);
      if (daysAgo >= 10) {
        out.push({
          kind: "reconnect",
          ent: r.ent,
          message: `Давно не было: ${r.ent.label}`,
          detail: `${daysAgo} дн. назад · обычно даёт +${r.delta.toFixed(1)} к настроению`,
        });
      }
    });

  // Avoid: persistent negative
  impact
    .filter((r) => r.delta < -0.8 && r.daysCount >= 4 && r.ent.type !== "emotion")
    .slice(0, 3)
    .forEach((r) => {
      out.push({
        kind: "avoid",
        ent: r.ent,
        message: `Снизить дозу: ${r.ent.label}`,
        detail: `${r.daysCount} дн. с упоминанием · средний mood ${(r.avg ?? 0).toFixed(1)} (${r.delta.toFixed(1)})`,
      });
    });

  // Trend up: things getting better
  impact
    .filter((r) => r.trend > 0.6 && r.daysCount >= 4)
    .slice(0, 2)
    .forEach((r) => {
      out.push({
        kind: "trend_up",
        ent: r.ent,
        message: `Греется: ${r.ent.label}`,
        detail: `За последнее время лучше на +${r.trend.toFixed(1)}`,
      });
    });

  // Trend down: things cooling
  impact
    .filter((r) => r.trend < -0.6 && r.daysCount >= 4 && r.ent.type !== "emotion")
    .slice(0, 2)
    .forEach((r) => {
      out.push({
        kind: "trend_down",
        ent: r.ent,
        message: `Остывает: ${r.ent.label}`,
        detail: `Стало хуже на ${r.trend.toFixed(1)}`,
      });
    });

  return out.slice(0, 6);
};

export const compareImpactPeriods = (
  current: ImpactRow[],
  previous: ImpactRow[],
): {
  rising: { ent: DbEntity; cur: number; prev: number; diff: number }[];
  falling: { ent: DbEntity; cur: number; prev: number; diff: number }[];
  newly: DbEntity[];
  gone: DbEntity[];
} => {
  const prevMap = new Map(previous.map((p) => [p.ent.id, p]));
  const curMap = new Map(current.map((c) => [c.ent.id, c]));
  const movements: { ent: DbEntity; cur: number; prev: number; diff: number }[] = [];
  const newly: DbEntity[] = [];
  current.forEach((c) => {
    const prev = prevMap.get(c.ent.id);
    if (!prev || prev.n === 0) {
      if (c.n > 0) newly.push(c.ent);
      return;
    }
    movements.push({ ent: c.ent, cur: c.delta, prev: prev.delta, diff: c.delta - prev.delta });
  });
  const gone = previous.filter((p) => p.n > 0 && (!curMap.get(p.ent.id) || curMap.get(p.ent.id)!.n === 0)).map((p) => p.ent);
  return {
    rising: movements.filter((m) => m.diff > 0.5).sort((a, b) => b.diff - a.diff).slice(0, 5),
    falling: movements.filter((m) => m.diff < -0.5).sort((a, b) => a.diff - b.diff).slice(0, 5),
    newly: newly.slice(0, 6),
    gone: gone.slice(0, 6),
  };
};
