/**
 * Fully procedural audio — kalimba + djembe soundtrack and all SFX are synthesised,
 * so the game ships with zero audio files.
 */
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
// D major pentatonic, centred around D5
const PENTA = [62, 64, 66, 69, 71, 74, 76, 78, 81, 83, 86];
const CHORDS = [
  [50, 54, 57], // D
  [47, 50, 54], // Bm
  [43, 47, 50], // G
  [45, 49, 52], // A
];
// Melody per chord as indices into PENTA (-1 = rest), 8 eighth-notes per bar.
const MELODY = [
  [5, -1, 3, 4, 5, -1, 7, 5],
  [4, -1, 2, 3, 4, 2, 1, -1],
  [3, 4, 5, -1, 4, 3, 1, 2],
  [3, -1, 4, -1, 6, 5, 4, -1],
  [5, 7, 8, -1, 7, 5, 4, 5],
  [4, -1, 5, 4, 2, -1, 1, 2],
  [1, 2, 3, -1, 5, -1, 3, 4],
  [6, 5, 4, 3, 4, -1, -1, -1],
];

class AudioEngine {
  ctx = null;
  master = null;
  musicGain = null;
  sfxGain = null;
  noiseBuf = null;
  musicOn = true;
  soundOn = true;
  intensity = 0; // 0 = menu (gentle), 1 = running (full groove)
  step = 0;
  nextTime = 0;
  timer = null;
  tempo = 116;

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(this.ctx.destination);

    this.musicFilter = this.ctx.createBiquadFilter();
    this.musicFilter.type = 'lowpass';
    this.musicFilter.frequency.value = 18000;
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.musicOn ? 0.42 : 0;
    this.musicGain.connect(this.musicFilter).connect(this.master);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.soundOn ? 0.8 : 0;
    this.sfxGain.connect(this.master);

    // simple echo for kalimba shimmer
    this.delay = this.ctx.createDelay();
    this.delay.delayTime.value = 60 / this.tempo * 0.75;
    const fb = this.ctx.createGain();
    fb.gain.value = 0.28;
    const wet = this.ctx.createGain();
    wet.gain.value = 0.3;
    this.delay.connect(fb).connect(this.delay);
    this.delay.connect(wet).connect(this.musicGain);

