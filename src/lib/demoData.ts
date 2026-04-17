// Generates 60 days of realistic mood_pings + 30 sleep_sessions for an empty account.
// Patterns: weekdays slightly lower, weekends higher, dip mid-week, occasional bad days.
import { supabase } from "@/integrations/supabase/client";

const ACTIVITIES = [
  "Работа", "Спорт", "Прогулка", "Сон", "Еда",
  "Общение", "Учёба", "Отдых", "Чтение", "Кофе",
];
const EMOJIS = ["😞", "😕", "😐", "🙂", "😊", "😄", "😍", "🤩", "🚀", "✨"];

function pick<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && copy.length; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}

function moodForDay(date: Date): number[] {
  // 1-4 pings per day, mood depends on weekday + noise + drift
  const dow = date.getDay(); // 0=Sun
  const isWeekend = dow === 0 || dow === 6;
  const base = isWeekend ? 7 : dow === 3 ? 5 : 6;
  const dailyDrift = (Math.random() - 0.5) * 1.5;
  const count = 1 + Math.floor(Math.random() * 4);
  return Array.from({ length: count }, () => {
    const noise = (Math.random() - 0.5) * 2.5;
    return Math.max(1, Math.min(10, Math.round(base + dailyDrift + noise)));
  });
}

export async function seedDemoData(userId: string) {
  const now = new Date();
  const pings: Array<{
    user_id: string;
    mood: number;
    emoji: string;
    activities: string[];
    note: string | null;
    source: string;
    created_at: string;
  }> = [];

  for (let dayOffset = 60; dayOffset >= 0; dayOffset--) {
    const day = new Date(now);
    day.setDate(day.getDate() - dayOffset);
    const moods = moodForDay(day);
    const baseHour = 8 + Math.floor(Math.random() * 3);
    moods.forEach((mood, i) => {
      const ts = new Date(day);
      ts.setHours(baseHour + i * 3 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 60), 0, 0);
      if (ts > now) return;
      pings.push({
        user_id: userId,
        mood,
        emoji: EMOJIS[Math.max(0, Math.min(9, mood - 1))],
        activities: pick(ACTIVITIES, 1 + Math.floor(Math.random() * 3)),
        note: Math.random() > 0.7 ? "Демо запись" : null,
        source: "demo",
        created_at: ts.toISOString(),
      });
    });
  }

  // Insert in chunks to avoid payload limits
  for (let i = 0; i < pings.length; i += 100) {
    const chunk = pings.slice(i, i + 100);
    await supabase.from("mood_pings").insert(chunk);
  }

  // Sleep sessions for last 30 nights
  const sessions: Array<{
    user_id: string;
    started_at: string;
    ended_at: string;
    woken_at: string;
    quality: number;
    interruptions: number;
    avg_loudness: number;
    duration_minutes: number;
    smart_wake: boolean;
  }> = [];
  for (let dayOffset = 30; dayOffset >= 1; dayOffset--) {
    const night = new Date(now);
    night.setDate(night.getDate() - dayOffset);
    night.setHours(23, Math.floor(Math.random() * 60), 0, 0);
    const durationMin = 360 + Math.floor(Math.random() * 180); // 6–9h
    const end = new Date(night.getTime() + durationMin * 60_000);
    const quality = Math.max(1, Math.min(5, Math.round(3 + (Math.random() - 0.5) * 2)));
    sessions.push({
      user_id: userId,
      started_at: night.toISOString(),
      ended_at: end.toISOString(),
      woken_at: end.toISOString(),
      quality,
      interruptions: Math.floor(Math.random() * 4),
      avg_loudness: Number((Math.random() * 0.3).toFixed(3)),
      duration_minutes: durationMin,
      smart_wake: Math.random() > 0.3,
    });
  }
  for (let i = 0; i < sessions.length; i += 50) {
    await supabase.from("sleep_sessions").insert(sessions.slice(i, i + 50));
  }

  return { pings: pings.length, sleeps: sessions.length };
}
