// User-customisable spheres for the Balance Wheel.
// Stored in localStorage (key: 'balance.spheres.v1'). Default = built-in 8 stats.
// activityMap: lowercased label → sphere id. Used to auto-attribute mood-pings to spheres.
import { useEffect, useMemo, useState, useCallback } from "react";
import { STAT_META, STAT_ORDER, type StatKey } from "@/components/glyph/GlyphAvatar";

const STORE_KEY = "balance.spheres.v1";

export interface Sphere {
  id: string;          // 'body' | 'mind' | ... or custom 'sph_xxx'
  label: string;
  emoji: string;
  /** CSS variable token without `var()`, e.g. '--stat-body' */
  tokenVar: string;
  /** Activities/keywords that count toward this sphere (lowercased) */
  keywords: string[];
  /** Built-in spheres can't be deleted, only hidden */
  builtin: boolean;
  hidden?: boolean;
}

const DEFAULT_KEYWORDS: Record<StatKey, string[]> = {
  body: ["спорт", "тренировка", "бег", "йога", "зал", "прогулка", "сон", "еда"],
  mind: ["учёба", "учеба", "чтение", "медитация", "идея"],
  emotions: ["благодарность", "радость", "тревога", "стресс", "одиночество"],
  relationships: ["семья", "друзья", "общение", "свидание", "встреча"],
  career: ["работа", "встреча", "карьера", "проект"],
  finance: ["деньги", "финансы", "покупки"],
  creativity: ["творчество", "хобби", "рисование", "музыка"],
  meaning: ["смысл", "благодарность"],
};

// Extra colour tokens for custom spheres (cycle through)
const EXTRA_TOKENS = ["--ring-exercise", "--primary", "--stat-mind", "--stat-body", "--stat-emotions"];

const buildDefaults = (): Sphere[] =>
  STAT_ORDER.map((key) => ({
    id: key,
    label: STAT_META[key].label,
    emoji: STAT_META[key].emoji,
    tokenVar: STAT_META[key].tokenVar,
    keywords: DEFAULT_KEYWORDS[key] ?? [],
    builtin: true,
  }));

export const useUserSpheres = () => {
  const [spheres, setSpheres] = useState<Sphere[]>(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return buildDefaults();
      const parsed = JSON.parse(raw) as Sphere[];
      // forward-compat: ensure built-ins present
      const defaults = buildDefaults();
      const ids = new Set(parsed.map((s) => s.id));
      defaults.forEach((d) => {
        if (!ids.has(d.id)) parsed.push(d);
      });
      return parsed;
    } catch {
      return buildDefaults();
    }
  });

  useEffect(() => {
    localStorage.setItem(STORE_KEY, JSON.stringify(spheres));
  }, [spheres]);

  const visible = useMemo(() => spheres.filter((s) => !s.hidden), [spheres]);

  const addSphere = useCallback((label: string, emoji = "✨", keywords: string[] = []) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    setSpheres((prev) => {
      if (prev.some((s) => s.label.toLowerCase() === trimmed.toLowerCase())) return prev;
      const idx = prev.length;
      return [
        ...prev,
        {
          id: `sph_${Date.now().toString(36)}`,
          label: trimmed,
          emoji,
          tokenVar: EXTRA_TOKENS[idx % EXTRA_TOKENS.length],
          keywords: [trimmed.toLowerCase(), ...keywords.map((k) => k.toLowerCase())],
          builtin: false,
        },
      ];
    });
  }, []);

  const removeSphere = useCallback((id: string) => {
    setSpheres((prev) => prev.map((s) =>
      s.id === id
        ? s.builtin ? { ...s, hidden: true } : s
        : s,
    ).filter((s) => s.builtin || s.id !== id));
  }, []);

  const restoreSphere = useCallback((id: string) => {
    setSpheres((prev) => prev.map((s) => (s.id === id ? { ...s, hidden: false } : s)));
  }, []);

  const updateKeywords = useCallback((id: string, keywords: string[]) => {
    setSpheres((prev) => prev.map((s) => (s.id === id ? { ...s, keywords } : s)));
  }, []);

  /** label → sphere id (for activity auto-attribution). Returns null if no match. */
  const sphereForActivity = useCallback(
    (label: string): string | null => {
      const l = label.toLowerCase().trim();
      if (!l) return null;
      for (const s of visible) {
        if (s.keywords.some((k) => l.includes(k) || k.includes(l))) return s.id;
      }
      return null;
    },
    [visible],
  );

  return { spheres, visible, addSphere, removeSphere, restoreSphere, updateKeywords, sphereForActivity, setSpheres };
};
