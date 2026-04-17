import { useMemo } from "react";

export type StatKey =
  | "body"
  | "mind"
  | "emotions"
  | "relationships"
  | "career"
  | "finance"
  | "creativity"
  | "meaning";

export interface GlyphState {
  body: number;
  mind: number;
  emotions: number;
  relationships: number;
  career: number;
  finance: number;
  creativity: number;
  meaning: number;
}

export const STAT_META: Record<
  StatKey,
  { label: string; tokenVar: string; emoji: string }
> = {
  body: { label: "Тело", tokenVar: "--stat-body", emoji: "💪" },
  mind: { label: "Разум", tokenVar: "--stat-mind", emoji: "🧠" },
  emotions: { label: "Эмоции", tokenVar: "--stat-emotions", emoji: "💜" },
  relationships: { label: "Отношения", tokenVar: "--stat-relationships", emoji: "❤️" },
  career: { label: "Карьера", tokenVar: "--stat-career", emoji: "💼" },
  finance: { label: "Финансы", tokenVar: "--stat-finance", emoji: "💰" },
  creativity: { label: "Творчество", tokenVar: "--stat-creativity", emoji: "🎨" },
  meaning: { label: "Смысл", tokenVar: "--stat-meaning", emoji: "✨" },
};

export const STAT_ORDER: StatKey[] = [
  "body",
  "mind",
  "emotions",
  "relationships",
  "career",
  "finance",
  "creativity",
  "meaning",
];

export const defaultGlyphState: GlyphState = {
  body: 60,
  mind: 65,
  emotions: 55,
  relationships: 50,
  career: 70,
  finance: 45,
  creativity: 60,
  meaning: 50,
};

interface GlyphAvatarProps {
  state: GlyphState;
  size?: number;
  /** show numeric values inside center */
  showCenter?: boolean;
  className?: string;
}

/**
 * GlyphAvatar — concentric Activity-Rings showing 8 life stats as game-like radial bars.
 * Inspired by Apple watchOS Activity Rings, scaled to 8 dimensions.
 */
export const GlyphAvatar = ({
  state,
  size = 260,
  showCenter = true,
  className,
}: GlyphAvatarProps) => {
  const center = 100;
  const ringWidth = 6;
  const gap = 2;
  const outerRadius = 92;

  const rings = useMemo(() => {
    return STAT_ORDER.map((key, i) => {
      const r = outerRadius - i * (ringWidth + gap);
      const value = Math.max(0, Math.min(100, state[key]));
      const circumference = 2 * Math.PI * r;
      const dash = (value / 100) * circumference;
      return { key, r, value, circumference, dash };
    });
  }, [state]);

  const overall = Math.round(
    STAT_ORDER.reduce((sum, k) => sum + state[k], 0) / STAT_ORDER.length,
  );

  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="Life stats glyph"
    >
      {rings.map(({ key, r, circumference, dash }) => (
        <g key={key}>
          {/* Track */}
          <circle
            cx={center}
            cy={center}
            r={r}
            fill="none"
            stroke={`hsl(var(${STAT_META[key].tokenVar}) / 0.15)`}
            strokeWidth={ringWidth}
          />
          {/* Progress */}
          <circle
            cx={center}
            cy={center}
            r={r}
            fill="none"
            stroke={`hsl(var(${STAT_META[key].tokenVar}))`}
            strokeWidth={ringWidth}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference - dash}`}
            transform={`rotate(-90 ${center} ${center})`}
            style={{ transition: "stroke-dasharray 600ms cubic-bezier(0.4,0,0.2,1)" }}
          />
        </g>
      ))}

      {showCenter && (
        <g>
          <text
            x={center}
            y={center - 4}
            textAnchor="middle"
            className="mono"
            fill="hsl(var(--foreground))"
            style={{ fontSize: 22, fontWeight: 600 }}
          >
            {overall}
          </text>
          <text
            x={center}
            y={center + 14}
            textAnchor="middle"
            fill="hsl(var(--muted-foreground))"
            style={{ fontSize: 8, letterSpacing: 1.5, textTransform: "uppercase" }}
          >
            life score
          </text>
        </g>
      )}
    </svg>
  );
};
