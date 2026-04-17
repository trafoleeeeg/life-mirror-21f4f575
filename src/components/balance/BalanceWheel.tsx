import { useMemo } from "react";
import { STAT_ORDER, STAT_META, defaultGlyphState, type GlyphState } from "@/components/glyph/GlyphAvatar";

interface BalanceWheelProps {
  state?: GlyphState;
  size?: number;
  rings?: number;
  showLabels?: boolean;
  className?: string;
}

/**
 * Wheel of Life / Колесо баланса.
 * 8 секторов (по STAT_ORDER), каждый закрашен от центра по значению 0..100.
 * Концентрические круги-уровни 1..10 для считываемости.
 */
export const BalanceWheel = ({
  state = defaultGlyphState,
  size = 320,
  rings = 10,
  showLabels = true,
  className = "",
}: BalanceWheelProps) => {
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - (showLabels ? 56 : 8);
  const sectors = STAT_ORDER.length;
  const anglePer = (Math.PI * 2) / sectors;

  const arcs = useMemo(
    () =>
      STAT_ORDER.map((key, i) => {
        const value = state[key] ?? 0;
        const r = (value / 100) * outerR;
        const start = -Math.PI / 2 + i * anglePer;
        const end = start + anglePer;
        const x1 = cx + r * Math.cos(start);
        const y1 = cy + r * Math.sin(start);
        const x2 = cx + r * Math.cos(end);
        const y2 = cy + r * Math.sin(end);
        const largeArc = anglePer > Math.PI ? 1 : 0;
        const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;

        // label position
        const mid = start + anglePer / 2;
        const lr = outerR + 28;
        const lx = cx + lr * Math.cos(mid);
        const ly = cy + lr * Math.sin(mid);

        return { key, path, lx, ly, value, color: STAT_META[key].tokenVar };
      }),
    [state, outerR, cx, cy, anglePer],
  );

  const ringRadii = useMemo(
    () => Array.from({ length: rings }, (_, i) => ((i + 1) / rings) * outerR),
    [rings, outerR],
  );

  const spokes = useMemo(
    () =>
      Array.from({ length: sectors }, (_, i) => {
        const a = -Math.PI / 2 + i * anglePer;
        return {
          x: cx + outerR * Math.cos(a),
          y: cy + outerR * Math.sin(a),
        };
      }),
    [sectors, anglePer, outerR, cx, cy],
  );

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width="100%"
      height="100%"
      className={className}
      style={{ maxWidth: size }}
    >
      {/* sectors fill */}
      {arcs.map((a) => (
        <path
          key={`fill-${a.key}`}
          d={a.path}
          fill={`hsl(var(${a.color}) / 0.85)`}
          stroke="hsl(var(--background))"
          strokeWidth={1}
        />
      ))}

      {/* concentric rings */}
      {ringRadii.map((r, i) => (
        <circle
          key={`ring-${i}`}
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="hsl(var(--border) / 0.55)"
          strokeWidth={i === rings - 1 ? 1.5 : 0.75}
        />
      ))}

      {/* spokes */}
      {spokes.map((s, i) => (
        <line
          key={`spoke-${i}`}
          x1={cx}
          y1={cy}
          x2={s.x}
          y2={s.y}
          stroke="hsl(var(--border) / 0.7)"
          strokeWidth={0.75}
        />
      ))}

      {/* center dot */}
      <circle cx={cx} cy={cy} r={3} fill="hsl(var(--foreground))" />

      {/* labels */}
      {showLabels &&
        arcs.map((a) => {
          const anchor =
            a.lx < cx - 8 ? "end" : a.lx > cx + 8 ? "start" : "middle";
          return (
            <g key={`lbl-${a.key}`}>
              <text
                x={a.lx}
                y={a.ly}
                textAnchor={anchor}
                dominantBaseline="middle"
                className="fill-foreground"
                style={{ fontSize: 11, fontWeight: 600 }}
              >
                {STAT_META[a.key].label}
              </text>
              <text
                x={a.lx}
                y={a.ly + 13}
                textAnchor={anchor}
                dominantBaseline="middle"
                className="fill-muted-foreground"
                style={{ fontSize: 10 }}
              >
                {Math.round(a.value / 10)}/10
              </text>
            </g>
          );
        })}
    </svg>
  );
};
