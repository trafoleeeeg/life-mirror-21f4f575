import { GlyphState, defaultGlyphState } from "@/components/glyph/GlyphAvatar";

export interface UserProfile {
  name: string;
  tone: "soft" | "hard" | "socratic";
  glyph: GlyphState;
  createdAt: number;
}

const KEY = "ig:profile";

export const loadProfile = (): UserProfile => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<UserProfile>;
      return {
        name: parsed.name ?? "Гость",
        tone: parsed.tone ?? "soft",
        glyph: { ...defaultGlyphState, ...(parsed.glyph as GlyphState) },
        createdAt: parsed.createdAt ?? Date.now(),
      };
    }
  } catch {
    /* noop */
  }
  return {
    name: "Гость",
    tone: "soft",
    glyph: defaultGlyphState,
    createdAt: Date.now(),
  };
};

export const saveProfile = (p: UserProfile) => {
  localStorage.setItem(KEY, JSON.stringify(p));
};
