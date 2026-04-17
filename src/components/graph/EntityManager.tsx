// Drawer для управления одной сущностью: rename, type, category, pin, hide, merge, delete.
import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Pin, Eye, EyeOff, Trash2, Combine } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DbEntity, EntityType } from "@/types/lifeMap";
import { TYPE_LABEL, TYPE_TOKEN, displayLabel } from "@/types/lifeMap";

interface Props {
  entity: DbEntity | null;
  allEntities: DbEntity[];
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}

export const EntityManager = ({ entity, allEntities, open, onClose, onChanged }: Props) => {
  const [label, setLabel] = useState("");
  const [type, setType] = useState<EntityType>("topic");
  const [category, setCategory] = useState("");
  const [pinned, setPinned] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [mergeWith, setMergeWith] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!entity) return;
    setLabel(displayLabel(entity));
    setType(entity.type);
    setCategory(entity.category ?? "");
    setPinned(!!entity.pinned);
    setHidden(!!entity.hidden);
    setMergeWith("");
  }, [entity]);

  if (!entity) return null;

  const save = async () => {
    setBusy(true);
    const trimmed = label.trim();
    const isCustom = trimmed && trimmed !== entity.label;
    const { error } = await supabase
      .from("graph_entities")
      .update({
        type,
        category: category.trim() || null,
        pinned,
        hidden,
        custom_label: isCustom ? trimmed : null,
      })
      .eq("id", entity.id);
    setBusy(false);
    if (error) {
      toast.error("Не удалось сохранить");
    } else {
      toast.success("Сохранено");
      onChanged();
      onClose();
    }
  };

  const removeEnt = async () => {
    if (!confirm(`Удалить «${displayLabel(entity)}»? Связи тоже исчезнут.`)) return;
    setBusy(true);
    // delete edges first (no FK cascade)
    await supabase.from("graph_edges").delete().or(`a_id.eq.${entity.id},b_id.eq.${entity.id}`);
    const { error } = await supabase.from("graph_entities").delete().eq("id", entity.id);
    setBusy(false);
    if (error) {
      toast.error("Не удалось удалить");
    } else {
      toast.success("Удалено");
      onChanged();
      onClose();
    }
  };

  const doMerge = async () => {
    if (!mergeWith) return;
    const target = allEntities.find((e) => e.id === mergeWith);
    if (!target) return;
    if (!confirm(`Объединить «${displayLabel(entity)}» в «${displayLabel(target)}»?`)) return;
    setBusy(true);
    const { error } = await supabase.rpc("merge_graph_entities", {
      _keep: target.id,
      _drop: entity.id,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Объединено");
      onChanged();
      onClose();
    }
  };

  const mergeCandidates = allEntities.filter((e) => e.id !== entity.id);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span
              className="size-3 rounded-full"
              style={{ background: `hsl(${TYPE_TOKEN[entity.type]})` }}
            />
            Сущность
          </SheetTitle>
        </SheetHeader>

        <div className="mt-5 space-y-5">
          <div>
            <Label htmlFor="ent-label" className="text-xs">Название</Label>
            <Input
              id="ent-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="mt-1.5"
            />
            {entity.custom_label && (
              <p className="text-[11px] text-muted-foreground mt-1">
                Оригинал: {entity.label}
              </p>
            )}
          </div>

          <div>
            <Label className="text-xs">Тип</Label>
            <Select value={type} onValueChange={(v) => setType(v as EntityType)}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(TYPE_LABEL) as EntityType[]).map((t) => (
                  <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="ent-cat" className="text-xs">Категория (опционально)</Label>
            <Input
              id="ent-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="например: работа, здоровье"
              className="mt-1.5"
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div className="flex items-center gap-2">
              <Pin className="size-4 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">Закрепить</div>
                <div className="text-[11px] text-muted-foreground">Всегда наверху рейтинга</div>
              </div>
            </div>
            <Switch checked={pinned} onCheckedChange={setPinned} />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div className="flex items-center gap-2">
              {hidden ? <EyeOff className="size-4 text-muted-foreground" /> : <Eye className="size-4 text-muted-foreground" />}
              <div>
                <div className="text-sm font-medium">Скрыть</div>
                <div className="text-[11px] text-muted-foreground">Не показывать в карте</div>
              </div>
            </div>
            <Switch checked={hidden} onCheckedChange={setHidden} />
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <Badge variant="outline">{entity.mentions} упоминаний</Badge>
            <span>с {new Date(entity.last_seen_at).toLocaleDateString("ru")}</span>
          </div>

          <div className="space-y-2 pt-2 border-t">
            <Label className="text-xs flex items-center gap-1.5">
              <Combine className="size-3.5" /> Объединить с другой сущностью
            </Label>
            <div className="flex gap-2">
              <Select value={mergeWith} onValueChange={setMergeWith}>
                <SelectTrigger><SelectValue placeholder="Выбрать…" /></SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {mergeCandidates.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      <span className="text-muted-foreground text-xs mr-1.5">{TYPE_LABEL[e.type]}:</span>
                      {displayLabel(e)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={doMerge}
                disabled={!mergeWith || busy}
                size="sm"
                variant="secondary"
              >
                Объединить
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Все связи и упоминания перейдут на выбранную сущность.
            </p>
          </div>

          <div className="flex gap-2 pt-3 border-t">
            <Button onClick={save} disabled={busy} className="flex-1">Сохранить</Button>
            <Button onClick={removeEnt} disabled={busy} variant="destructive" size="icon">
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
