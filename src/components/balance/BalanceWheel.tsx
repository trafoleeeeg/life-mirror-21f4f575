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
 * Полированное «Колесо баланса» — мягкие сектора с радиальным градиентом, glow-кольцо,
 * центральный балл и круговые риски. Без артефактов на стыках секторов.
 */
export const BalanceWheel = ({
  state = defaultGlyphState,
  size = 320,
  rings = 5,
  showLabels = true,
  className = "",
}: BalanceWheelProps) => {
  const cx = size / 2;
  const cy = size / 2;
  const labelPad = showLabels ? 64 : 12;
  const outerR = size / 2 - labelPad;
  const innerR = outerR * 0.18; // hollow center
  const sectors = STAT_ORDER.length;
  const anglePer = (Math.PI * 2) / sectors;
  const gapDeg = 1.2; // в градусах — крошечный зазор между лепестками
  const gapRad = (gapDeg * Math.PI) / 180;

  const overall = useMemo(() => {
    const sum = STAT_ORDER.reduce((s, k) => s + (state[k] ?? 0), 0);
    return Math.round(sum / STAT_ORDER.length);
  }, [state]);

  // Donut-arc path between two radii
  const sectorPath = (
    aStart: number,
    aEnd: number,
    rOut: number,
    rIn: number,
  ) => {
    const x1 = cx + rOut * Math.cos(aStart);
    const y1 = cy + rOut * Math.sin(aStart);
    const x2 = cx + rOut * Math.cos(aEnd);
    const y2 = cy + rOut * Math.sin(aEnd);
    const x3 = cx + rIn * Math.cos(aEnd);
    const y3 = cy + rIn * Math.sin(aEnd);
    const x4 = cx + rIn * Math.cos(aStart);
    const y4 = cy + rIn * Math.sin(aStart);
    const largeArc = aEnd - aStart > Math.PI ? 1 : 0;
    return [
      `M ${x1.toFixed(2)} ${y1.toFixed(2)}`,
      `A ${rOut} ${rOut} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
      `L ${x3.toFixed(2)} ${y3.toFixed(2)}`,
      `A ${rIn} ${rIn} 0 ${largeArc} 0 ${x4.toFixed(2)} ${y4.toFixed(2)}`,
      "Z",
    ].join(" ");
  };

  const arcs = useMemo(() => {
    return STAT_ORDER.map((key, i) => {
      const value = state[key] ?? 0;
      const start = -Math.PI / 2 + i * anglePer + gapRad / 2;
      const end = start + anglePer - gapRad;
      // background full ring
      const bg = sectorPath(start, end, outerR, innerR);
      // value arc — растёт от центра к краю
      const r = innerR + (value / 100) * (outerR - innerR);
      const fg = sectorPath(start, end, r, innerR);
      const mid = (start + end) / 2;
      const lr = outerR + 30;
      return {
        key,
        bg,
        fg,
        value,
        midAngle: mid,
        lx: cx + lr * Math.cos(mid),
        ly: cy + lr * Math.sin(mid),
        token: STAT_META[key].tokenVar,
      };
    });
  }, [state, outerR, innerR, anglePer, gapRad, cx, cy]);

  const ringRadii = useMemo(
    () =>
      Array.from(
        { length: rings - 1 },
        (_, i) => innerR + ((i + 1) / rings) * (outerR - innerR),
      ),
    [rings, outerR, innerR],
  );

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width="100%"
      height="100%"
      className={`drop-shadow-[0_0_30px_hsl(var(--primary)/0.15)] ${className}`}
      style={{ maxWidth: size }}
    >
      <defs>
        {STAT_ORDER.map((key) => {
          const t = STAT_META[key].tokenVar;
          return (
            <radialGradient
              key={`grad-${key}`}
              id={`grad-${key}`}
              cx="50%"
              cy="50%"
              r="50%"
              fx="50%"
              fy="50%"
            >
              <stop offset="0%" stopColor={`hsl(var(${t}) / 0.55)`} />
              <stop offset="100%" stopColor={`hsl(var(${t}) / 0.95)`} />
            </radialGradient>
          );
        })}
        <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="hsl(var(--primary) / 0.35)" />
          <stop offset="100%" stopColor="hsl(var(--primary) / 0)" />
        </radialGradient>
      </defs>

      {/* outer subtle ring */}
      <circle
        cx={cx}
        cy={cy}
        r={outerR + 6}
        fill="none"
        stroke="hsl(var(--border) / 0.5)"
        strokeWidth={0.75}
      />

      {/* background sectors */}
      {arcs.map((a) => (
        <path
          key={`bg-${a.key}`}
          d={a.bg}
          fill="hsl(var(--muted) / 0.35)"
          stroke="hsl(var(--background))"
          strokeWidth={0.5}
        />
      ))}

      {/* concentric guide rings (внутри сектора) */}
      {ringRadii.map((r, i) => (
        <circle
          key={`ring-${i}`}
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="hsl(var(--border) / 0.35)"
          strokeWidth={0.6}
          strokeDasharray="2 3"
        />
      ))}

      {/* value sectors with gradient */}
      {arcs.map((a) => (
        <g key={`fg-${a.key}`} className="origin-center">
          <path
            d={a.fg}
            fill={`url(#grad-${a.key})`}
            style={{
              filter: `drop-shadow(0 0 6px hsl(var(${a.token}) / 0.4))`,
              transition: "all 600ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          />
        </g>
      ))}

      {/* center glow */}
      <circle cx={cx} cy={cy} r={innerR * 1.6} fill="url(#centerGlow)" />
      {/* center disc */}
      <circle
        cx={cx}
        cy={cy}
        r={innerR}
        fill="hsl(var(--card))"
        stroke="hsl(var(--border))"
        strokeWidth={1}
      />
      {/* score */}
      <text
        x={cx}
        y={cy - 2}
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-foreground"
        style={{ fontSize: innerR * 0.55, fontWeight: 700, fontFamily: "ui-monospace, monospace" }}
      >
        {overall}
      </text>
      <text
        x={cx}
        y={cy + innerR * 0.45}
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-muted-foreground"
        style={{ fontSize: innerR * 0.22, letterSpacing: 1.5, textTransform: "uppercase" }}
      >
        Баланс
      </text>

      {/* labels */}
      {showLabels &&
        arcs.map((a) => {
          const cosA = Math.cos(a.midAngle);
          const anchor = cosA < -0.15 ? "end" : cosA > 0.15 ? "start" : "middle";
          return (
            <g key={`lbl-${a.key}`}>
              <text
                x={a.lx}
                y={a.ly - 6}
                textAnchor={anchor}
                dominantBaseline="middle"
                className="fill-foreground"
                style={{ fontSize: 11, fontWeight: 600 }}
              >
                {STAT_META[a.key].label}
              </text>
              <text
                x={a.lx}
                y={a.ly + 8}
                textAnchor={anchor}
                dominantBaseline="middle"
                style={{
                  fontSize: 10,
                  fontFamily: "ui-monospace, monospace",
                  fill: `hsl(var(${a.token}))`,
                  fontWeight: 600,
                }}
              >
                {Math.round(a.value)}
              </text>
            </g>
          );
        })}
    </svg>
  );
};
