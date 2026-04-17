// Generates ~60 days of mood_pings + 60 sleep_sessions + glyph_stats history.
// Sleep quality strongly drives next-day mood so SleepCorrelation shows real signal.
// Activities also have impact: Спорт/Прогулка ↑, Работа в выходные ↓.
import { supabase } from "@/integrations/supabase/client";

const ACTIVITIES_POS = ["Спорт", "Прогулка", "Общение", "Чтение", "Творчество"];
const ACTIVITIES_NEU = ["Работа", "Учёба", "Кофе", "Еда"];
const ACTIVITIES_NEG = ["Отдых", "Сон"]; // тут «Отдых» означает залип/упадок
const EMOJIS = ["😞", "😕", "😐", "🙂", "😊", "😄", "😍", "🤩", "🚀", "✨"];

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function pick<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && copy.length; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}

interface NightPlan {
  date: Date;          // local "next day" — день, на который влияет
  startedAt: Date;
  endedAt: Date;
  durationMin: number;
  quality: number;     // 1..5
  baseMoodBoost: number; // вклад в настроение следующего дня
}

function planNight(prevDay: Date): NightPlan {
  // Bedtime: рабочие 22:30–01:00, выходные 23:00–02:00
  const dow = prevDay.getDay();
  const isWeekendNight = dow === 5 || dow === 6;
  const start = new Date(prevDay);
  const bedH = isWeekendNight ? rand(23, 26) : rand(22.5, 25);
  start.setHours(Math.floor(bedH) % 24, Math.floor((bedH % 1) * 60), 0, 0);
  if (bedH >= 24) start.setDate(start.getDate() + 1);

  const targetDur = isWeekendNight ? rand(7, 9.5) : rand(5.5, 8.5);
  const durationMin = Math.round(targetDur * 60);
  const end = new Date(start.getTime() + durationMin * 60_000);

  // Quality: длиннее сон + раньше лёг = лучше; шум
  const lateness = Math.max(0, bedH - 23.5);
  const qRaw = 2 + (targetDur - 6) * 0.7 - lateness * 0.6 + rand(-0.6, 0.6);
  const quality = clamp(Math.round(qRaw), 1, 5);

  // Boost mood: чем выше качество, тем сильнее +;
  // плюс «оптимум» 7–8.5ч даёт бонус
  const durOpt = 1 - Math.abs(targetDur - 7.7) / 4;
  const baseMoodBoost = (quality - 3) * 0.9 + durOpt * 0.6;
  return { date: prevDay, startedAt: start, endedAt: end, durationMin, quality, baseMoodBoost };
}

function planActivities(dow: number, mood: number): string[] {
  const isWeekend = dow === 0 || dow === 6;
  const out: string[] = [];
  if (isWeekend) {
    if (Math.random() < 0.7) out.push(...pick(ACTIVITIES_POS, 1 + Math.floor(Math.random() * 2)));
    if (Math.random() < 0.4) out.push(...pick(ACTIVITIES_NEU, 1));
  } else {
    out.push("Работа");
    if (mood >= 7 && Math.random() < 0.55) out.push("Спорт");
    if (Math.random() < 0.35) out.push(...pick(ACTIVITIES_POS.filter((x) => x !== "Спорт"), 1));
    if (Math.random() < 0.3) out.push(...pick(ACTIVITIES_NEU, 1));
  }
  if (mood <= 3 && Math.random() < 0.5) out.push(...pick(ACTIVITIES_NEG, 1));
  return Array.from(new Set(out));
}

