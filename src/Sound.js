/* ─── SFX — Web Audio synthesised sound effects ─────────────── */

let _ctx = null;

function ctx() {
  if (!_ctx) {
    _ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return _ctx;
}

/** Resume audio context (must be called from user gesture) */
export function resumeAudio() {
  if (_ctx && _ctx.state === 'suspended') _ctx.resume();
}

/* ─── Helper: play a buffer-based beep / noise ──────────────── */
function playTone(freq, dur, type = 'sine', vol = 0.15, detune = 0) {
  const c = ctx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.detune.value = detune;
  gain.gain.setValueAtTime(vol, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(c.currentTime);
  osc.stop(c.currentTime + dur);
}

function playNoise(dur, vol = 0.08) {
  const c = ctx();
  const bufSize = c.sampleRate * dur;
  const buf = c.createBuffer(1, bufSize, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1);
  const src = c.createBufferSource();
  src.buffer = buf;
  const gain = c.createGain();
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 800;
  gain.gain.setValueAtTime(vol, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
  src.connect(filter).connect(gain).connect(c.destination);
  src.start();
}

/* ─── Game Sound Effects ────────────────────────────────────── */

export function sfxJump() {
  playTone(320, 0.15, 'sine', 0.12);
  setTimeout(() => playTone(480, 0.1, 'sine', 0.08), 50);
}

export function sfxDoubleJump() {
  playTone(400, 0.1, 'sine', 0.12);
  setTimeout(() => playTone(600, 0.12, 'sine', 0.1), 40);
  setTimeout(() => playTone(800, 0.08, 'sine', 0.06), 80);
}

export function sfxSlide() {
  playNoise(0.25, 0.1);
  playTone(150, 0.2, 'sawtooth', 0.04);
}

export function sfxLand() {
  playNoise(0.08, 0.06);
  playTone(100, 0.1, 'sine', 0.05);
}

export function sfxGem() {
  playTone(880, 0.08, 'sine', 0.12);
  setTimeout(() => playTone(1100, 0.1, 'sine', 0.1), 60);
  setTimeout(() => playTone(1320, 0.15, 'sine', 0.08), 120);
}

export function sfxCombo(multiplier) {
  const baseFreq = 600 + multiplier * 100;
  playTone(baseFreq, 0.06, 'sine', 0.1);
  setTimeout(() => playTone(baseFreq * 1.25, 0.08, 'sine', 0.08), 40);
  setTimeout(() => playTone(baseFreq * 1.5, 0.12, 'sine', 0.06), 80);
}

export function sfxHit() {
  playNoise(0.3, 0.18);
  playTone(80, 0.3, 'square', 0.1);
  playTone(60, 0.2, 'sawtooth', 0.06);
}

export function sfxDeath() {
  playTone(300, 0.15, 'sawtooth', 0.12);
  setTimeout(() => playTone(200, 0.2, 'sawtooth', 0.1), 100);
  setTimeout(() => playTone(100, 0.4, 'sawtooth', 0.08), 250);
  setTimeout(() => playNoise(0.5, 0.1), 300);
}

export function sfxLaneSwitch() {
  playTone(500, 0.06, 'sine', 0.06);
}

export function sfxLevelComplete() {
  const notes = [523, 659, 784, 1047]; // C E G C
  notes.forEach((f, i) => {
    setTimeout(() => playTone(f, 0.25, 'sine', 0.1), i * 120);
  });
}

export function sfxMenuClick() {
  playTone(660, 0.06, 'sine', 0.08);
  setTimeout(() => playTone(880, 0.08, 'sine', 0.06), 30);
}

/* ─── Ambient background (simple procedural loop) ───────────── */
let _ambientOsc = null;
let _ambientGain = null;

export function startAmbient() {
  if (_ambientOsc) return;
  const c = ctx();
  _ambientGain = c.createGain();
  _ambientGain.gain.value = 0;
  _ambientGain.gain.linearRampToValueAtTime(0.03, c.currentTime + 2);
  _ambientGain.connect(c.destination);

  // Low drone
  _ambientOsc = c.createOscillator();
  _ambientOsc.type = 'sine';
  _ambientOsc.frequency.value = 55; // A1
  _ambientOsc.connect(_ambientGain);
  _ambientOsc.start();

  // Subtle shimmer
  const osc2 = c.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.value = 110;
  const g2 = c.createGain();
  g2.gain.value = 0.015;
  osc2.connect(g2).connect(c.destination);
  osc2.start();
  _ambientOsc._extra = { osc2, g2 };
}

export function stopAmbient() {
  if (!_ambientOsc) return;
  try {
    _ambientGain.gain.linearRampToValueAtTime(0, ctx().currentTime + 0.5);
    setTimeout(() => {
      _ambientOsc.stop();
      _ambientOsc._extra?.osc2?.stop();
      _ambientOsc = null;
      _ambientGain = null;
    }, 600);
  } catch (e) {
    _ambientOsc = null;
    _ambientGain = null;
  }
}

/* ─── Footstep rhythm (called from game loop) ───────────────── */
let _lastFootstep = 0;
export function tickFootsteps(time, speed, onGround, isSliding) {
  if (!onGround || isSliding) return;
  const interval = Math.max(0.15, 0.45 - speed * 0.01);
  if (time - _lastFootstep > interval) {
    _lastFootstep = time;
    playNoise(0.04, 0.03 + Math.random() * 0.02);
  }
}
