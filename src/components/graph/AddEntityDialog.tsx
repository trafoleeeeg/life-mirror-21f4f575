// Простой dialog для добавления своей сущности вручную.
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import type { EntityType } from "@/types/lifeMap";
import { TYPE_LABEL } from "@/types/lifeMap";

export const AddEntityDialog = ({ onAdded }: { onAdded: () => void }) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [type, setType] = useState<EntityType>("person");
  const [category, setCategory] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!user || !label.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("graph_entities").insert({
      user_id: user.id,
      type,
      label: label.trim(),
      mentions: 1,
      category: category.trim() || null,
    });
    setBusy(false);
    if (error) {
      toast.error("Не удалось добавить");
    } else {
      toast.success("Добавлено");
      setLabel("");
      setCategory("");
      setOpen(false);
      onAdded();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="rounded-full">
          <Plus className="size-4 mr-1" /> Добавить
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Своя сущность</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Название</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="например, Аня или Йога"
              className="mt-1.5"
              autoFocus
            />
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
            <Label className="text-xs">Категория</Label>
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="опционально"
              className="mt-1.5"
            />
          </div>
          <Button onClick={submit} disabled={!label.trim() || busy} className="w-full">
            Добавить
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
