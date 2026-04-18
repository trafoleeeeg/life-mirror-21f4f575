import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
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
  Menu,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsAdmin } from "@/lib/useIsAdmin";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { SwipeNavigator } from "./SwipeNavigator";

/** Primary tabs shown on mobile bottom bar (4 max). */
const primary = [
  { to: "/app", label: "Зеркало", icon: LineChart, end: true },
  { to: "/app/feed", label: "Лента", icon: Rss },
  { to: "/app/chat", label: "Психолог", icon: MessageCircle },
  { to: "/app/me", label: "Профиль", icon: User },
];

/** Full nav shown in desktop sidebar and mobile drawer. */
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
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profile, setProfile] = useState<{ display_name: string | null; username: string | null; avatar_url: string | null } | null>(null);

  const nav = isAdmin
    ? [...sidebarNav, { to: "/app/admin", label: "Админ", icon: ShieldCheck }]
    : sidebarNav;

  // Закрывать drawer при смене маршрута
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // Подтянуть мини-профиль для шапки drawer'а
  useEffect(() => {
    if (!user) { setProfile(null); return; }
    void supabase
      .from("profiles")
      .select("display_name, username, avatar_url")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data ?? null));
  }, [user]);

  const initials = (profile?.display_name || profile?.username || user?.email || "?")
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border/60 bg-sidebar sticky top-0 h-screen">
        <div className="px-6 py-6 border-b border-sidebar-border/60">
          <NavLink to="/app" className="flex items-center gap-2.5">
            <div className="size-7 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground text-xs font-bold">M</span>
            </div>
            <span className="font-semibold tracking-tight">Mirr</span>
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

      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 inset-x-0 z-30 glass pt-safe no-select">
        <div className="flex items-center justify-between px-2 h-12">
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-10 rounded-full"
                aria-label="Меню"
              >
                <Avatar className="size-7">
                  <AvatarImage src={profile?.avatar_url ?? undefined} alt="" />
                  <AvatarFallback className="text-[11px]">{initials}</AvatarFallback>
                </Avatar>
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-[78%] max-w-[320px] p-0 flex flex-col bg-sidebar border-sidebar-border pt-safe pb-safe"
            >
              {/* Шапка drawer'а с профилем */}
              <div className="px-5 pt-6 pb-4 border-b border-sidebar-border/60">
                <NavLink to="/app/me" className="flex items-center gap-3">
                  <Avatar className="size-12">
                    <AvatarImage src={profile?.avatar_url ?? undefined} alt="" />
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="font-semibold truncate">
                      {profile?.display_name || "Без имени"}
                    </div>
                    {profile?.username && (
                      <div className="text-sm text-muted-foreground truncate">
                        @{profile.username}
                      </div>
                    )}
                  </div>
                </NavLink>
              </div>

              {/* Полная навигация */}
              <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
                {nav.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 px-3 py-3 rounded-xl text-[15px] transition-colors",
                        "text-sidebar-foreground hover:bg-sidebar-accent",
                        isActive && "bg-sidebar-accent text-primary font-medium",
                      )
                    }
                  >
                    <item.icon className="size-5" />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </nav>

              {/* Низ: настройки + выход */}
              <div className="px-3 py-3 border-t border-sidebar-border/60 space-y-0.5">
                <NavLink
                  to="/app/settings"
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 px-3 py-3 rounded-xl text-[15px]",
                      "text-sidebar-foreground hover:bg-sidebar-accent",
                      isActive && "bg-sidebar-accent text-primary",
                    )
                  }
                >
                  <Settings className="size-5" />
                  <span>Настройки</span>
                </NavLink>
                <button
                  type="button"
                  onClick={() => { void signOut(); }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-[15px] text-sidebar-foreground hover:bg-sidebar-accent text-left"
                >
                  <LogOut className="size-5" />
                  <span>Выйти</span>
                </button>
              </div>
            </SheetContent>
          </Sheet>

          <NavLink to="/app" className="flex items-center gap-2 absolute left-1/2 -translate-x-1/2">
            <div className="size-6 rounded-md bg-primary flex items-center justify-center">
              <span className="text-primary-foreground text-[10px] font-bold">M</span>
            </div>
            <span className="font-semibold text-sm">Mirr</span>
          </NavLink>

          <NavLink
            to="/app/notifications"
            className="size-10 rounded-full grid place-items-center text-foreground/80 hover:text-primary"
            aria-label="Уведомления"
          >
            <Bell className="size-5" />
          </NavLink>
        </div>
      </header>

      {/* Main */}
      <SwipeNavigator
        tabs={primary}
        currentPath={location.pathname}
        onOpenDrawer={() => setDrawerOpen(true)}
      >
        <main className="flex-1 min-w-0 pt-[calc(env(safe-area-inset-top)+3.5rem)] pb-[calc(env(safe-area-inset-bottom)+5.5rem)] md:pt-0 md:pb-0 overflow-x-hidden">
          <div className="max-w-6xl mx-auto px-4 md:px-8 py-4 md:py-10 animate-fade-in">
            <Outlet />
          </div>
        </main>
      </SwipeNavigator>

      {/* Mobile bottom tab bar (iOS) */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-30 glass pb-safe no-select"
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
