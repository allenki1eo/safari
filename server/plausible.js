/**
 * What a real run can look like. Shared by the score route, the prize boards and the derby,
 * so a run that could not have happened never posts, never wins and never pulls the rope.
 *
 * Numbers come from the game itself (app/game/game.js, app/data/daily.js):
 * - cruise speed tops out at SPEED_CAP (40 m/s); the cheetah ally adds bursts on top, so a whole
 *   run averages well under MAX_AVG_PACE.
 * - points per metre are at most a few per multiplier step, plus seed pickups, combos and prize
 *   boxes. The ceiling below is generous (live top runs sit at 3–47 points a metre).
 * - the permanent multiplier is 1 + missionLevel, and missionLevel stops at 29.
 */
import { SPEED_CAP } from '../app/data/daily.js';

export const MAX_MULT = 30;
export const MAX_AVG_PACE = SPEED_CAP + 8; // 48 m/s over a whole run
export const PACE_SLACK_M = 60; // rounding and the countdown after a revive
export const PTS_PER_M = 12; // per multiplier step
export const PTS_FLAT = 30_000; // per multiplier step: region bonuses, combos, boxes, word hunt
export const SEEDS_PER_M = 2;
export const SEEDS_FLAT = 3_000;
// prize boards count the multiplier up to this; past it, more mission sets add nothing to prizes
export const PRIZE_MULT_CAP = 10;

/** Highest score a run of `distance` metres can reach at multiplier `mult` (unknown → the max). */
export function scoreCeiling(distance, mult = MAX_MULT) {
  const m = Math.min(MAX_MULT, Math.max(1, Number(mult) || MAX_MULT));
  return m * (PTS_PER_M * Math.max(0, distance) + PTS_FLAT);
}

/** { ok: true } or { ok: false, reason } for one finished run. */
export function plausibleRun({ score = 0, distance = 0, duration = 0, seeds = 0, mult } = {}) {
  if (duration > 0 && distance > duration * MAX_AVG_PACE + PACE_SLACK_M) return { ok: false, reason: 'pace' };
  if (score > scoreCeiling(distance, mult)) return { ok: false, reason: 'score' };
  if (seeds > SEEDS_PER_M * distance + SEEDS_FLAT) return { ok: false, reason: 'seeds' };
  return { ok: true };
}

/** The same checks as SQL over a daily_scores row aliased `t` (prize boards and settling). */
export const fairRunSql = (t) =>
  `${t}.score > 0 AND ${t}.duration > 0` +
  ` AND ${t}.distance <= ${t}.duration * ${MAX_AVG_PACE} + ${PACE_SLACK_M}` +
  ` AND ${t}.score <= ${MAX_MULT} * (${PTS_PER_M} * ${t}.distance + ${PTS_FLAT})`;

/**
 * A prize-board score: the multiplier counts up to PRIZE_MULT_CAP. `m` is the run_meta alias;
 * runs saved before the multiplier was recorded count as they are.
 */
export const prizeScoreSql = (t, m) =>
  `CASE WHEN ${m}.mult IS NULL OR ${m}.mult <= ${PRIZE_MULT_CAP} THEN ${t}.score` +
  ` ELSE CAST(${t}.score * ${PRIZE_MULT_CAP} / ${m}.mult AS INTEGER) END`;
