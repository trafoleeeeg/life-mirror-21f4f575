// Табы в Threads-стиле: подчёркивание под активным.
import { cn } from "@/lib/utils";

export interface ProfileTab {
  id: string;
  label: string;
}

interface Props {
  tabs: ProfileTab[];
  active: string;
  onChange: (id: string) => void;
}

export const ProfileTabs = ({ tabs, active, onChange }: Props) => {
  return (
    <div className="sticky top-12 md:top-0 z-10 bg-background/85 backdrop-blur-xl border-b border-border/50 flex">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "flex-1 py-3 text-sm font-medium relative transition-colors",
            active === t.id ? "text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
          {active === t.id && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground" />
          )}
        </button>
      ))}
    </div>
  );
};
