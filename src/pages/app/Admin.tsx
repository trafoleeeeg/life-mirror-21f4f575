// Админ-панель: список пользователей с метриками + детальный drawer.
// Доступна только пользователям с ролью admin.
import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/lib/useIsAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ShieldAlert, ShieldCheck, Search, Activity } from "lucide-react";
import { toast } from "sonner";
import { parseUA, pushProvider } from "@/lib/userAgent";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  CartesianGrid,
} from "recharts";

interface AdminUser {
  user_id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  language: string;
  ai_tone: string;
  created_at: string;
  last_sign_in_at: string | null;
  deleted_at: string | null;
  is_admin: boolean;
  checkins_count: number;
  pings_count: number;
  sleep_count: number;
  avg_mood: number | null;
  achievements_count: number;
  last_activity: string | null;
}

const fmt = (d: string | null) =>
  d && new Date(d).getTime() > 0
    ? new Date(d).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })
    : "—";

const Admin = () => {
  const { isAdmin, loading } = useIsAdmin();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<AdminUser | null>(null);

  const load = async () => {
    const { data, error } = await supabase.rpc("admin_list_users");
    if (error) {
      toast.error("Ошибка загрузки: " + error.message);
      return;
    }
    setUsers((data ?? []) as AdminUser[]);
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return users;
    return users.filter(
      (u) =>
        u.email?.toLowerCase().includes(s) ||
        u.display_name?.toLowerCase().includes(s) ||
        u.user_id.includes(s),
    );
  }, [users, q]);

  if (loading) return <div className="p-8 text-muted-foreground">Загрузка…</div>;
  if (!isAdmin) return <Navigate to="/app" replace />;

  const setDeleted = async (u: AdminUser, deleted: boolean) => {
    const { error } = await supabase.rpc("admin_set_deleted", {
      _user: u.user_id,
      _deleted: deleted,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(deleted ? "Пользователь заблокирован" : "Пользователь восстановлен");
    await load();
    setSelected(null);
  };

  return (
    <div className="space-y-5 pb-8">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-muted-foreground text-sm flex items-center gap-1.5">
            <ShieldCheck className="size-3.5" /> Админ-панель
          </p>
          <h1 className="text-3xl font-bold tracking-tight">Пользователи</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Всего: {users.length}. Чувствительный контент (чаты, заметки) скрыт.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Поиск по email, имени, id…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
      </header>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Пользователь</TableHead>
                <TableHead>Регистрация</TableHead>
                <TableHead>Последний вход</TableHead>
                <TableHead>Активность</TableHead>
                <TableHead className="text-right">Чек / Пинг / Сон</TableHead>
                <TableHead className="text-right">Mood</TableHead>
                <TableHead>Статус</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => (
                <TableRow
                  key={u.user_id}
                  onClick={() => setSelected(u)}
                  className="cursor-pointer"
                >
                  <TableCell>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar className="size-8">
                        <AvatarImage src={u.avatar_url ?? undefined} />
                        <AvatarFallback>
                          {(u.display_name ?? u.email ?? "?").slice(0, 1).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="font-medium truncate flex items-center gap-1.5">
                          {u.display_name ?? "—"}
                          {u.is_admin && (
                            <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                              admin
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {u.email}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {fmt(u.created_at)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {fmt(u.last_sign_in_at)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {fmt(u.last_activity)}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {u.checkins_count} / {u.pings_count} / {u.sleep_count}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {u.avg_mood ?? "—"}
                  </TableCell>
                  <TableCell>
                    {u.deleted_at ? (
                      <Badge variant="destructive">Заблокирован</Badge>
                    ) : (
                      <Badge variant="outline" className="text-emerald-500 border-emerald-500/40">
                        Активен
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Нет результатов
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <UserDetail
        user={selected}
        onClose={() => setSelected(null)}
        onToggleDelete={setDeleted}
      />
    </div>
  );
};

interface DayActivity {
  day: string;
  pings: number;
  checkins: number;
  sleep_sessions: number;
}

interface PushSub {
  id: string;
  endpoint: string;
  user_agent: string | null;
  created_at: string;
  last_used_at: string;
}

interface AuthEv {
  id: string;
  event_type: string;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
}

interface PushEv {
  id: string;
  event_type: string;
  status_code: number | null;
  error: string | null;
  created_at: string;
}

const UserDetail = ({
  user,
  onClose,
  onToggleDelete,
}: {
  user: AdminUser | null;
  onClose: () => void;
  onToggleDelete: (u: AdminUser, deleted: boolean) => void;
}) => {
  const [activity, setActivity] = useState<DayActivity[]>([]);
  const [subs, setSubs] = useState<PushSub[]>([]);
  const [authEvents, setAuthEvents] = useState<AuthEv[]>([]);
  const [pushEvents, setPushEvents] = useState<PushEv[]>([]);

  useEffect(() => {
    if (!user) return;
    let cancel = false;
    Promise.all([
      supabase.rpc("admin_user_activity", { _user: user.user_id, _days: 30 }),
      supabase
        .from("push_subscriptions")
        .select("id,endpoint,user_agent,created_at,last_used_at")
        .eq("user_id", user.user_id)
        .order("last_used_at", { ascending: false }),
      supabase
        .from("auth_events")
        .select("id,event_type,ip,user_agent,created_at")
        .eq("user_id", user.user_id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("push_events")
        .select("id,event_type,status_code,error,created_at")
        .eq("user_id", user.user_id)
        .order("created_at", { ascending: false })
        .limit(30),
    ]).then(([a, s, ae, pe]) => {
      if (cancel) return;
      setActivity((a.data ?? []) as DayActivity[]);
      setSubs((s.data ?? []) as PushSub[]);
      setAuthEvents((ae.data ?? []) as AuthEv[]);
      setPushEvents((pe.data ?? []) as PushEv[]);
    });
    return () => {
      cancel = true;
    };
  }, [user]);

  if (!user) return null;

  return (
    <Sheet open={!!user} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            <Avatar className="size-10">
              <AvatarImage src={user.avatar_url ?? undefined} />
              <AvatarFallback>
                {(user.display_name ?? user.email ?? "?").slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="text-left">
              <div className="font-semibold">{user.display_name ?? "—"}</div>
              <div className="text-xs text-muted-foreground font-normal">{user.email}</div>
            </div>
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-5 mt-5">
          {/* Профиль */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Профиль</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm">
              <Field label="ID" value={user.user_id} mono />
              <Field label="Язык" value={user.language} />
              <Field label="AI tone" value={user.ai_tone} />
              <Field
                label="Роль"
                value={user.is_admin ? "admin" : "user"}
              />
              <Field label="Регистрация" value={fmt(user.created_at)} />
              <Field label="Последний вход" value={fmt(user.last_sign_in_at)} />
              <Field label="Последняя активность" value={fmt(user.last_activity)} />
              <Field
                label="Статус"
                value={user.deleted_at ? `заблокирован ${fmt(user.deleted_at)}` : "активен"}
              />
            </CardContent>
          </Card>

          {/* Метрики */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Метрики</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <Stat label="Чек-ины" value={user.checkins_count} />
              <Stat label="Пинги" value={user.pings_count} />
              <Stat label="Ночи сна" value={user.sleep_count} />
              <Stat label="Ср. mood" value={user.avg_mood ?? "—"} />
              <Stat label="Ачивки" value={user.achievements_count} />
            </CardContent>
          </Card>

          {/* График активности */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Activity className="size-4" /> Активность за 30 дней
              </CardTitle>
            </CardHeader>
            <CardContent className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activity}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis
                    dataKey="day"
                    fontSize={10}
                    tickFormatter={(d) => new Date(d).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })}
                  />
                  <YAxis fontSize={10} />
                  <RTooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      fontSize: 12,
                    }}
                    labelFormatter={(d) => new Date(d).toLocaleDateString("ru-RU")}
                  />
                  <Bar dataKey="pings" stackId="a" fill="hsl(var(--primary))" />
                  <Bar dataKey="checkins" stackId="a" fill="hsl(var(--accent))" />
                  <Bar dataKey="sleep_sessions" stackId="a" fill="hsl(var(--muted-foreground))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Устройства / push-подписки */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Устройства (push)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {subs.length === 0 && (
                <p className="text-sm text-muted-foreground">Нет подписок</p>
              )}
              {subs.map((s) => {
                const ua = parseUA(s.user_agent);
                return (
                  <div key={s.id} className="text-xs border rounded-lg p-2.5">
                    <div className="font-medium text-sm">
                      {ua.device} · {ua.os} · {ua.browser}
                    </div>
                    <div className="text-muted-foreground mt-0.5">
                      {pushProvider(s.endpoint)} · последнее использование {fmt(s.last_used_at)}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* IP / входы */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Входы (IP, устройство)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {authEvents.length === 0 && (
                <p className="text-sm text-muted-foreground">Нет данных. События пишутся при следующем входе.</p>
              )}
              {authEvents.map((e) => {
                const ua = parseUA(e.user_agent);
                return (
                  <div key={e.id} className="text-xs flex items-start justify-between gap-3 border-b last:border-0 pb-1.5">
                    <div>
                      <div className="font-medium text-sm">
                        {e.ip ?? "—"} <span className="text-muted-foreground font-normal">· {e.event_type}</span>
                      </div>
                      <div className="text-muted-foreground">
                        {ua.device} · {ua.os} · {ua.browser}
                      </div>
                    </div>
                    <div className="text-muted-foreground whitespace-nowrap">{fmt(e.created_at)}</div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Push-события */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Push-события</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {pushEvents.length === 0 && (
                <p className="text-sm text-muted-foreground">Нет событий</p>
              )}
              {pushEvents.map((e) => (
                <div key={e.id} className="text-xs flex items-start justify-between gap-3 border-b last:border-0 pb-1.5">
                  <div>
                    <Badge
                      variant={e.event_type === "sent" ? "outline" : "destructive"}
                      className="text-[10px] py-0 px-1.5"
                    >
                      {e.event_type}
                    </Badge>
                    {e.status_code && <span className="ml-2 text-muted-foreground">HTTP {e.status_code}</span>}
                    {e.error && <span className="ml-2 text-destructive">{e.error}</span>}
                  </div>
                  <div className="text-muted-foreground whitespace-nowrap">{fmt(e.created_at)}</div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Действия */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <ShieldAlert className="size-4" /> Действия
              </CardTitle>
            </CardHeader>
            <CardContent>
              {user.deleted_at ? (
                <Button variant="outline" onClick={() => onToggleDelete(user, false)}>
                  Восстановить пользователя
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (confirm(`Заблокировать ${user.email}? Можно восстановить позже.`)) {
                      onToggleDelete(user, true);
                    }
                  }}
                >
                  Заблокировать (soft-delete)
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
};

const Field = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div className="min-w-0">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className={`truncate ${mono ? "font-mono text-xs" : ""}`}>{value}</div>
  </div>
);

const Stat = ({ label, value }: { label: string; value: number | string }) => (
  <div>
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className="text-lg font-semibold tabular-nums">{value}</div>
  </div>
);

export default Admin;
