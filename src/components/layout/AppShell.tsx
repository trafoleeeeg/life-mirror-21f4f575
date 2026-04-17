import { NavLink, Outlet } from "react-router-dom";
import {
  MessageCircle,
  Moon,
  Network,
  User,
  LineChart,
  Rss,
  Mail,
  BookOpen,
  Settings,
  Bell,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsAdmin } from "@/lib/useIsAdmin";

/** Primary tabs shown on mobile bottom bar (4 max). */
const primary = [
  { to: "/app", label: "Зеркало", icon: LineChart, end: true },
  { to: "/app/feed", label: "Лента", icon: Rss },
  { to: "/app/chat", label: "Психолог", icon: MessageCircle },
  { to: "/app/me", label: "Профиль", icon: User },
];

/** Full nav shown in desktop sidebar. */
const sidebarNav = [
  { to: "/app", label: "Зеркало", icon: LineChart, end: true },
  { to: "/app/feed", label: "Лента", icon: Rss },
  { to: "/app/chat", label: "Психолог", icon: MessageCircle },
  { to: "/app/me", label: "Профиль", icon: User },
  { to: "/app/graph", label: "Граф", icon: Network },
  { to: "/app/sleep", label: "Сон", icon: Moon },
  { to: "/app/dms", label: "Сообщения", icon: Mail },
  { to: "/app/learn", label: "Знания", icon: BookOpen },
  { to: "/app/notifications", label: "Уведомления", icon: Bell },
];

export const AppShell = () => {
  const { isAdmin } = useIsAdmin();
  const nav = isAdmin
    ? [...sidebarNav, { to: "/app/admin", label: "Админ", icon: ShieldCheck }]
    : sidebarNav;
  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border/60 bg-sidebar sticky top-0 h-screen">
        <div className="px-6 py-6 border-b border-sidebar-border/60">
          <NavLink to="/app" className="flex items-center gap-2.5">
            <div className="size-7 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground text-xs font-bold">IG</span>
            </div>
            <span className="font-semibold tracking-tight">Inner Glyph</span>
          </NavLink>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors",
                  "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  isActive && "bg-sidebar-accent text-primary font-medium",
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
                "flex items-center gap-3 px-3 py-2 rounded-xl text-sm",
                "text-sidebar-foreground hover:bg-sidebar-accent",
                isActive && "bg-sidebar-accent text-primary",
              )
            }
          >
            <Settings className="size-4" />
            <span>Настройки</span>
          </NavLink>
        </div>
      </aside>

      {/* Mobile top bar (iOS-style large title is rendered per-page) */}
      <header className="md:hidden fixed top-0 inset-x-0 z-30 glass pt-safe">
        <div className="flex items-center justify-between px-4 h-12">
          <NavLink to="/app" className="flex items-center gap-2">
            <div className="size-6 rounded-md bg-primary flex items-center justify-center">
              <span className="text-primary-foreground text-[10px] font-bold">IG</span>
            </div>
            <span className="font-semibold text-sm">Inner Glyph</span>
          </NavLink>
          <NavLink
            to="/app/feed"
            className="text-xs text-primary"
            aria-label="Лента"
          >
            Лента
          </NavLink>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 min-w-0 pt-14 pb-24 md:pt-0 md:pb-0">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-4 md:py-10 animate-fade-in">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom tab bar (iOS) */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-30 glass pb-safe"
        aria-label="Главная навигация"
      >
        <div className="grid grid-cols-4 px-1 pt-1.5">
          {primary.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg",
                  "text-muted-foreground transition-colors active:bg-muted/40",
                  isActive && "text-primary",
                )
              }
            >
              <item.icon className="size-[22px]" strokeWidth={2} />
              <span className="text-[10px] font-medium leading-none">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
};
