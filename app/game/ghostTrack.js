/**
 * The shadow runner's recording. While you run, your lane position, height and move (run,
 * jump, slide, ride, fly) are sampled eight times a second together with the distance covered,
 * packed four bytes a sample and sent with a challenge. A friend who opens it races a replay
 * that dodges, jumps and slides exactly where you did.
 */
export const GHOST_HZ = 8;
export const POSES = ['run', 'jump', 'slide', 'ride', 'fly'];
const MAX_SAMPLES = GHOST_HZ * 60 * 15; // a quarter of an hour is plenty
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

const clampByte = (v) => Math.max(0, Math.min(255, Math.round(v)));

export class GhostRecorder {
  constructor() {
    this.bytes = [];
    this.next = 0; // run time of the next sample
    this.d = 0; // distance as the samples have encoded it (so rounding never drifts)
  }

  /** Called every frame of a run with the run clock (s), distance (m) and the runner's state. */
  sample(time, distance, x, y, pose) {
    while (time >= this.next && this.bytes.length < MAX_SAMPLES * 4) {
      const dd = clampByte((distance - this.d) * 10); // decimetres
      this.d += dd / 10;
      this.bytes.push(dd, clampByte(x * 20 + 128), clampByte(y * 8), Math.max(0, POSES.indexOf(pose)));
      this.next += 1 / GHOST_HZ;
    }
  }

  get length() {
    return this.bytes.length / 4;
  }

  encode() {
    return encodeBytes(this.bytes);
  }
}

export function encodeBytes(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    const chars = i + 2 < bytes.length ? 4 : i + 1 < bytes.length ? 3 : 2;
    for (let k = 0; k < chars; k++) out += B64[(n >> (18 - 6 * k)) & 63];
  }
  return out;
}

export function decodeBytes(str) {
  const bytes = [];
  let n = 0;
  let bits = 0;
  for (const ch of String(str)) {
    const v = B64.indexOf(ch);
    if (v < 0) return null;
    n = ((n << 6) | v) & 0xffffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((n >> bits) & 255);
    }
  }
  return bytes;
}

/** True for a string that decodes to whole samples. */
export function validTrack(str) {
  if (typeof str !== 'string' || !str || str.length > Math.ceil((MAX_SAMPLES * 4 * 4) / 3) + 4) return false;
  const bytes = decodeBytes(str);
  return !!bytes && bytes.length >= 4 && bytes.length % 4 === 0;
}

/** A decoded recording you can ask "where were you at time t?". */
export class GhostTrack {
  constructor(str) {
    const bytes = decodeBytes(str) ?? [];
    const n = Math.floor(bytes.length / 4);
    this.n = n;
    this.dist = new Float32Array(n);
    this.x = new Float32Array(n);
    this.y = new Float32Array(n);
    this.pose = new Uint8Array(n);
    let d = 0;
    for (let i = 0; i < n; i++) {
      d += bytes[i * 4] / 10;
      this.dist[i] = d;
      this.x[i] = (bytes[i * 4 + 1] - 128) / 20;
      this.y[i] = bytes[i * 4 + 2] / 8;
      this.pose[i] = Math.min(POSES.length - 1, bytes[i * 4 + 3]);
    }
    this.duration = n / GHOST_HZ;
    this.distance = n ? this.dist[n - 1] : 0;
  }

  /** Position at run time `t` (s), smoothly between samples; `done` once the recording ends. */
  at(t, out = {}) {
    if (!this.n) return null;
    const f = Math.max(0, t) * GHOST_HZ;
    const i = Math.min(this.n - 1, Math.floor(f));
    const j = Math.min(this.n - 1, i + 1);
    const k = Math.min(1, f - i);
    out.distance = this.dist[i] + (this.dist[j] - this.dist[i]) * k;
    out.x = this.x[i] + (this.x[j] - this.x[i]) * k;
    out.y = this.y[i] + (this.y[j] - this.y[i]) * k;
    out.pose = POSES[this.pose[k < 0.5 ? i : j]];
    out.done = f >= this.n - 1;
    return out;
  }
}
