import { GlyphState, STAT_ORDER, defaultGlyphState } from "@/components/glyph/GlyphAvatar";
import type { Tables } from "@/integrations/supabase/types";

type Checkin = Tables<"checkins">;
type MoodPing = Tables<"mood_pings">;

const ACTIVITY_MAP: Record<string, (keyof GlyphState)[]> = {
  "работа": ["career"],
  "встреча": ["career", "relationships"],
  "спорт": ["body"],
  "тренировка": ["body"],
  "прогулка": ["body", "emotions"],
  "сон": ["body"],
  "семья": ["relationships"],
  "друзья": ["relationships"],
  "свидание": ["relationships"],
  "одиночество": ["relationships", "emotions"],
  "медитация": ["mind", "emotions"],
  "чтение": ["mind", "creativity"],
  "учёба": ["mind", "career"],
  "учеба": ["mind", "career"],
  "творчество": ["creativity"],
  "хобби": ["creativity"],
  "деньги": ["finance"],
  "покупки": ["finance"],
  "тревога": ["emotions", "mind"],
  "стресс": ["emotions", "body"],
  "радость": ["emotions"],
  "благодарность": ["emotions", "meaning"],
};

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

const TAG_MAP: Record<string, (keyof GlyphState)[]> = {
  "работа": ["career"],
  "карьера": ["career"],
  "деньги": ["finance"],
  "финансы": ["finance"],
  "отношения": ["relationships"],
  "семья": ["relationships"],
  "друзья": ["relationships"],
  "одиночество": ["relationships", "emotions"],
  "здоровье": ["body"],
  "тело": ["body"],
  "сон": ["body"],
  "творчество": ["creativity"],
  "идея": ["creativity", "mind"],
  "смысл": ["meaning"],
  "тревога": ["emotions", "mind"],
  "стресс": ["emotions", "body"],
};

/**
 * Recompute the 8 stats from the last N checkins.
 * Pure function — keeps numbers stable so UI doesn't jump.
 */
export const computeStatsFromCheckins = (
  checkins: Checkin[],
  base: GlyphState = defaultGlyphState,
  pings: MoodPing[] = [],
): GlyphState => {
  if (!checkins.length && !pings.length) return base;

  // last 14 days window for momentum
  const cutoff = Date.now() - 14 * 24 * 3600 * 1000;
  const recent = checkins.filter((c) => new Date(c.created_at).getTime() >= cutoff);
  const recentPings = pings.filter((p) => new Date(p.created_at).getTime() >= cutoff);
  if (!recent.length && !recentPings.length) return base;

  // averages
  const avg = (arr: (number | null)[]) => {
    const f = arr.filter((x): x is number => typeof x === "number");
    return f.length ? f.reduce((s, x) => s + x, 0) / f.length : null;
  };

  const energyAvg = avg(recent.map((c) => c.energy));
  const moodAvg = avg(recent.map((c) => c.mood));
  const sleepAvg = avg(recent.map((c) => (c.sleep_hours != null ? Number(c.sleep_hours) : null)));

  // pings: mood is 1..10 → scale to 0..100
  const pingMoodAvg = recentPings.length
    ? (recentPings.reduce((s, p) => s + p.mood, 0) / recentPings.length) * 10
    : null;

  // signals
  const next: GlyphState = { ...base };

  // body: sleep + energy
  if (sleepAvg != null || energyAvg != null) {
    const sleepScore = sleepAvg != null
      ? clamp(50 + (sleepAvg - 7) * 8 + (sleepAvg >= 7 && sleepAvg <= 9 ? 10 : 0))
      : base.body;
    const energyScore = energyAvg != null ? energyAvg : base.body;
    next.body = clamp((sleepScore + energyScore) / 2);
  }

  // emotions: blend checkin mood (70%) + ping mood (30%)
  if (moodAvg != null && pingMoodAvg != null) {
    next.emotions = clamp(moodAvg * 0.7 + pingMoodAvg * 0.3);
  } else if (moodAvg != null) {
    next.emotions = clamp(moodAvg);
  } else if (pingMoodAvg != null) {
    // pings only — softer pull toward base
    next.emotions = clamp(base.emotions * 0.5 + pingMoodAvg * 0.5);
  }

  // mind: balance of mood/energy + intent presence + ping consistency
  const intents = recent.filter((c) => c.intent && c.intent.trim().length > 4).length;
  const pingBonus = Math.min(15, recentPings.length * 1.5);
  next.mind = clamp(
    (moodAvg ?? pingMoodAvg ?? base.mind) * 0.35 +
      (energyAvg ?? base.mind) * 0.35 +
      Math.min(20, intents * 4) +
      pingBonus,
  );

  // body micro-signal from pings (active vs sedentary feel via mood proxy)
  if (pingMoodAvg != null) {
    next.body = clamp(next.body * 0.85 + pingMoodAvg * 0.15);
  }

  // tag-driven nudges from checkins
  const counts: Partial<Record<keyof GlyphState, number>> = {};
  for (const c of recent) {
    for (const tag of c.tags || []) {
      const targets = TAG_MAP[tag.toLowerCase()];
      if (!targets) continue;
      for (const t of targets) counts[t] = (counts[t] || 0) + 1;
    }
  }
  // activity-driven nudges from pings
  for (const p of recentPings) {
    for (const a of p.activities || []) {
      const targets = ACTIVITY_MAP[a.toLowerCase()];
      if (!targets) continue;
      for (const t of targets) counts[t] = (counts[t] || 0) + 1;
    }
  }
  for (const k of STAT_ORDER) {
    const n = counts[k] || 0;
    if (n > 0) {
      next[k] = clamp(next[k] + Math.min(15, n * 2));
    }
  }

  // consistency bonus
  const consistency = Math.min(15, recent.length + recentPings.length * 0.3);
  for (const k of STAT_ORDER) next[k] = clamp(next[k] + consistency * 0.3);

  return next;
};
