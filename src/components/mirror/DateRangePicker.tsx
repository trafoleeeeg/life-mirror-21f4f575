import { useState } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";

export type Preset = "7d" | "30d" | "90d" | "365d" | "custom";

const PRESET_LABELS: Record<Preset, string> = {
  "7d": "7 дней",
  "30d": "30 дней",
  "90d": "90 дней",
  "365d": "Год",
  custom: "Свой",
};

export const presetToRange = (p: Preset): DateRange => {
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const days = p === "7d" ? 6 : p === "30d" ? 29 : p === "90d" ? 89 : p === "365d" ? 364 : 29;
  from.setDate(from.getDate() - days);
  return { from, to };
};

interface Props {
  range: DateRange;
  onChange: (r: DateRange) => void;
  preset: Preset;
  onPresetChange: (p: Preset) => void;
}

export const DateRangePicker = ({ range, onChange, preset, onPresetChange }: Props) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex p-1 rounded-full bg-secondary">
        {(Object.keys(PRESET_LABELS) as Preset[])
          .filter((p) => p !== "custom")
          .map((p) => (
            <button
              key={p}
              onClick={() => {
                onPresetChange(p);
                onChange(presetToRange(p));
              }}
              className={cn(
                "px-3 py-1 rounded-full text-xs transition-colors",
                preset === p
                  ? "bg-background text-foreground shadow"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {PRESET_LABELS[p]}
            </button>
          ))}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn("rounded-full text-xs gap-2", preset === "custom" && "border-primary")}
          >
            <CalendarIcon className="size-3.5" />
            {range.from && range.to
              ? `${format(range.from, "d MMM", { locale: ru })} — ${format(range.to, "d MMM", { locale: ru })}`
              : "Выбрать"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={range}
            onSelect={(r) => {
              if (r?.from && r?.to) {
                onPresetChange("custom");
                onChange(r);
                setOpen(false);
              } else if (r) {
                onChange(r);
              }
            }}
            numberOfMonths={2}
            locale={ru}
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};
