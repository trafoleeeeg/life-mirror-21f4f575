import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Sparkles,
  MessageCircle,
  ClipboardCheck,
  Network,
  LineChart,
  Rss,
  Mail,
  Trophy,
  BookOpen,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/app", label: "Глиф", icon: Sparkles, end: true },
  { to: "/app/chat", label: "Психолог", icon: MessageCircle },
  { to: "/app/checkin", label: "Чек-ин", icon: ClipboardCheck },
  { to: "/app/graph", label: "Граф", icon: Network },
  { to: "/app/dashboard", label: "Зеркало", icon: LineChart },
  { to: "/app/feed", label: "Лента", icon: Rss },
  { to: "/app/dms", label: "Сообщения", icon: Mail },
  { to: "/app/progress", label: "Прогресс", icon: Trophy },
  { to: "/app/learn", label: "Знания", icon: BookOpen },
];

export const AppShell = () => {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border/60 bg-sidebar/80 backdrop-blur sticky top-0 h-screen">
        <div className="px-6 py-6 border-b border-sidebar-border/60">
          <NavLink to="/app" className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-primary " />
            <span className="font-semibold tracking-wide">Inner Glyph</span>
          </NavLink>
          <p className="text-xs text-muted-foreground mt-2 mono">v0.1 · mirror mode</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors",
                  "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  isActive &&
                    "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_2px_0_0_hsl(var(--primary))]",
                )
              }
            >
              <item.icon className="size-4" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="px-3 py-3 border-t border-sidebar-border/60">
          <NavLink
            to="/app/settings"
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm",
                "text-sidebar-foreground hover:bg-sidebar-accent",
                isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
              )
            }
          >
            <Settings className="size-4" />
            <span>Настройки</span>
          </NavLink>
        </div>
      </aside>

      {/* Mobile top nav */}
      <header className="md:hidden fixed top-0 inset-x-0 z-30 glass border-b border-border/60">
        <div className="flex items-center justify-between px-4 h-14">
          <NavLink to="/app" className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-primary " />
            <span className="font-semibold">Inner Glyph</span>
          </NavLink>
          <span className="text-xs mono text-muted-foreground">{location.pathname}</span>
        </div>
        <div className="flex overflow-x-auto px-2 pb-2 gap-1 scrollbar-none">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs whitespace-nowrap",
                  "text-sidebar-foreground hover:bg-sidebar-accent",
                  isActive && "bg-sidebar-accent text-primary",
                )
              }
            >
              <item.icon className="size-3.5" />
              {item.label}
            </NavLink>
          ))}
        </div>
      </header>

      <main className="flex-1 min-w-0 pt-28 md:pt-0">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-10 animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
