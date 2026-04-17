import { GlyphState, defaultGlyphState } from "@/components/glyph/GlyphAvatar";

export interface UserProfile {
  name: string;
  tone: "soft" | "hard" | "socratic";
  glyph: GlyphState;
  answers: Record<string, number>;
  createdAt: number;
}

export const loadProfile = (): UserProfile => {
  try {
    const raw = localStorage.getItem("ig:profile");
    if (raw) return JSON.parse(raw) as UserProfile;
  } catch {
    /* noop */
  }
  return {
    name: "Гость",
    tone: "soft",
    glyph: defaultGlyphState,
    answers: {},
    createdAt: Date.now(),
  };
};

export const saveProfile = (p: UserProfile) => {
  localStorage.setItem("ig:profile", JSON.stringify(p));
};
