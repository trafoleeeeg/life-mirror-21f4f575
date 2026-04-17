// История версий личного дела: список снапшотов, откат и сравнение «бок о бок».
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { History, RotateCcw, GitCompare, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

interface Item { title: string; detail: string }
interface VersionRow {
  id: string;
  version: number;
  summary: string | null;
  patterns: Item[];
  themes: Item[];
  triggers: Item[];
  resources: Item[];
  values_list: Item[];
  goals: Item[];
  relationships: Item[];
  notes: string | null;
  source: string;
  created_at: string;
}

const SECTIONS: { key: keyof Omit<VersionRow, "id" | "version" | "created_at" | "source" | "summary" | "notes">; label: string }[] = [
  { key: "patterns", label: "Паттерны" },
  { key: "themes", label: "Темы" },
  { key: "triggers", label: "Триггеры" },
  { key: "resources", label: "Ресурсы" },
  { key: "values_list", label: "Ценности" },
  { key: "goals", label: "Цели" },
  { key: "relationships", label: "Близкие" },
];

const fmt = (iso: string) => new Date(iso).toLocaleString("ru", {
  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
});

export const DossierVersions = ({ onBack, onAfterRestore }: { onBack: () => void; onAfterRestore: () => void }) => {
  const { user } = useAuth();
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickedA, setPickedA] = useState<string | null>(null);
  const [pickedB, setPickedB] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState<VersionRow | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("user_dossier_versions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setVersions(((data as unknown) as VersionRow[]) || []);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [user?.id]);

  const restore = async (v: VersionRow) => {
    const { error } = await supabase.rpc("restore_dossier_version", { _version_id: v.id });
    if (error) { toast.error(error.message); return; }
    toast.success(`Откатились к версии от ${fmt(v.created_at)}`);
    setConfirmRestore(null);
    onAfterRestore();
    await load();
  };

  const a = useMemo(() => versions.find((v) => v.id === pickedA) || null, [versions, pickedA]);
  const b = useMemo(() => versions.find((v) => v.id === pickedB) || null, [versions, pickedB]);

  const togglePick = (id: string) => {
    if (pickedA === id) { setPickedA(null); return; }
    if (pickedB === id) { setPickedB(null); return; }
    if (!pickedA) { setPickedA(id); return; }
    if (!pickedB) { setPickedB(id); return; }
    // Уже две — заменяем B
    setPickedB(id);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="rounded-full">
          <ArrowLeft className="size-4 mr-1" />К досье
        </Button>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={compareMode ? "default" : "outline"}
            onClick={() => { setCompareMode((v) => !v); setPickedA(null); setPickedB(null); }}
            className="rounded-full"
            disabled={versions.length < 2}
          >
            <GitCompare className="size-3.5 mr-1.5" />
            {compareMode ? "Выйти из сравнения" : "Сравнить"}
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Загружаю…</p>
      ) : versions.length === 0 ? (
        <Card className="ios-card p-6 text-center text-sm text-muted-foreground">
          <History className="size-6 mx-auto mb-2 opacity-50" />
          История пока пуста. Каждое следующее обновление досье будет сохраняться сюда.
        </Card>
      ) : compareMode && a && b ? (
        <CompareView a={a} b={b} onClose={() => { setPickedA(null); setPickedB(null); }} />
      ) : (
        <>
          {compareMode && (
            <p className="text-xs text-muted-foreground">
              Выбери две версии для сравнения. Выбрано: {[pickedA, pickedB].filter(Boolean).length}/2
            </p>
          )}
          <ul className="space-y-2">
            {versions.map((v) => {
              const totalItems = SECTIONS.reduce((s, sec) => s + ((v[sec.key] as Item[])?.length || 0), 0);
              const picked = pickedA === v.id || pickedB === v.id;
              return (
                <li key={v.id}>
                  <Card
                    className={`ios-card p-3 ${compareMode ? "cursor-pointer" : ""} ${picked ? "ring-2 ring-primary" : ""}`}
                    onClick={() => compareMode && togglePick(v.id)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">v{v.version}</span>
                          <Badge variant="outline" className="text-[10px]">{v.source}</Badge>
                          <span className="mono text-[10px] text-muted-foreground">{fmt(v.created_at)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {totalItems} {totalItems === 1 ? "запись" : "записей"} · summary: {v.summary?.length || 0} симв.
                        </p>
                      </div>
                      {!compareMode && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setConfirmRestore(v)}
                          className="rounded-full shrink-0"
                        >
                          <RotateCcw className="size-3.5 mr-1.5" />Откатить
                        </Button>
                      )}
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <AlertDialog open={!!confirmRestore} onOpenChange={(v) => !v && setConfirmRestore(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Откатить досье к этой версии?</AlertDialogTitle>
            <AlertDialogDescription>
              Текущее состояние будет автоматически сохранено в историю как новая версия — ничего не потеряется.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmRestore && restore(confirmRestore)}>
              Откатить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const CompareView = ({ a, b, onClose }: { a: VersionRow; b: VersionRow; onClose: () => void }) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Сравнение бок о бок</p>
        <Button size="sm" variant="ghost" onClick={onClose}>Сбросить выбор</Button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[a, b].map((v, i) => (
          <Card key={v.id} className="ios-card p-3 space-y-3 text-xs">
            <div className="border-b border-border/40 pb-2">
              <p className="font-semibold text-sm">v{v.version} {i === 0 ? "← старее" : "← новее"}</p>
              <p className="mono text-[10px] text-muted-foreground">{fmt(v.created_at)}</p>
            </div>
            {v.summary && (
              <div>
                <p className="mono text-[9px] uppercase text-muted-foreground mb-0.5">summary</p>
                <p className="leading-relaxed">{v.summary}</p>
              </div>
            )}
            {SECTIONS.map((sec) => {
              const items = (v[sec.key] as Item[]) || [];
              if (items.length === 0) return null;
              return (
                <div key={sec.key}>
                  <p className="mono text-[9px] uppercase text-muted-foreground mb-1">{sec.label} ({items.length})</p>
                  <ul className="space-y-1">
                    {items.map((it, idx) => (
                      <li key={idx} className="rounded border border-border/40 p-1.5">
                        <p className="font-medium">{it.title}</p>
                        {it.detail && <p className="text-muted-foreground leading-snug">{it.detail}</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </Card>
        ))}
      </div>
    </div>
  );
};
