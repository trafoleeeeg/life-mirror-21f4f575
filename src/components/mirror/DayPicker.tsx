import { useState } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Props {
  date: Date;
  onChange: (d: Date) => void;
}

export const DayPicker = ({ date, onChange }: Props) => {
  const [open, setOpen] = useState(false);
  const isToday = date.toDateString() === new Date().toDateString();

  const shift = (n: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    if (d > new Date()) return;
    onChange(d);
  };

  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="icon" className="rounded-full" onClick={() => shift(-1)}>
        <ChevronLeft className="size-4" />
      </Button>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="rounded-full text-xs gap-2 min-w-[160px] justify-center">
            <CalendarIcon className="size-3.5" />
            {isToday ? "Сегодня" : format(date, "d MMMM yyyy", { locale: ru })}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(d) => {
              if (d) {
                onChange(d);
                setOpen(false);
              }
            }}
            disabled={(d) => d > new Date()}
            locale={ru}
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full"
        onClick={() => shift(1)}
        disabled={isToday}
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
};
