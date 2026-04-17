// «Личное дело» — структурированный психологический профиль пользователя.
// Можно перегенерировать AI, редактировать вручную, выгрузить JSON и очистить.
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  RefreshCw, Download, Trash2, Pencil, Plus, X, FileText, Save, History,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DossierVersions } from "./DossierVersions";

interface Item { title: string; detail: string }
interface Dossier {
  summary: string;
  patterns: Item[];
  themes: Item[];
  triggers: Item[];
  resources: Item[];
  values_list: Item[];
  goals: Item[];
  relationships: Item[];
  notes: string;
  version: number;
  last_auto_update_at: string | null;
  updated_at: string | null;
}

const EMPTY: Dossier = {
  summary: "",
  patterns: [], themes: [], triggers: [], resources: [],
  values_list: [], goals: [], relationships: [],
  notes: "",
  version: 0,
  last_auto_update_at: null,
  updated_at: null,
};

const SECTIONS: { key: keyof Dossier; label: string; tone: string; hint: string }[] = [
  { key: "patterns",      label: "Паттерны",      tone: "var(--stat-mind)",          hint: "Что повторяется снова и снова" },
  { key: "themes",        label: "Темы",          tone: "var(--stat-emotions)",      hint: "О чём чаще всего речь" },
  { key: "triggers",      label: "Триггеры",      tone: "var(--destructive)",        hint: "Что выбивает из равновесия" },
  { key: "resources",     label: "Ресурсы",       tone: "var(--stat-finance)",       hint: "Что помогает восстановиться" },
  { key: "values_list",   label: "Ценности",      tone: "var(--stat-meaning)",       hint: "Что по-настоящему важно" },
  { key: "goals",         label: "Цели и намерения", tone: "var(--stat-career)",     hint: "Куда хочется двигаться" },
  { key: "relationships", label: "Близкие люди",  tone: "var(--stat-relationships)", hint: "Ключевые связи и динамики" },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export const DossierPanel = ({ open, onClose }: Props) => {
  const { user } = useAuth();
  const [dossier, setDossier] = useState<Dossier>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [building, setBuilding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    void load();
  }, [open, user]);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("user_dossier")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) {
      setDossier({
        summary: data.summary ?? "",
        patterns: ((data.patterns as unknown) as Item[]) ?? [],
        themes: ((data.themes as unknown) as Item[]) ?? [],
        triggers: ((data.triggers as unknown) as Item[]) ?? [],
        resources: ((data.resources as unknown) as Item[]) ?? [],
        values_list: ((data.values_list as unknown) as Item[]) ?? [],
        goals: ((data.goals as unknown) as Item[]) ?? [],
        relationships: ((data.relationships as unknown) as Item[]) ?? [],
        notes: data.notes ?? "",
        version: data.version ?? 0,
        last_auto_update_at: data.last_auto_update_at,
        updated_at: data.updated_at,
      });
    } else {
      setDossier(EMPTY);
    }
    setLoading(false);
  };

  const rebuild = async () => {
    if (!user) return;
    setBuilding(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/build-dossier`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const body = await resp.json();
      if (!resp.ok) throw new Error(body.error || "AI failed");
      toast.success("Досье обновлено");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось");
    } finally {
      setBuilding(false);
    }
  };

  const saveManual = async () => {
    if (!user) return;
    const payload = {
      user_id: user.id,
      summary: dossier.summary,
      patterns: dossier.patterns as unknown as never,
      themes: dossier.themes as unknown as never,
      triggers: dossier.triggers as unknown as never,
      resources: dossier.resources as unknown as never,
      values_list: dossier.values_list as unknown as never,
      goals: dossier.goals as unknown as never,
      relationships: dossier.relationships as unknown as never,
      notes: dossier.notes,
    };
    const { error } = await supabase.from("user_dossier").upsert(payload, { onConflict: "user_id" });
    if (error) toast.error(error.message);
    else { toast.success("Сохранено"); setEditing(false); await load(); }
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(dossier, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `dossier-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("Файл скачан");
  };

  const clearAll = async () => {
    if (!user) return;
    await supabase.from("user_dossier").delete().eq("user_id", user.id);
    setDossier(EMPTY);
    setConfirmClear(false);
    toast.success("Досье очищено");
  };

  const updateItem = (key: keyof Dossier, idx: number, field: "title" | "detail", val: string) => {
    setDossier((d) => {
      const arr = [...(d[key] as Item[])];
      arr[idx] = { ...arr[idx], [field]: val };
      return { ...d, [key]: arr };
    });
  };
  const addItem = (key: keyof Dossier) => {
    setDossier((d) => ({ ...d, [key]: [...(d[key] as Item[]), { title: "", detail: "" }] }));
  };
  const removeItem = (key: keyof Dossier, idx: number) => {
    setDossier((d) => ({
      ...d,
      [key]: (d[key] as Item[]).filter((_, i) => i !== idx),
    }));
  };

  const isEmpty =
    !dossier.summary &&
    SECTIONS.every((s) => (dossier[s.key] as Item[]).length === 0) &&
    !dossier.notes;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <DialogTitle className="flex items-center gap-2">
                <FileText className="size-5 text-primary" />
                Личное дело
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Структурированный профиль, который AI собирает из чатов, чек-инов, настроения и сна.
                {dossier.version > 0 && (
                  <> · v{dossier.version}{dossier.updated_at ? ` · ${new Date(dossier.updated_at).toLocaleDateString("ru")}` : ""}</>
                )}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={rebuild} disabled={building} className="rounded-full">
            <RefreshCw className={cn("size-3.5 mr-1.5", building && "animate-spin")} />
            {building ? "Собираю…" : isEmpty ? "Собрать AI" : "Перегенерировать"}
          </Button>
          {!editing ? (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)} disabled={isEmpty} className="rounded-full">
              <Pencil className="size-3.5 mr-1.5" />Редактировать
            </Button>
          ) : (
            <Button size="sm" variant="default" onClick={saveManual} className="rounded-full">
              <Save className="size-3.5 mr-1.5" />Сохранить
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={exportJson} disabled={isEmpty} className="rounded-full">
            <Download className="size-3.5 mr-1.5" />Выгрузить
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowHistory(true)} className="rounded-full">
            <History className="size-3.5 mr-1.5" />История
          </Button>
          <Button size="sm" variant="outline" onClick={() => setConfirmClear(true)} disabled={isEmpty} className="rounded-full text-destructive border-destructive/40 hover:bg-destructive/10">
            <Trash2 className="size-3.5 mr-1.5" />Очистить
          </Button>
        </div>

        {showHistory && (
          <DossierVersions
            onBack={() => setShowHistory(false)}
            onAfterRestore={() => { setShowHistory(false); void load(); }}
          />
        )}

        {showHistory ? null : loading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Загружаю…</p>
        ) : isEmpty && !editing ? (
          <div className="py-8 text-center space-y-2">
            <p className="text-sm">Досье ещё пустое.</p>
            <p className="text-xs text-muted-foreground">
              Нажми «Собрать AI», и психолог соберёт твой профиль из истории чатов, чек-инов, активностей и сна за последние 60 дней.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Summary */}
            <div>
              <p className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
                краткое описание
              </p>
              {editing ? (
                <Textarea
                  value={dossier.summary}
                  onChange={(e) => setDossier((d) => ({ ...d, summary: e.target.value }))}
                  rows={4}
                  className="text-sm"
                />
              ) : (
                <p className="text-sm leading-relaxed text-foreground/90">
                  {dossier.summary || <span className="text-muted-foreground italic">Не заполнено</span>}
                </p>
              )}
            </div>

            {SECTIONS.map((s) => {
              const items = dossier[s.key] as Item[];
              return (
                <div key={s.key as string}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-semibold" style={{ color: `hsl(${s.tone})` }}>
                        {s.label}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{s.hint}</p>
                    </div>
                    {editing && (
                      <Button size="sm" variant="ghost" onClick={() => addItem(s.key)} className="h-7">
                        <Plus className="size-3.5 mr-1" />Добавить
                      </Button>
                    )}
                  </div>
                  {items.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Пока пусто</p>
                  ) : (
                    <ul className="space-y-2">
                      {items.map((it, i) => (
                        <li
                          key={i}
                          className="rounded-lg border p-2.5"
                          style={{ borderColor: `hsl(${s.tone} / 0.25)`, background: `hsl(${s.tone} / 0.04)` }}
                        >
                          {editing ? (
                            <div className="flex gap-2 items-start">
                              <div className="flex-1 space-y-1.5">
                                <Input
                                  value={it.title}
                                  onChange={(e) => updateItem(s.key, i, "title", e.target.value)}
                                  placeholder="Заголовок"
                                  className="h-8 text-sm font-medium"
                                />
                                <Textarea
                                  value={it.detail}
                                  onChange={(e) => updateItem(s.key, i, "detail", e.target.value)}
                                  placeholder="Подробности"
                                  rows={2}
                                  className="text-sm"
                                />
                              </div>
                              <Button size="icon" variant="ghost" onClick={() => removeItem(s.key, i)} className="h-7 w-7 shrink-0">
                                <X className="size-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <>
                              <p className="text-sm font-medium">{it.title}</p>
                              {it.detail && (
                                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{it.detail}</p>
                              )}
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}

            {/* Notes */}
            <div>
              <p className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
                заметки терапевта
              </p>
              {editing ? (
                <Textarea
                  value={dossier.notes}
                  onChange={(e) => setDossier((d) => ({ ...d, notes: e.target.value }))}
                  rows={3}
                  className="text-sm"
                />
              ) : (
                <p className="text-sm leading-relaxed text-muted-foreground italic">
                  {dossier.notes || <Badge variant="outline" className="text-[10px]">пусто</Badge>}
                </p>
              )}
            </div>
          </div>
        )}

        <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Очистить досье?</AlertDialogTitle>
              <AlertDialogDescription>
                Все собранные паттерны, темы и заметки будут удалены. Это действие нельзя отменить.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Отмена</AlertDialogCancel>
              <AlertDialogAction onClick={clearAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Очистить
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
};
