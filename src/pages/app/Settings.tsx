import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loadProfile, saveProfile } from "@/lib/profile";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const Settings = () => {
  const [profile, setProfile] = useState(loadProfile());
  const navigate = useNavigate();

  const update = <K extends keyof typeof profile>(k: K, v: (typeof profile)[K]) => {
    const next = { ...profile, [k]: v };
    setProfile(next);
    saveProfile(next);
  };

  const exportData = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            profile,
            checkins: JSON.parse(localStorage.getItem("ig:checkins") || "[]"),
            chat: JSON.parse(localStorage.getItem("ig:chat") || "[]"),
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inner-glyph-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Данные экспортированы");
  };

  const wipe = () => {
    if (!confirm("Удалить все локальные данные? Это необратимо.")) return;
    localStorage.clear();
    toast.success("Удалено");
    navigate("/");
  };

  return (
    <>
      <PageHeader
        eyebrow="ты управляешь зеркалом"
        title="Настройки"
        description="Прозрачно. Без серых зон."
      />

      <div className="space-y-4">
        <Card className="glass p-5 space-y-4">
          <h3 className="font-semibold">Профиль</h3>
          <div className="space-y-2">
            <Label htmlFor="name">Имя</Label>
            <Input id="name" value={profile.name} onChange={(e) => update("name", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Тон AI-психолога</Label>
            <div className="grid sm:grid-cols-3 gap-2">
              {[
                { id: "soft", label: "Мягкий" },
                { id: "socratic", label: "Сократ" },
                { id: "hard", label: "Жёсткий" },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => update("tone", t.id as typeof profile.tone)}
                  className={`p-3 rounded-md border text-sm transition-colors ${
                    profile.tone === t.id
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </Card>

        <Card className="glass p-5 space-y-3">
          <h3 className="font-semibold">Данные</h3>
          <p className="text-sm text-muted-foreground">
            Сейчас все данные хранятся локально на твоём устройстве. Когда подключим Lovable Cloud —
            появится синхронизация и шифрованное хранилище.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportData}>
              Экспорт JSON
            </Button>
            <Button variant="destructive" onClick={wipe}>
              Стереть всё
            </Button>
          </div>
        </Card>

        <Card className="glass p-5">
          <h3 className="font-semibold mb-2">Этика</h3>
          <ul className="text-sm text-muted-foreground space-y-1.5">
            <li>• Все автоматические выводы AI помечены как «гипотеза» и могут быть отклонены.</li>
            <li>• Глиф никогда не «умирает» и не давит на тебя — только мягкое отражение.</li>
            <li>• Никаких метрик стрика ради стрика. Никаких публичных штрафов.</li>
          </ul>
        </Card>
      </div>
    </>
  );
};

export default Settings;
