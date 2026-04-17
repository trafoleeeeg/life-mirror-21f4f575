// Универсальное «Колесо баланса» на пользовательских сферах.
// Принимает готовый список сфер + значения (0..100) на каждый sphere.id.
// Лейблы:
//  - выводятся за пределами кольца с автоподложкой и truncate ≤10 символов;
//  - выравнивание зависит от cosA (start/middle/end);
//  - viewBox увеличен с запасом, чтобы текст никогда не уходил.
import { useMemo } from "react";

export interface WheelSphere {
  id: string;
  label: string;
  emoji?: string;
  tokenVar: string; // '--stat-body'
}

interface Props {
  spheres: WheelSphere[];
  values: Record<string, number>; // 0..100 by sphere.id
  size?: number;
  rings?: number;
  className?: string;
  showLabels?: boolean;
}

export const BalanceWheel = ({
  spheres,
  values,
  size = 360,
  rings = 5,
  className = "",
  showLabels = true,
}: Props) => {
  const VIEW = 520; // фиксированный viewBox; size — масштаб
  const cx = VIEW / 2;
  const cy = VIEW / 2;
  const labelPad = showLabels ? 116 : 12;
  const outerR = VIEW / 2 - labelPad;
  const innerR = outerR * 0.18;
  const sectors = Math.max(1, spheres.length);
  const anglePer = (Math.PI * 2) / sectors;
  const gapDeg = sectors > 6 ? 1.0 : 1.5;
  const gapRad = (gapDeg * Math.PI) / 180;

  const overall = useMemo(() => {
    if (!spheres.length) return 0;
    const sum = spheres.reduce((s, sph) => s + (values[sph.id] ?? 0), 0);
    return Math.round(sum / spheres.length);
  }, [spheres, values]);

  const sectorPath = (aStart: number, aEnd: number, rOut: number, rIn: number) => {
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
    return spheres.map((sph, i) => {
      const value = Math.max(0, Math.min(100, values[sph.id] ?? 0));
      const start = -Math.PI / 2 + i * anglePer + gapRad / 2;
      const end = start + anglePer - gapRad;
      const bg = sectorPath(start, end, outerR, innerR);
      const r = innerR + (value / 100) * (outerR - innerR);
      const fg = sectorPath(start, end, r, innerR);
      const mid = (start + end) / 2;
      const lr = outerR + 26;
      return {
        sphere: sph,
        bg, fg, value,
        midAngle: mid,
        lx: cx + lr * Math.cos(mid),
        ly: cy + lr * Math.sin(mid),
      };
    });
  }, [spheres, values, anglePer, gapRad, outerR, innerR, cx, cy]);

  const ringRadii = useMemo(
    () =>
      Array.from({ length: rings - 1 }, (_, i) =>
        innerR + ((i + 1) / rings) * (outerR - innerR),
      ),
    [rings, outerR, innerR],
  );

  // Перенос лейбла на ≤2 строки. Сначала пробуем по пробелу; если слово слишком длинное — режем посимвольно.
  const wrapLabel = (s: string, maxPerLine = 11): string[] => {
    if (s.length <= maxPerLine) return [s];
    const words = s.split(/\s+/);
    if (words.length > 1) {
      let l1 = "", l2 = "";
      for (const w of words) {
        if ((l1 + " " + w).trim().length <= maxPerLine && !l2) l1 = (l1 ? l1 + " " : "") + w;
        else l2 = (l2 ? l2 + " " : "") + w;
      }
      if (l2.length > maxPerLine) l2 = l2.slice(0, maxPerLine - 1) + "…";
      return [l1, l2];
    }
    return [s.slice(0, maxPerLine), s.slice(maxPerLine, maxPerLine * 2 - 1) + (s.length > maxPerLine * 2 - 1 ? "…" : "")];
  };

  return (
    <svg
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      width="100%"
      height="100%"
      className={`drop-shadow-[0_0_30px_hsl(var(--primary)/0.15)] ${className}`}
      style={{ maxWidth: size }}
    >
      <defs>
        {spheres.map((sph) => (
          <radialGradient key={`grad-${sph.id}`} id={`grad-${sph.id}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={`hsl(var(${sph.tokenVar}) / 0.55)`} />
            <stop offset="100%" stopColor={`hsl(var(${sph.tokenVar}) / 0.95)`} />
          </radialGradient>
        ))}
        <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="hsl(var(--primary) / 0.35)" />
          <stop offset="100%" stopColor="hsl(var(--primary) / 0)" />
        </radialGradient>
      </defs>

      <circle cx={cx} cy={cy} r={outerR + 6} fill="none"
        stroke="hsl(var(--border) / 0.5)" strokeWidth={0.75} />

      {arcs.map((a) => (
        <path key={`bg-${a.sphere.id}`} d={a.bg}
          fill="hsl(var(--muted) / 0.35)" stroke="hsl(var(--background))" strokeWidth={0.5} />
      ))}

      {ringRadii.map((r, i) => (
        <circle key={`ring-${i}`} cx={cx} cy={cy} r={r} fill="none"
          stroke="hsl(var(--border) / 0.35)" strokeWidth={0.6} strokeDasharray="2 3" />
      ))}

      {arcs.map((a) => (
        <path key={`fg-${a.sphere.id}`} d={a.fg}
          fill={`url(#grad-${a.sphere.id})`}
          style={{
            filter: `drop-shadow(0 0 6px hsl(var(${a.sphere.tokenVar}) / 0.4))`,
            transition: "all 600ms cubic-bezier(0.22, 1, 0.36, 1)",
          }} />
      ))}

      <circle cx={cx} cy={cy} r={innerR * 1.6} fill="url(#centerGlow)" />
      <circle cx={cx} cy={cy} r={innerR}
        fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth={1} />

      <text x={cx} y={cy - 2} textAnchor="middle" dominantBaseline="middle"
        className="fill-foreground"
        style={{ fontSize: innerR * 0.55, fontWeight: 700, fontFamily: "ui-monospace, monospace" }}>
        {overall}
      </text>
      <text x={cx} y={cy + innerR * 0.45} textAnchor="middle" dominantBaseline="middle"
        className="fill-muted-foreground"
        style={{ fontSize: innerR * 0.22, letterSpacing: 1.5, textTransform: "uppercase" }}>
        Баланс
      </text>

      {showLabels && arcs.map((a) => {
        const cosA = Math.cos(a.midAngle);
        const sinA = Math.sin(a.midAngle);
        const anchor: "start" | "middle" | "end" =
          cosA < -0.2 ? "end" : cosA > 0.2 ? "start" : "middle";
        const dy = sinA < -0.7 ? -8 : sinA > 0.7 ? 12 : 0;
        const labelY = a.ly + dy;
        const lines = wrapLabel(a.sphere.label, 11);
        const lineH = 13;
        const totalH = lines.length * lineH;
        const startY = labelY - totalH / 2;
        return (
          <g key={`lbl-${a.sphere.id}`}>
            {lines.map((ln, idx) => (
              <text
                key={idx}
                x={a.lx}
                y={startY + idx * lineH}
                textAnchor={anchor}
                dominantBaseline="middle"
                className="fill-foreground"
                style={{ fontSize: 12, fontWeight: 600 }}
              >
                {idx === 0 && a.sphere.emoji ? `${a.sphere.emoji} ` : ""}{ln}
              </text>
            ))}
            <text
              x={a.lx}
              y={startY + totalH + 2}
              textAnchor={anchor}
              dominantBaseline="middle"
              style={{
                fontSize: 11, fontFamily: "ui-monospace, monospace",
                fill: `hsl(var(${a.sphere.tokenVar}))`, fontWeight: 600,
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
