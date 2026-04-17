// Web Audio recorder for sleep tracking. Samples microphone every ~30 sec, classifies
// the audio chunk into silence/movement/snore/noise based on RMS loudness and zero-crossing rate.
// All processing is local, audio is NEVER uploaded.
import { useCallback, useEffect, useRef, useState } from "react";

export type SleepEventType = "silence" | "movement" | "snore" | "noise";

export interface SleepEvent {
  ts: number; // unix ms
  type: SleepEventType;
  magnitude: number; // 0..1
}

interface UseSleepRecorder {
  recording: boolean;
  events: SleepEvent[];
  currentLoudness: number; // 0..1
  start: () => Promise<void>;
  stop: () => void;
  error: string | null;
}

const SAMPLE_INTERVAL_MS = 30_000;

const classify = (rms: number, zcr: number): SleepEventType => {
  if (rms < 0.02) return "silence";
  if (rms < 0.08) return "movement";
  // higher RMS — either snore (low ZCR, periodic) or noise (high ZCR)
  return zcr < 0.15 ? "snore" : "noise";
};

export const useSleepRecorder = (): UseSleepRecorder => {
  const [recording, setRecording] = useState(false);
  const [events, setEvents] = useState<SleepEvent[]>([]);
  const [currentLoudness, setCurrentLoudness] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sampleTimerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const bufRef = useRef<Float32Array | null>(null);
  // accumulators for next 30 sec sample
  const accumRMS = useRef<number[]>([]);
  const accumZCR = useRef<number[]>([]);

  const tick = useCallback(() => {
    const analyser = analyserRef.current;
    const buf = bufRef.current;
    if (!analyser || !buf) return;
    // Cast to satisfy stricter Float32Array<ArrayBuffer> typing in newer TS lib
    analyser.getFloatTimeDomainData(buf as unknown as Float32Array);
    let sumSq = 0;
    let crossings = 0;
    let prev = buf[0];
    for (let i = 1; i < buf.length; i++) {
      sumSq += buf[i] * buf[i];
      if ((prev >= 0 && buf[i] < 0) || (prev < 0 && buf[i] >= 0)) crossings++;
      prev = buf[i];
    }
    const rms = Math.sqrt(sumSq / buf.length);
    const zcr = crossings / buf.length;
    accumRMS.current.push(rms);
    accumZCR.current.push(zcr);
    setCurrentLoudness(Math.min(1, rms * 8));
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const sampleAndPush = useCallback(() => {
    if (accumRMS.current.length === 0) return;
    const avgRMS = accumRMS.current.reduce((s, x) => s + x, 0) / accumRMS.current.length;
    const avgZCR = accumZCR.current.reduce((s, x) => s + x, 0) / accumZCR.current.length;
    accumRMS.current = [];
    accumZCR.current = [];
    const ev: SleepEvent = {
      ts: Date.now(),
      type: classify(avgRMS, avgZCR),
      magnitude: Math.min(1, avgRMS * 8),
    };
    setEvents((prev) => [...prev, ev]);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      streamRef.current = stream;
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      ctxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      src.connect(analyser);
      analyserRef.current = analyser;
      bufRef.current = new Float32Array(analyser.fftSize);

      setEvents([]);
      accumRMS.current = [];
      accumZCR.current = [];
      setRecording(true);

      tick();
      sampleTimerRef.current = window.setInterval(sampleAndPush, SAMPLE_INTERVAL_MS);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось получить доступ к микрофону");
      setRecording(false);
    }
  }, [tick, sampleAndPush]);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (sampleTimerRef.current) clearInterval(sampleTimerRef.current);
    sampleAndPush(); // capture final partial sample
    streamRef.current?.getTracks().forEach((t) => t.stop());
    ctxRef.current?.close();
    streamRef.current = null;
    ctxRef.current = null;
    analyserRef.current = null;
    bufRef.current = null;
    setRecording(false);
    setCurrentLoudness(0);
  }, [sampleAndPush]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (sampleTimerRef.current) clearInterval(sampleTimerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      ctxRef.current?.close();
    };
  }, []);

  return { recording, events, currentLoudness, start, stop, error };
};
