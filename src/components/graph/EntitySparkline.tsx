// Inline SVG: mood sparkline + точки-маркеры дней с упоминанием сущности.
import type { EntitySeriesPoint } from "@/lib/lifeMap";

interface Props {
  series: EntitySeriesPoint[];
  width?: number;
  height?: number;
  tone?: "up" | "down" | "neutral";
}

export const EntitySparkline = ({ series, width = 96, height = 22, tone = "neutral" }: Props) => {
  if (!series.length) return null;
  const stroke =
    tone === "up" ? "var(--ring-exercise)" : tone === "down" ? "var(--stat-body)" : "var(--muted-foreground)";

  const moods = series.map((p) => p.mood).filter((m): m is number => m != null);
  const min = moods.length ? Math.min(...moods) : 0;
  const max = moods.length ? Math.max(...moods) : 10;
  const range = Math.max(1, max - min);
  const stepX = series.length > 1 ? width / (series.length - 1) : 0;

  // Линия mood — пропускаем дни без данных через "M…L…M…"
  let path = "";
  let pen = false;
  series.forEach((p, i) => {
    if (p.mood == null) {
      pen = false;
      return;
    }
    const x = i * stepX;
    const y = height - ((p.mood - min) / range) * (height - 4) - 2;
    path += `${pen ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)} `;
    pen = true;
  });

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="shrink-0"
      aria-hidden
    >
      {/* Маркеры упоминаний — тонкие столбики снизу */}
      {series.map((p, i) =>
        p.mentioned ? (
          <rect
            key={`m-${i}`}
            x={i * stepX - 0.6}
            y={height - 3}
            width={1.2}
            height={3}
            fill={`hsl(${stroke} / 0.55)`}
          />
        ) : null,
      )}
      {path && (
        <path
          d={path.trim()}
          fill="none"
          stroke={`hsl(${stroke})`}
          strokeWidth={1.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.85}
        />
      )}
    </svg>
  );
};
