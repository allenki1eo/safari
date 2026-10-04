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
    mode,
    x: side * (xr[0] + rng() * span),
    y: wet && water && kind === 'hippo' ? -0.55 : kind === 'dolphin' ? 0.3 : 0,
    walkV: 0.6 + rng() * 0.8,
    dir: side,
    rot: mode === 'walk' ? (side > 0 ? -Math.PI / 2 : Math.PI / 2) : rng() * Math.PI * 2,
    xr,
  };
}
