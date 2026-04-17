// GitHub-style contributions heatmap for the last N days.
// Renders a grid of weeks (columns) × 7 weekdays (rows).
import { useMemo } from "react";

interface HeatmapProps {
  /** ISO date strings (created_at). Multiple per day are counted. */
  dates: string[];
  days?: number; // default 90
}

const LEVELS = 5;

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function Heatmap({ dates, days = 90 }: HeatmapProps) {
  const { weeks, max, total } = useMemo(() => {
    const counts = new Map<string, number>();
    for (const iso of dates) {
      const d = new Date(iso);
      const k = dayKey(d);
      counts.set(k, (counts.get(k) || 0) + 1);
    }

    // build day list ending today, length = days, aligned so the LAST column
    // contains the current week (Mon..Sun)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // We want columns to be calendar weeks. Find the start: go back `days`
    // days, then back to the start of that week (Mon).
    const start = new Date(today);
    start.setDate(start.getDate() - (days - 1));
    // align to Monday (1). getDay: 0=Sun..6=Sat -> shift to Mon=0..Sun=6
    const dow = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - dow);

    const cells: { date: Date; count: number; inRange: boolean }[] = [];
    const cursor = new Date(start);
    const endExclusive = new Date(today);
    endExclusive.setDate(endExclusive.getDate() + 1);
    // pad to fill the last week (until Sunday after today)
    const endDow = (endExclusive.getDay() + 6) % 7; // 0..6 Mon..Sun
    const padEnd = new Date(endExclusive);
    padEnd.setDate(padEnd.getDate() + (7 - endDow));

    let max = 0;
    while (cursor < padEnd) {
      const k = dayKey(cursor);
      const c = counts.get(k) || 0;
      const rangeStart = new Date(today);
      rangeStart.setDate(rangeStart.getDate() - (days - 1));
      const inRange = cursor >= rangeStart && cursor <= today;
      cells.push({ date: new Date(cursor), count: c, inRange });
      if (inRange && c > max) max = c;
      cursor.setDate(cursor.getDate() + 1);
    }

    const weeks: { date: Date; count: number; inRange: boolean }[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }
    const total = Array.from(counts.entries()).reduce((s, [, v]) => s + v, 0);
    return { weeks, max: Math.max(1, max), total };
  }, [dates, days]);

  const level = (count: number) => {
    if (count <= 0) return 0;
    const ratio = count / max;
    if (ratio >= 0.85) return 4;
    if (ratio >= 0.6) return 3;
    if (ratio >= 0.35) return 2;
    return 1;
  };

  // semantic color tokens via inline opacity over primary
  const cellBg = (lvl: number, inRange: boolean) => {
    if (!inRange) return "hsl(var(--muted) / 0.25)";
    if (lvl === 0) return "hsl(var(--muted) / 0.55)";
    const opacities = [0, 0.28, 0.5, 0.75, 1];
    return `hsl(var(--primary) / ${opacities[lvl]})`;
  };

  // month labels — show on first cell of month (week column)
  const monthLabels = weeks.map((week) => {
    const firstInRange = week.find((c) => c.inRange) || week[0];
    return firstInRange.date.getDate() <= 7
      ? firstInRange.date.toLocaleDateString("ru", { month: "short" })
      : "";
  });

  return (
    <div className="w-full overflow-x-auto">
      <div className="inline-block">
        {/* month row */}
        <div className="flex gap-[3px] pl-[28px] mb-1">
          {monthLabels.map((m, i) => (
            <div
              key={i}
              className="mono text-[9px] uppercase tracking-wider text-muted-foreground w-[12px]"
            >
              {m}
            </div>
          ))}
        </div>
        <div className="flex gap-1">
          {/* weekday labels */}
          <div className="flex flex-col gap-[3px] mr-1 mono text-[9px] uppercase tracking-wider text-muted-foreground">
            {["", "Вт", "", "Чт", "", "Сб", ""].map((d, i) => (
              <div key={i} className="h-[12px] leading-[12px] w-[18px] text-right">
                {d}
              </div>
            ))}
          </div>
          {/* weeks */}
          <div className="flex gap-[3px]">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {week.map((cell, di) => {
                  const lvl = level(cell.count);
                  return (
                    <div
                      key={di}
                      className="size-[12px] rounded-[3px]"
                      style={{ backgroundColor: cellBg(lvl, cell.inRange) }}
                      title={
                        cell.inRange
                          ? `${cell.date.toLocaleDateString("ru", {
                              day: "numeric",
                              month: "long",
                            })} · ${cell.count} ${cell.count === 1 ? "чек-ин" : "чек-инов"}`
                          : undefined
                      }
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        {/* legend */}
        <div className="flex items-center gap-2 mt-2 mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <span>{total} за {days} дн</span>
          <span className="ml-auto flex items-center gap-1">
            меньше
            {Array.from({ length: LEVELS }).map((_, i) => (
              <span
                key={i}
                className="size-[10px] rounded-[2px]"
                style={{ backgroundColor: cellBg(i, true) }}
              />
            ))}
            больше
          </span>
        </div>
      </div>
    </div>
  );
}
