// Сохранение/чтение/сверка утренних прогнозов настроения.
import { supabase } from "@/integrations/supabase/client";
import type { DbEntity } from "@/types/lifeMap";

export interface StoredForecastRow {
  id: string;
  day: string;
  predicted: number;
  baseline: number;
  contributions: { id: string; label: string; type: string; delta: number }[];
  morning_text: string | null;
  actual: number | null;
  actual_n: number | null;
  reconciled_at: string | null;
}

const todayKey = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
};

/**
 * Сохраняет (или обновляет) сегодняшний прогноз. Идемпотентно.
 */
export const upsertForecast = async (params: {
  userId: string;
  predicted: number;
  baseline: number;
  contributions: { ent: DbEntity; delta: number }[];
  morningText: string;
}) => {
  const payload = {
    user_id: params.userId,
    day: todayKey(),
    predicted: Number(params.predicted.toFixed(1)),
    baseline: Number(params.baseline.toFixed(1)),
    contributions: params.contributions.map((c) => ({
      id: c.ent.id,
      label: c.ent.custom_label || c.ent.label,
      type: c.ent.type,
      delta: Number(c.delta.toFixed(2)),
    })),
    morning_text: params.morningText.slice(0, 500),
  };
  const { error } = await supabase
    .from("mood_forecasts")
    .upsert(payload, { onConflict: "user_id,day" });
  if (error) console.warn("[forecast] upsert failed", error.message);
};

/**
 * Сверяет прошлые прогнозы с фактическим средним mood. Идёт за последние 8 дней,
 * проставляет actual для всех записей где его ещё нет и которые уже не «сегодня».
 */
export const reconcileForecasts = async (userId: string) => {
  const since = new Date(Date.now() - 8 * 86400_000).toISOString().slice(0, 10);
  const today = todayKey();
  const { data: pending } = await supabase
    .from("mood_forecasts")
    .select("id,day,actual")
    .eq("user_id", userId)
    .gte("day", since)
    .lt("day", today)
    .is("actual", null);

  if (!pending?.length) return;

  // Берём все mood_pings + checkins за этот период одним запросом
  const sinceISO = new Date(`${since}T00:00:00Z`).toISOString();
  const [{ data: pings }, { data: checks }] = await Promise.all([
    supabase
      .from("mood_pings")
      .select("created_at,mood")
      .eq("user_id", userId)
      .gte("created_at", sinceISO),
    supabase
      .from("checkins")
      .select("created_at,mood")
      .eq("user_id", userId)
      .gte("created_at", sinceISO)
      .not("mood", "is", null),
  ]);

  const dayMap = new Map<string, number[]>();
  pings?.forEach((p) => {
    const k = p.created_at.slice(0, 10);
    if (!dayMap.has(k)) dayMap.set(k, []);
    dayMap.get(k)!.push(p.mood);
  });
  checks?.forEach((c) => {
    if (c.mood == null) return;
    const k = c.created_at.slice(0, 10);
    if (!dayMap.has(k)) dayMap.set(k, []);
    dayMap.get(k)!.push(c.mood);
  });

  const now = new Date().toISOString();
  await Promise.all(
    pending.map(async (row) => {
      const moods = dayMap.get(row.day);
      if (!moods?.length) return;
      const avg = moods.reduce((s, x) => s + x, 0) / moods.length;
      await supabase
        .from("mood_forecasts")
        .update({
          actual: Number(avg.toFixed(1)),
          actual_n: moods.length,
          reconciled_at: now,
        })
        .eq("id", row.id);
    }),
  );
};

/**
 * Возвращает прогнозы за последние N дней (по умолчанию 8 — для виджета точности «за неделю»).
 */
export const fetchRecentForecasts = async (
  userId: string,
  days = 8,
): Promise<StoredForecastRow[]> => {
  const since = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
  const { data } = await supabase
    .from("mood_forecasts")
    .select("id,day,predicted,baseline,contributions,morning_text,actual,actual_n,reconciled_at")
    .eq("user_id", userId)
    .gte("day", since)
    .order("day", { ascending: false });
  return ((data ?? []) as unknown) as StoredForecastRow[];
};

/**
 * MAE (mean absolute error) между predicted и actual. null если нет сверённых.
 */
export const accuracyStats = (rows: StoredForecastRow[]) => {
  const reconciled = rows.filter((r) => r.actual != null);
  if (!reconciled.length) return { mae: null as number | null, count: 0, hits: 0 };
  const errs = reconciled.map((r) => Math.abs((r.actual as number) - r.predicted));
  const mae = errs.reduce((s, x) => s + x, 0) / errs.length;
  // hit = ошибка ≤ 1 балл по шкале 1-10
  const hits = errs.filter((e) => e <= 1).length;
  return { mae, count: reconciled.length, hits };
};
