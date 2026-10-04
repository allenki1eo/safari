/**
 * Herd placement for the daily route. Pure, so the same Dar day and the same
 * spot on the journey always rebuild the same animal.
 */
import { herdRng } from '../data/daily.js';

export const HERD_STEP = 22;

/** First herd mark at or ahead of journey distance J, on the shared grid. */
export function herdCursor(J) {
  const step = HERD_STEP;
  return Math.ceil(Math.max(0, J) / step) * step;
}

function weighted(list, rng) {
  let total = 0;
  for (const entry of list) total += entry[entry.length - 1];
  let r = rng() * total;
  for (const entry of list) if ((r -= entry[entry.length - 1]) <= 0) return entry;
  return list[0];
}

// Plains animals that graze, wander and trot; the rest keep the mode their region gives them.
export const ROAMERS = new Set(['zebra', 'giraffe', 'elephant', 'wildebeest', 'buffalo', 'lion', 'rhino']);

/** Mixes a region's usual mode for an animal with the others, so a herd never moves as one. */
function vary(kind, mode, rng) {
  if (!ROAMERS.has(kind)) return mode;
  const r = rng();
  if (mode === 'walk') return r < 0.55 ? 'walk' : r < 0.85 ? 'idle' : 'run';
  return r < 0.6 ? 'idle' : r < 0.92 ? 'walk' : 'run';
}

/** How a roaming animal changes its mind: idle for a while, wander, now and then a trot. */
export function nextMode(mode, r) {
  if (mode === 'run') return r < 0.6 ? 'walk' : 'idle';
  if (mode === 'walk') return r < 0.5 ? 'idle' : r < 0.8 ? 'walk' : 'run';
  return r < 0.55 ? 'walk' : r < 0.9 ? 'idle' : 'run';
}

/** Ground speed for each mode, in metres per second, scaled by the animal's own pace. */
export const MODE_SPEED = { idle: 0, walk: 1, run: 4.5 };

/**
 * One herd animal at journey distance `wz`. Returns null where the region has
 * no herd (Zanzibar) — callers skip it rather than inventing an animal.
 */
export function planHerd(region, day, wz) {
  if (!region.herd?.length) return null;
  const rng = herdRng(day, wz);
  const [kind, mode] = weighted(region.herd, rng);
  const water = region.ground.water ? region.ground.waterSide ?? -1 : 0;
  const wet = kind === 'hippo' || kind === 'flamingo' || kind === 'dolphin';
  let side = rng() < 0.5 ? -1 : 1;
  if (wet && water) side = water;
  const big = kind === 'elephant' || kind === 'giraffe';
  const xr = kind === 'dolphin' ? [22, 60] : wet && water ? [17, 40] : kind === 'crab' ? [4.5, 10] : kind === 'gorilla' ? [6, 16] : big ? [16, 40] : [11, 32];
  const span = xr[1] - xr[0];
  return {
    kind,
    mode: vary(kind, mode, rng),
    x: side * (xr[0] + rng() * span),
    y: wet && water && kind === 'hippo' ? -0.55 : kind === 'dolphin' ? 0.3 : 0,
    walkV: 0.6 + rng() * 0.8,
    dir: side,
    rot: rng() * Math.PI * 2,
    xr,
  };
}
