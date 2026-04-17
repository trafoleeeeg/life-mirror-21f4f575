import { useMemo } from "react";

export interface GlyphState {
  /** 0–100, overall life integrity */
  integrity: number;
  /** 0–100 */
  energy: number;
  /** 0–100 */
  calm: number;
  /** 0–100 */
  growth: number;
  /** seed for deterministic shape */
  seed: number;
}

interface GlyphAvatarProps {
  state: GlyphState;
  size?: number;
  animated?: boolean;
  className?: string;
}

/**
 * Procedural personal Glyph — SVG avatar whose shape, density and color
 * are derived from the user's psychological state. Updates daily.
 */
export const GlyphAvatar = ({ state, size = 220, animated = true, className }: GlyphAvatarProps) => {
  const { paths, rays, hue, secondHue, opacity } = useMemo(() => {
    const cx = 100;
    const cy = 100;
    const layers = 3 + Math.round((state.integrity / 100) * 4); // 3–7 layers
    const rayCount = 6 + Math.round((state.energy / 100) * 18); // 6–24
    const baseR = 28 + (state.calm / 100) * 22;

    // Color shifts with growth + calm
    const hue = 188 - state.growth * 0.2 + (state.calm - 50) * 0.4; // cyan ↔ teal
    const secondHue = 268 + (state.growth - 50) * 0.6; // violet ↔ magenta

    const rng = (i: number) => {
      const x = Math.sin(state.seed * 9999 + i * 137.13) * 10000;
      return x - Math.floor(x);
    };

    const paths: string[] = [];
    for (let l = 0; l < layers; l++) {
      const points = 7 + Math.round(rng(l) * 5);
      const r = baseR + l * 8;
      const wobble = (1 - state.integrity / 100) * 18; // less integrity = more chaos
      let d = "";
      for (let i = 0; i <= points; i++) {
        const t = (i / points) * Math.PI * 2;
        const rr = r + (rng(l * 31 + i) - 0.5) * wobble;
        const x = cx + Math.cos(t + rng(l) * 6.28) * rr;
        const y = cy + Math.sin(t + rng(l) * 6.28) * rr;
        d += i === 0 ? `M ${x.toFixed(2)} ${y.toFixed(2)}` : ` Q ${cx} ${cy} ${x.toFixed(2)} ${y.toFixed(2)}`;
      }
      paths.push(d + " Z");
    }

    const rays: { x1: number; y1: number; x2: number; y2: number; o: number }[] = [];
    for (let i = 0; i < rayCount; i++) {
      const t = (i / rayCount) * Math.PI * 2;
      const rIn = baseR * 0.9;
      const rOut = baseR + 28 + rng(i + 200) * 22 * (state.energy / 100);
      rays.push({
        x1: cx + Math.cos(t) * rIn,
        y1: cy + Math.sin(t) * rIn,
        x2: cx + Math.cos(t) * rOut,
        y2: cy + Math.sin(t) * rOut,
        o: 0.25 + rng(i + 300) * 0.6,
      });
    }

    const opacity = 0.35 + (state.integrity / 100) * 0.55;

    return { paths, rays, hue, secondHue, opacity };
  }, [state]);

  const id = `glyph-${state.seed}`;

  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={className}
      aria-label="Personal glyph"
      role="img"
    >
      <defs>
        <radialGradient id={`${id}-core`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={`hsl(${hue}, 95%, 70%)`} stopOpacity="0.95" />
          <stop offset="60%" stopColor={`hsl(${secondHue}, 85%, 55%)`} stopOpacity="0.5" />
          <stop offset="100%" stopColor={`hsl(${secondHue}, 60%, 25%)`} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-stroke`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={`hsl(${hue}, 95%, 65%)`} />
          <stop offset="100%" stopColor={`hsl(${secondHue}, 90%, 65%)`} />
        </linearGradient>
        <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <circle cx="100" cy="100" r="92" fill={`url(#${id}-core)`} opacity="0.6" />

      <g
        className={animated ? "animate-spin-slow" : undefined}
        style={{ transformOrigin: "100px 100px" }}
      >
        {rays.map((r, i) => (
          <line
            key={i}
            x1={r.x1}
            y1={r.y1}
            x2={r.x2}
            y2={r.y2}
            stroke={`url(#${id}-stroke)`}
            strokeWidth="0.6"
            opacity={r.o * opacity}
            strokeLinecap="round"
          />
        ))}
      </g>

      <g filter={`url(#${id}-glow)`} className={animated ? "animate-pulse-glow" : undefined}>
        {paths.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke={`url(#${id}-stroke)`}
            strokeWidth={1.2 - i * 0.12}
            opacity={opacity - i * 0.06}
            strokeLinejoin="round"
          />
        ))}
      </g>

      <circle cx="100" cy="100" r="3" fill={`hsl(${hue}, 100%, 85%)`} />
    </svg>
  );
};

export const defaultGlyphState: GlyphState = {
  integrity: 62,
  energy: 70,
  calm: 55,
  growth: 48,
  seed: 7,
};
