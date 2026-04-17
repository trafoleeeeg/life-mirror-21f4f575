// Раздел «Сон» — собирает всё, что касается сна, в одном месте:
// — трекер (запуск сессии, smart-будильник),
// — гипнограмма последних ночей (Sleep-Cycle-style),
// — корреляция «сон → настроение следующего дня».
import { useState } from "react";
import { Moon } from "lucide-react";
import { SleepTracker } from "@/components/sleep/SleepTracker";
import { SleepHistory } from "@/components/sleep/SleepHistory";
import { SleepCorrelation } from "@/components/mirror/SleepCorrelation";

const Sleep = () => {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-5 pb-8">
      <header className="flex items-end justify-between flex-wrap gap-3 animate-fade-in">
        <div>
          <p className="text-muted-foreground text-sm flex items-center gap-1.5">
            <Moon className="size-3.5" /> Раздел
          </p>
          <h1 className="text-3xl font-bold tracking-tight">Сон</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Трекер ночей, фазы сна и связь с настроением
          </p>
        </div>
      </header>

      <div className="animate-slide-up" style={{ animationDelay: "60ms", animationFillMode: "both" }}>
        <SleepTracker onSaved={() => setRefreshKey((k) => k + 1)} />
      </div>

      <div className="animate-slide-up" style={{ animationDelay: "120ms", animationFillMode: "both" }}>
        <SleepHistory key={`hist-${refreshKey}`} />
      </div>

      <div className="animate-slide-up" style={{ animationDelay: "180ms", animationFillMode: "both" }}>
        <SleepCorrelation key={`corr-${refreshKey}`} days={60} />
      </div>
    </div>
  );
};

export default Sleep;
