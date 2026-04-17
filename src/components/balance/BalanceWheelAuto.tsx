// Адаптер: берёт user-defined sphere-set, маппит на старые/новые ключи и рисует колесо.
// Для built-in sphere id = StatKey, значение читается из glyph_stats напрямую.
// Для кастомных — считается «средняя»: сейчас 50 (placeholder). Дальше можно расширить
// до подсчёта по mood-pings, у которых активности матчат keywords.
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { defaultGlyphState, STAT_ORDER, type GlyphState, type StatKey } from "@/components/glyph/GlyphAvatar";
import { useUserSpheres } from "@/lib/useUserSpheres";
import { BalanceWheel } from "./BalanceWheel";

interface Props {
  size?: number;
  /** Bump to force re-fetch */
  refreshKey?: number;
}

export const BalanceWheelAuto = ({ size = 360, refreshKey = 0 }: Props) => {
  const { user } = useAuth();
  const { visible } = useUserSpheres();
  const [stats, setStats] = useState<GlyphState>(defaultGlyphState);
  const [customAvgs, setCustomAvgs] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const [{ data: gs }, { data: pings }] = await Promise.all([
        supabase.from("glyph_stats")
          .select("body,mind,emotions,relationships,career,finance,creativity,meaning")
          .eq("user_id", user.id).order("recorded_at", { ascending: false })
          .limit(1).maybeSingle(),
        supabase.from("mood_pings")
          .select("mood, activities, created_at")
          .eq("user_id", user.id)
          .gte("created_at", new Date(Date.now() - 30 * 86400_000).toISOString()),
      ]);
      if (gs) setStats(gs as GlyphState);

      // Для кастомных сфер считаем среднее настроение пингов, чьи активности матчат keywords,
      // и масштабируем 1..10 → 0..100.
      const custom = visible.filter((s) => !s.builtin);
      const out: Record<string, number> = {};
      for (const sph of custom) {
        const matched = (pings ?? []).filter((p) =>
          (p.activities ?? []).some((a) =>
            sph.keywords.some((k) => a.toLowerCase().includes(k) || k.includes(a.toLowerCase())),
          ),
        );
        if (matched.length) {
          const avg = matched.reduce((s, p) => s + p.mood, 0) / matched.length;
          out[sph.id] = Math.round(avg * 10);
        } else {
          out[sph.id] = 50;
        }
      }
      setCustomAvgs(out);
    })();
  }, [user, refreshKey, visible]);

  const values = useMemo(() => {
    const v: Record<string, number> = {};
    for (const sph of visible) {
      if (sph.builtin && STAT_ORDER.includes(sph.id as StatKey)) {
        v[sph.id] = stats[sph.id as StatKey] ?? 50;
      } else {
        v[sph.id] = customAvgs[sph.id] ?? 50;
      }
    }
    return v;
  }, [visible, stats, customAvgs]);

  return <BalanceWheel spheres={visible} values={values} size={size} />;
};
