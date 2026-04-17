// Редактор сфер баланса: добавить/скрыть/восстановить/настроить ключевые слова.
// Используется в попапе из Mirror.
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, EyeOff, Eye, X } from "lucide-react";
import { useUserSpheres, type Sphere } from "@/lib/useUserSpheres";

const COMMON_EMOJIS = ["💪", "🧠", "💜", "❤️", "💼", "💰", "🎨", "✨", "🏃", "📚", "🎵", "🌿", "✈️", "🍳"];

export const SpheresEditor = () => {
  const { spheres, addSphere, removeSphere, restoreSphere, updateKeywords } = useUserSpheres();
  const [newLabel, setNewLabel] = useState("");
  const [newEmoji, setNewEmoji] = useState("✨");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftKw, setDraftKw] = useState("");

  const handleAdd = () => {
    if (!newLabel.trim()) return;
    addSphere(newLabel, newEmoji);
    setNewLabel("");
    setNewEmoji("✨");
  };

  const startEdit = (s: Sphere) => {
    setEditingId(s.id);
    setDraftKw(s.keywords.join(", "));
  };
  const saveEdit = (s: Sphere) => {
    const next = draftKw.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
    updateKeywords(s.id, next);
    setEditingId(null);
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
          добавить сферу
        </p>
        <div className="flex gap-2">
          <select
            value={newEmoji}
            onChange={(e) => setNewEmoji(e.target.value)}
            className="rounded-full h-9 px-2 text-sm bg-background border border-border"
            aria-label="Эмоджи"
          >
            {COMMON_EMOJIS.map((e) => <option key={e}>{e}</option>)}
          </select>
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Например, Путешествия"
            className="flex-1 rounded-full h-9 text-sm"
          />
          <Button onClick={handleAdd} size="icon" className="rounded-full size-9">
            <Plus className="size-4" />
          </Button>
        </div>
      </div>

      <div>
        <p className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
          твои сферы
        </p>
        <ul className="space-y-1.5">
          {spheres.map((s) => (
            <li key={s.id}>
              <Card className={`p-3 ${s.hidden ? "opacity-50" : ""}`}>
                <div className="flex items-center gap-2">
                  <span
                    className="size-7 rounded-full grid place-items-center text-sm shrink-0"
                    style={{ background: `hsl(var(${s.tokenVar}) / 0.2)` }}
                  >
                    {s.emoji}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{s.label}</p>
                    {editingId !== s.id && (
                      <p className="text-[11px] text-muted-foreground truncate">
                        {s.keywords.length ? s.keywords.join(", ") : "нет ключевых слов"}
                      </p>
                    )}
                  </div>
                  {editingId === s.id ? (
                    <Button size="sm" variant="ghost" onClick={() => saveEdit(s)} className="rounded-full text-xs">
                      Сохранить
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => startEdit(s)} className="rounded-full text-xs">
                      Изменить
                    </Button>
                  )}
                  {s.hidden ? (
                    <Button size="icon" variant="ghost" onClick={() => restoreSphere(s.id)}
                      className="rounded-full size-8" aria-label="Показать">
                      <Eye className="size-3.5" />
                    </Button>
                  ) : (
                    <Button size="icon" variant="ghost" onClick={() => removeSphere(s.id)}
                      className="rounded-full size-8"
                      aria-label={s.builtin ? "Скрыть" : "Удалить"}>
                      {s.builtin ? <EyeOff className="size-3.5" /> : <X className="size-3.5" />}
                    </Button>
                  )}
                </div>
                {editingId === s.id && (
                  <div className="mt-2">
                    <Input
                      value={draftKw}
                      onChange={(e) => setDraftKw(e.target.value)}
                      placeholder="спорт, бег, йога"
                      className="rounded-full h-8 text-xs"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Через запятую. Активность с этими словами автоматически попадёт в эту сферу.
                    </p>
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