export async function seedDemoData(userId: string) {
  const now = new Date();
  const TOTAL_DAYS = 60;

  // 1) Plan all nights first → их boost формирует mood следующего дня
  const nightByDayKey = new Map<string, NightPlan>();
  const sessions: Array<Record<string, unknown>> = [];

  for (let dayOffset = TOTAL_DAYS; dayOffset >= 1; dayOffset--) {
    const prev = new Date(now);
    prev.setHours(0, 0, 0, 0);
    prev.setDate(prev.getDate() - dayOffset);
    // одна ночь приходится на «следующий день» = prev + 1
    const next = new Date(prev);
    next.setDate(next.getDate() + 1);
    const plan = planNight(prev);
    const dayKey = next.toISOString().slice(0, 10);
    nightByDayKey.set(dayKey, plan);
    sessions.push({
      user_id: userId,
      started_at: plan.startedAt.toISOString(),
      ended_at: plan.endedAt.toISOString(),
      woken_at: plan.endedAt.toISOString(),
      quality: plan.quality,
      interruptions: Math.max(0, Math.round(rand(0, 4) - plan.quality * 0.5)),
      avg_loudness: Number(rand(0.05, 0.35).toFixed(3)),
      duration_minutes: plan.durationMin,
      smart_wake: Math.random() > 0.3,
    });
  }

  // 2) Generate pings: base зависит от dow + ночь предыдущего сна
  const pings: Array<Record<string, unknown>> = [];
  for (let dayOffset = TOTAL_DAYS; dayOffset >= 0; dayOffset--) {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - dayOffset);
    const dow = day.getDay();
    const isWeekend = dow === 0 || dow === 6;
    const baseMood = (isWeekend ? 7 : dow === 3 ? 5.2 : 6) + rand(-0.6, 0.6);

    const plan = nightByDayKey.get(day.toISOString().slice(0, 10));
    const sleepBoost = plan?.baseMoodBoost ?? 0;

    const pingCount = 1 + Math.floor(Math.random() * 4);
    const baseHour = 8 + Math.floor(Math.random() * 3);
    for (let i = 0; i < pingCount; i++) {
      const ts = new Date(day);
      ts.setHours(baseHour + i * 3 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 60), 0, 0);
      if (ts > now) continue;

      const moodNoise = rand(-1.2, 1.2);
      let mood = clamp(Math.round(baseMood + sleepBoost + moodNoise), 1, 10);

      const acts = planActivities(dow, mood);
      // активности тоже подкручивают
      if (acts.includes("Спорт")) mood = clamp(mood + 1, 1, 10);
      if (acts.includes("Прогулка")) mood = clamp(mood + 0.5, 1, 10);
      if (acts.includes("Работа") && isWeekend) mood = clamp(mood - 1, 1, 10);
      mood = Math.round(mood);

      pings.push({
        user_id: userId,
        mood,
        emoji: EMOJIS[mood - 1],
        activities: acts,
        note: Math.random() > 0.85 ? "Демо запись" : null,
        source: "demo",
        created_at: ts.toISOString(),
      });
    }
  }

  // 3) glyph_stats history (раз в неделю снимок) — slowly trending up
  const statsHistory: Array<Record<string, unknown>> = [];
  for (let weekOffset = 8; weekOffset >= 0; weekOffset--) {
    const ts = new Date(now);
    ts.setDate(ts.getDate() - weekOffset * 7);
    const drift = (8 - weekOffset) * 1.5;
    statsHistory.push({
      user_id: userId,
      recorded_at: ts.toISOString(),
      body: clamp(Math.round(50 + drift + rand(-5, 5)), 10, 95),
      mind: clamp(Math.round(55 + drift * 0.8 + rand(-5, 5)), 10, 95),
      emotions: clamp(Math.round(50 + drift + rand(-6, 6)), 10, 95),
      relationships: clamp(Math.round(48 + drift * 0.6 + rand(-5, 5)), 10, 95),
      career: clamp(Math.round(60 + drift * 0.7 + rand(-5, 5)), 10, 95),
      finance: clamp(Math.round(45 + drift * 0.4 + rand(-4, 4)), 10, 95),
      creativity: clamp(Math.round(55 + drift + rand(-5, 5)), 10, 95),
      meaning: clamp(Math.round(50 + drift * 0.9 + rand(-5, 5)), 10, 95),
    });
  }

  // 4) Insert in chunks
  for (let i = 0; i < pings.length; i += 100) {
    await supabase.from("mood_pings").insert(pings.slice(i, i + 100));
  }
  for (let i = 0; i < sessions.length; i += 50) {
    await supabase.from("sleep_sessions").insert(sessions.slice(i, i + 50));
  }
  await supabase.from("glyph_stats").insert(statsHistory);

  return { pings: pings.length, sleeps: sessions.length };
}
