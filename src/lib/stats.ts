import { GlyphState, STAT_ORDER, defaultGlyphState } from "@/components/glyph/GlyphAvatar";
import type { Tables } from "@/integrations/supabase/types";

type Checkin = Tables<"checkins">;

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
): GlyphState => {
  if (!checkins.length) return base;

  // last 14 days window for momentum
  const cutoff = Date.now() - 14 * 24 * 3600 * 1000;
  const recent = checkins.filter((c) => new Date(c.created_at).getTime() >= cutoff);
  if (!recent.length) return base;

  // averages
  const avg = (arr: (number | null)[]) => {
    const f = arr.filter((x): x is number => typeof x === "number");
    return f.length ? f.reduce((s, x) => s + x, 0) / f.length : null;
  };

  const energyAvg = avg(recent.map((c) => c.energy));
  const moodAvg = avg(recent.map((c) => c.mood));
  const sleepAvg = avg(recent.map((c) => (c.sleep_hours != null ? Number(c.sleep_hours) : null)));

  // signals
  const next: GlyphState = { ...base };

  // body: sleep (0-12) + energy (0-100). 7-9h sleep is ideal -> 75; <5h -> 30
  if (sleepAvg != null || energyAvg != null) {
    const sleepScore = sleepAvg != null
      ? clamp(50 + (sleepAvg - 7) * 8 + (sleepAvg >= 7 && sleepAvg <= 9 ? 10 : 0))
      : base.body;
    const energyScore = energyAvg != null ? energyAvg : base.body;
    next.body = clamp((sleepScore + energyScore) / 2);
  }

  // emotions: mood
  if (moodAvg != null) next.emotions = clamp(moodAvg);

  // mind: balance of mood/energy + intent presence
  const intents = recent.filter((c) => c.intent && c.intent.trim().length > 4).length;
  next.mind = clamp(
    (moodAvg ?? base.mind) * 0.4 +
      (energyAvg ?? base.mind) * 0.4 +
      Math.min(20, intents * 4),
  );

  // tag-driven nudges
  const counts: Partial<Record<keyof GlyphState, number>> = {};
  for (const c of recent) {
    for (const tag of c.tags || []) {
      const targets = TAG_MAP[tag.toLowerCase()];
      if (!targets) continue;
      for (const t of targets) counts[t] = (counts[t] || 0) + 1;
    }
  }
  for (const k of STAT_ORDER) {
    const n = counts[k] || 0;
    if (n > 0) {
      // attention to a sphere = small uplift
      next[k] = clamp(next[k] + Math.min(15, n * 3));
    }
  }

  // consistency bonus across all spheres
  const consistency = Math.min(15, recent.length);
  for (const k of STAT_ORDER) next[k] = clamp(next[k] + consistency * 0.3);

  return next;
};
