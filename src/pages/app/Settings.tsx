import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

type Tone = "soft" | "hard" | "socratic";

const Settings = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [tone, setTone] = useState<Tone>("soft");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name, ai_tone")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setName(data.display_name ?? "");
          setTone((data.ai_tone as Tone) ?? "soft");
        }
      });
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: name, ai_tone: tone })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Сохранено");
  };

  const logout = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <>
      <PageHeader eyebrow="ты управляешь зеркалом" title="Настройки" description="Прозрачно. Без серых зон." />

      <div className="space-y-4">
        <Card className="ios-card p-5 space-y-4">
          <h3 className="font-semibold">Профиль</h3>
          <div className="space-y-1.5">
            <Label htmlFor="name">Имя</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl" />
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
                  onClick={() => setTone(t.id as Tone)}
                  className={`p-3 rounded-xl border text-sm transition-colors ${
                    tone === t.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <Button onClick={save} disabled={saving} className="rounded-full">
            Сохранить
          </Button>
        </Card>

        <Card className="ios-card p-5 space-y-3">
          <h3 className="font-semibold">Аккаунт</h3>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
          <Button variant="secondary" onClick={logout} className="rounded-full">
            Выйти
          </Button>
        </Card>

        <Card className="ios-card p-5">
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
