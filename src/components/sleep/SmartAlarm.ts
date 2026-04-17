// Smart alarm: gradually fades in a soft sine-wave melody over ~90 sec.
// Triggered when within wake window AND user is in light sleep phase
// (recent samples show movement, indicating REM exit).
export class SmartAlarm {
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private oscillators: OscillatorNode[] = [];
  private fadeTimer: number | null = null;
  public playing = false;

  start(durationMs = 90_000) {
    if (this.playing) return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioCtx();
    this.gain = this.ctx.createGain();
    this.gain.gain.value = 0;
    this.gain.connect(this.ctx.destination);

    // simple chord: C major with gentle detune
    const freqs = [261.63, 329.63, 392.0];
    freqs.forEach((f, i) => {
      const o = this.ctx!.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      o.detune.value = i * 5;
      o.connect(this.gain!);
      o.start();
      this.oscillators.push(o);
    });

    // fade in 0 -> 0.35 across durationMs
    const now = this.ctx.currentTime;
    this.gain.gain.setValueAtTime(0, now);
    this.gain.gain.linearRampToValueAtTime(0.35, now + durationMs / 1000);
    this.playing = true;
  }

  stop() {
    if (!this.ctx || !this.gain) return;
    const now = this.ctx.currentTime;
    this.gain.gain.cancelScheduledValues(now);
    this.gain.gain.linearRampToValueAtTime(0, now + 0.3);
    setTimeout(() => {
      this.oscillators.forEach((o) => { try { o.stop(); } catch { /* */ } });
      this.oscillators = [];
      this.ctx?.close();
      this.ctx = null;
      this.gain = null;
      if (this.fadeTimer) clearTimeout(this.fadeTimer);
      this.playing = false;
    }, 350);
  }
}