    const len = this.ctx.sampleRate * 1.5;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 25);
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend();
      else this.ctx.resume();
    });
  }

  setMusic(on) {
    this.musicOn = on;
    if (this.musicGain) this.musicGain.gain.setTargetAtTime(on ? 0.42 : 0, this.ctx.currentTime, 0.1);
  }
  setSound(on) {
    this.soundOn = on;
    if (this.sfxGain) this.sfxGain.gain.setTargetAtTime(on ? 0.8 : 0, this.ctx.currentTime, 0.05);
  }
  setIntensity(v) {
    this.intensity = v;
  }
  muffle(on) {
    if (!this.ctx) return;
    this.musicFilter.frequency.setTargetAtTime(on ? 600 : 18000, this.ctx.currentTime, 0.15);
  }

  /* ------------------------------------------------------------- sequencer */
  schedule() {
    const ctx = this.ctx;
    const stepDur = 60 / this.tempo / 4; // 16ths
    while (this.nextTime < ctx.currentTime + 0.15) {
      this.playStep(this.step, this.nextTime);
      this.nextTime += stepDur;
      this.step = (this.step + 1) % 128;
    }
  }

  playStep(step, t) {
    const bar = Math.floor(step / 16) % 8;
    const s16 = step % 16;
    const chord = CHORDS[bar % 4];
    const full = this.intensity > 0;

    // bass on the downbeats
    if (s16 === 0 || s16 === 10 || (full && s16 === 6)) this.bass(NOTE(chord[0] - 12 + (s16 === 10 ? 7 : 0)), t);
    // pad-ish kalimba chord at bar start
    if (s16 === 0) chord.forEach((n, i) => this.kalimba(NOTE(n + 12), t + i * 0.02, 0.12));
    // melody (eighths)
    if (s16 % 2 === 0) {
      const idx = MELODY[bar][s16 / 2];
      if (idx >= 0 && (full || s16 % 4 === 0)) this.kalimba(NOTE(PENTA[idx]), t, full ? 0.2 : 0.14, true);
    }
    if (!full) return;
    // djembe groove
    if (s16 === 0 || s16 === 8 || s16 === 11) this.drumLow(t);
    if (s16 === 4 || s16 === 12) this.drumSlap(t);
    if (s16 === 14 && bar % 2 === 1) this.drumSlap(t, 0.5);
    // shaker 16ths
    this.shaker(t, s16 % 4 === 2 ? 0.07 : 0.035);
  }

  /* ----------------------------------------------------------- instruments */
  env(g, t, a, peak, dec) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }

  kalimba(f, t, vol = 0.2, echo = false) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const g = ctx.createGain();
    const g2 = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = f;
    o2.type = 'sine';
    o2.frequency.value = f * 5.95;
    this.env(g, t, 0.004, vol, 0.9);
    this.env(g2, t, 0.002, vol * 0.25, 0.08);
    o.connect(g).connect(this.musicGain);
    o2.connect(g2).connect(this.musicGain);
    if (echo) g.connect(this.delay);
    o.start(t);
    o2.start(t);
    o.stop(t + 1);
    o2.stop(t + 0.2);
  }

  bass(f, t) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 500;
    o.type = 'triangle';
    o.frequency.value = f;
    this.env(g, t, 0.01, 0.38, 0.35);
    o.connect(lp).connect(g).connect(this.musicGain);
    o.start(t);
    o.stop(t + 0.4);
  }

  drumLow(t) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(55, t + 0.15);
    this.env(g, t, 0.003, 0.7, 0.22);
    o.connect(g).connect(this.musicGain);
    o.start(t);
    o.stop(t + 0.3);
  }

  noise(t, dur, type, freq, q, vol, dest = this.musicGain) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    this.env(g, t, 0.002, vol, dur);
    src.connect(f).connect(g).connect(dest);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
    return f;
  }

  drumSlap(t, v = 1) {
    this.noise(t, 0.09, 'bandpass', 1800, 1.2, 0.5 * v);
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(380, t);
    o.frequency.exponentialRampToValueAtTime(220, t + 0.05);
    this.env(g, t, 0.002, 0.25 * v, 0.07);
    o.connect(g).connect(this.musicGain);
    o.start(t);
    o.stop(t + 0.1);
  }

  shaker(t, v) {
    this.noise(t, 0.04, 'highpass', 7000, 0.7, v);
  }

  /* ------------------------------------------------------------------ SFX */
  tone(type, f0, f1, dur, vol, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    this.env(g, t, 0.005, vol, dur);
    o.connect(g).connect(this.sfxGain);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  coin(combo = 0) {
    if (!this.ctx) return;
    const n = PENTA[Math.min(PENTA.length - 1, 3 + (combo % 8))] + 12;
    this.tone('sine', NOTE(n), NOTE(n), 0.12, 0.16);
    this.tone('sine', NOTE(n + 7), NOTE(n + 7), 0.16, 0.12, 0.05);
  }
  jump() {
    this.tone('triangle', 260, 640, 0.16, 0.22);
  }
  slide() {
    if (!this.ctx) return;
    const f = this.noise(this.ctx.currentTime, 0.28, 'bandpass', 2400, 2, 0.35, this.sfxGain);
    f.frequency.exponentialRampToValueAtTime(500, this.ctx.currentTime + 0.28);
  }
  land() {
    this.tone('sine', 140, 70, 0.08, 0.2);
  }
  bump() {
    this.tone('square', 180, 90, 0.12, 0.14);
    this.tone('sine', 500, 900, 0.1, 0.12, 0.05);
  }
  crash() {
    if (!this.ctx) return;
    this.noise(this.ctx.currentTime, 0.5, 'lowpass', 900, 0.8, 0.8, this.sfxGain);
    this.tone('sine', 200, 40, 0.5, 0.5);
  }
  smash() {
    if (!this.ctx) return;
    this.noise(this.ctx.currentTime, 0.3, 'lowpass', 1600, 0.8, 0.6, this.sfxGain);
    this.tone('square', 120, 50, 0.2, 0.2);
  }
  powerup() {
    [0, 4, 7, 12, 16].forEach((s, i) => this.tone('triangle', NOTE(74 + s), NOTE(74 + s), 0.18, 0.15, i * 0.06));
  }
  chime() {
    [0, 7, 12, 16, 19].forEach((s, i) => this.tone('sine', NOTE(69 + s), NOTE(69 + s), 0.9, 0.1, i * 0.09));
  }
  click() {
    this.tone('sine', 900, 700, 0.05, 0.12);
  }
  buy() {
    [0, 5, 9, 12].forEach((s, i) => this.tone('square', NOTE(72 + s), NOTE(72 + s), 0.1, 0.07, i * 0.07));
  }
  roar() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lg = ctx.createGain();
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(70, t + 1.1);
    lfo.frequency.value = 28;
    lg.gain.value = 25;
    lfo.connect(lg).connect(o.frequency);
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1400, t);
    lp.frequency.exponentialRampToValueAtTime(300, t + 1.1);
    this.env(g, t, 0.08, 0.5, 1.1);
    o.connect(lp).connect(g).connect(this.sfxGain);
    o.start(t);
    lfo.start(t);
    o.stop(t + 1.3);
    lfo.stop(t + 1.3);
    this.noise(t, 1.0, 'bandpass', 600, 0.6, 0.35, this.sfxGain);
  }
  trumpet() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const bp = ctx.createBiquadFilter();
    const lfo = ctx.createOscillator();
    const lg = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(380, t);
    o.frequency.linearRampToValueAtTime(620, t + 0.15);
    o.frequency.linearRampToValueAtTime(540, t + 0.7);
    lfo.frequency.value = 9;
    lg.gain.value = 18;
    lfo.connect(lg).connect(o.frequency);
    bp.type = 'bandpass';
    bp.frequency.value = 1100;
    bp.Q.value = 1.5;
    this.env(g, t, 0.05, 0.45, 0.75);
    o.connect(bp).connect(g).connect(this.sfxGain);
    o.start(t);
    lfo.start(t);
    o.stop(t + 0.9);
    lfo.stop(t + 0.9);
  }
  whoosh() {
    if (!this.ctx) return;
    const f = this.noise(this.ctx.currentTime, 0.6, 'bandpass', 400, 1.5, 0.5, this.sfxGain);
    f.frequency.exponentialRampToValueAtTime(2500, this.ctx.currentTime + 0.5);
  }
  cackle() {
    if (!this.ctx) return;
    for (let i = 0; i < 6; i++) {
      const f = 520 + Math.sin(i * 1.7) * 90 + i * 20;
      this.tone('square', f * 1.15, f * 0.8, 0.07, 0.07, i * 0.1);
    }
  }
}

export const audio = new AudioEngine();
