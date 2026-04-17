// SleepTracker: end-to-end UI for starting a sleep session, tracking ambient sound,
// and playing a smart alarm in the chosen wake window.
import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Moon, Sun, Mic, MicOff, AlertCircle, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useSleepRecorder } from "./useSleepRecorder";
import { SmartAlarm } from "./SmartAlarm";

const formatHHMM = (d: Date) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

const parseHHMM = (s: string, base: Date) => {
  const [h, m] = s.split(":").map((x) => parseInt(x, 10));
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  if (d <= base) d.setDate(d.getDate() + 1);
  return d;
};

interface Props {
  onSaved?: () => void;
}

export const SleepTracker = ({ onSaved }: Props) => {
  const { user } = useAuth();
  const recorder = useSleepRecorder();
  const alarmRef = useRef<SmartAlarm>(new SmartAlarm());
  const wakeLockRef = useRef<{ release?: () => void } | null>(null);

  const [smartWake, setSmartWake] = useState(true);
  const [wakeStart, setWakeStart] = useState("06:30");
  const [wakeEnd, setWakeEnd] = useState("07:00");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [now, setNow] = useState(new Date());
  const [alarmRinging, setAlarmRinging] = useState(false);
  const [pulseKey, setPulseKey] = useState(0);

  // ticking clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Smart alarm trigger
  useEffect(() => {
    if (!recorder.recording || alarmRinging || !startedAt) return;
    const winStart = parseHHMM(wakeStart, startedAt);
    const winEnd = parseHHMM(wakeEnd, startedAt);
    if (now < winStart || now > winEnd) return;
    if (smartWake) {
      // light-phase detector: any movement/noise event in the last 60 sec triggers alarm
      const recent = recorder.events.filter(
        (e) => e.ts > now.getTime() - 60_000 && (e.type === "movement" || e.type === "noise"),
      );
      if (recent.length === 0 && now < winEnd) return; // wait for light phase
    } else if (now < winEnd) return;
    triggerAlarm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, recorder.events, recorder.recording, smartWake, wakeStart, wakeEnd, startedAt, alarmRinging]);

  const triggerAlarm = () => {
    setAlarmRinging(true);
    alarmRef.current.start(60_000);
    if ("vibrate" in navigator) navigator.vibrate?.([400, 200, 400, 200, 800]);
  };

  const start = async () => {
    if (!user) return;
    const startTs = new Date();
    const winStart = parseHHMM(wakeStart, startTs);
    const winEnd = parseHHMM(wakeEnd, startTs);
    const { data, error } = await supabase
      .from("sleep_sessions")
      .insert({
        user_id: user.id,
        started_at: startTs.toISOString(),
        wake_window_start: winStart.toISOString(),
        wake_window_end: winEnd.toISOString(),
        smart_wake: smartWake,
      })
      .select()
      .single();
    if (error) { toast.error(error.message); return; }
    setSessionId(data.id);
    setStartedAt(startTs);
    await recorder.start();
    // Wake lock so screen can sleep but JS keeps running (best-effort)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const wl = await (navigator as any).wakeLock?.request?.("screen");
      wakeLockRef.current = wl;
    } catch { /* ignore */ }
    setPulseKey((k) => k + 1);
    toast.success("Сон начат — спокойной ночи");
  };

  const stop = async (woke = false) => {
    if (!sessionId || !startedAt || !user) return;
    recorder.stop();
    if (alarmRef.current.playing) alarmRef.current.stop();
    setAlarmRinging(false);
    const ended = new Date();
    const dur = Math.round((ended.getTime() - startedAt.getTime()) / 60_000);
    const interruptions = recorder.events.filter((e) => e.type === "movement" || e.type === "noise").length;
    const avg = recorder.events.length
      ? recorder.events.reduce((s, e) => s + e.magnitude, 0) / recorder.events.length
      : 0;

    await supabase.from("sleep_sessions").update({
      ended_at: ended.toISOString(),
      woken_at: woke ? ended.toISOString() : null,
      duration_minutes: dur,
      interruptions,
      avg_loudness: Number(avg.toFixed(3)),
    }).eq("id", sessionId);

    if (recorder.events.length > 0) {
      const rows = recorder.events.map((e) => ({
        session_id: sessionId,
        user_id: user.id,
        ts: new Date(e.ts).toISOString(),
        event_type: e.type,
        magnitude: Number(e.magnitude.toFixed(3)),
      }));
      for (let i = 0; i < rows.length; i += 100) {
        await supabase.from("sleep_events").insert(rows.slice(i, i + 100));
      }
    }

    try { wakeLockRef.current?.release?.(); } catch { /* */ }
    wakeLockRef.current = null;
    setSessionId(null);
    setStartedAt(null);
    toast.success(`Сессия записана: ${Math.floor(dur / 60)}ч ${dur % 60}м`);
    onSaved?.();
  };

  const elapsed = useMemo(() => {
    if (!startedAt) return "";
    const ms = now.getTime() - startedAt.getTime();
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    return `${h}ч ${m}м`;
  }, [now, startedAt]);

  const eventCounts = useMemo(() => {
    const c = { silence: 0, movement: 0, snore: 0, noise: 0 };
    recorder.events.forEach((e) => { c[e.type]++; });
    return c;
  }, [recorder.events]);

  return (
    <Card className="ios-card p-6 space-y-6">
      {!recorder.recording && !alarmRinging && (
        <>
          <div className="text-center space-y-2">
            <Moon className="size-10 mx-auto text-primary" />
            <h2 className="text-xl font-semibold">Sleep Cycle</h2>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              Микрофон слушает фон ночью локально (звук не сохраняется), а будильник звонит в момент лёгкой фазы сна.
            </p>
          </div>

          <div className="space-y-4 max-w-sm mx-auto w-full">
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40">
              <div>
                <Label className="text-sm font-medium">Умный будильник</Label>
                <p className="text-xs text-muted-foreground">Звонит в фазе лёгкого сна</p>
              </div>
              <Switch checked={smartWake} onCheckedChange={setSmartWake} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Окно: с</Label>
                <Input type="time" value={wakeStart} onChange={(e) => setWakeStart(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">до</Label>
                <Input type="time" value={wakeEnd} onChange={(e) => setWakeEnd(e.target.value)} />
              </div>
            </div>

            {recorder.error && (
              <div className="flex gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-xs">
                <AlertCircle className="size-4 shrink-0" /> {recorder.error}
              </div>
            )}

            <Button onClick={start} className="w-full h-14 rounded-full text-base font-semibold gap-2">
              <Mic className="size-5" /> Начать сон
            </Button>
          </div>
        </>
      )}

      {recorder.recording && !alarmRinging && (
        <div className="text-center space-y-5">
          <div className="relative inline-block">
            <Moon className="size-16 text-primary mx-auto animate-float" key={pulseKey} />
            <span className="absolute -top-1 -right-1 size-3 rounded-full bg-destructive animate-pulse" />
          </div>
          <div>
            <p className="mono text-xs uppercase tracking-widest text-muted-foreground">записываю</p>
            <p className="text-3xl font-bold mt-1">{elapsed}</p>
            <p className="text-xs text-muted-foreground mt-1">с {startedAt && formatHHMM(startedAt)}</p>
          </div>

          <div className="max-w-xs mx-auto space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Громкость</span>
              <span className="mono">{Math.round(recorder.currentLoudness * 100)}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full transition-all duration-300 bg-primary"
                style={{ width: `${Math.max(2, recorder.currentLoudness * 100)}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 max-w-xs mx-auto text-xs">
            <Stat label="Тишина" v={eventCounts.silence} />
            <Stat label="Движение" v={eventCounts.movement} />
            <Stat label="Храп" v={eventCounts.snore} />
            <Stat label="Шум" v={eventCounts.noise} />
          </div>

          <Button onClick={() => stop(true)} variant="outline" className="rounded-full">
            <MicOff className="size-4 mr-2" /> Прервать сон
          </Button>
        </div>
      )}

      {alarmRinging && (
        <div className="text-center space-y-5 py-6">
          <Sun className="size-20 text-primary mx-auto animate-pulse" />
          <div>
            <h2 className="text-2xl font-bold">Доброе утро</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {smartWake ? "Поймал фазу лёгкого сна" : "Время вставать"}
            </p>
          </div>
          <Button onClick={() => stop(true)} className="w-full max-w-xs h-14 rounded-full text-base gap-2">
            <Volume2 className="size-5" /> Выключить
          </Button>
        </div>
      )}
    </Card>
  );
};

const Stat = ({ label, v }: { label: string; v: number }) => (
  <div className="p-2 rounded-lg bg-muted/40">
    <p className="mono text-base font-bold">{v}</p>
    <p className="text-[10px] text-muted-foreground">{label}</p>
  </div>
);
