import { describe, it, expect } from 'vitest';
import { cruiseSpeed, chunkGap, SPEED_CAP } from '../app/data/daily.js';
import { makeChunk, tutorialPlan, KINDS } from '../app/game/patterns.js';
import { TUTORIAL } from '../app/data/content.js';
import { REGIONS } from '../app/data/regions.js';

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('late-run difficulty', () => {
  it('speed keeps climbing past 5 km but never passes the cap', () => {
    let prev = 0;
    for (let z = 0; z <= 40_000; z += 250) {
      const v = cruiseSpeed(z);
      expect(v).toBeGreaterThanOrEqual(prev);
      expect(v).toBeLessThanOrEqual(SPEED_CAP);
      prev = v;
    }
    expect(cruiseSpeed(0)).toBe(15);
    expect(cruiseSpeed(10_000) - cruiseSpeed(5_000)).toBeGreaterThan(1.5);
    expect(cruiseSpeed(15_000)).toBeGreaterThan(39);
    expect(cruiseSpeed(40_000)).toBeCloseTo(SPEED_CAP, 1);
  });

  it('breathers between chunks keep shrinking until 12 km, never below 12 m', () => {
    expect(chunkGap(9000) / cruiseSpeed(9000)).toBeLessThan(chunkGap(6000) / cruiseSpeed(6000));
    for (let z = 0; z <= 30_000; z += 500) expect(chunkGap(z)).toBeGreaterThanOrEqual(12);
  });

  it('two-step patterns show up after 2.5 km and become common deep into a run', () => {
    const count = (D, n = 1500) => {
      const rng = mulberry32(D);
      const seen = {};
      for (let i = 0; i < n; i++) {
        const c = makeChunk({ z: D, D, speed: cruiseSpeed(D), region: REGIONS[0], rng });
        seen[c.pat] = (seen[c.pat] ?? 0) + 1;
      }
      return seen;
    };
    const early = count(600);
    expect(early.switchback ?? 0).toBe(0);
    expect(early.gauntlet ?? 0).toBe(0);
    const deep = count(8000);
    expect(deep.switchback).toBeGreaterThan(50);
    expect(deep.gauntlet).toBeGreaterThan(30);
    expect(deep.single ?? 0).toBeLessThan(count(1000).single);
  });

  it('a switchback always leaves an open lane in each wall, and the two gaps differ', () => {
    const rng = mulberry32(7);
    let checked = 0;
    for (let i = 0; i < 3000 && checked < 40; i++) {
      const c = makeChunk({ z: 100, D: 8000, speed: cruiseSpeed(8000), region: REGIONS[0], rng });
      if (c.pat !== 'switchback') continue;
      checked++;
      const walls = {};
      for (const [op, kind, lane, wz] of c.ops) if (op === 'obs' && KINDS[kind].pass === 'hard') (walls[wz] ??= new Set()).add(lane);
      const rows = Object.values(walls);
      expect(rows).toHaveLength(2);
      const open = rows.map((r) => [0, 1, 2].find((l) => !r.has(l)));
      for (const r of rows) expect(r.size).toBe(2);
      expect(open[0]).not.toBe(open[1]);
      expect(Math.abs(open[0] - open[1])).toBe(1); // one lane change, never two
    }
    expect(checked).toBeGreaterThan(10);
  });
});

describe('first-run tutorial', () => {
  it('shows each tip before the obstacle it teaches', () => {
    const { chunks } = tutorialPlan();
    const firstAt = (pass) => {
      for (const c of chunks) for (const [op, kind, , wz] of c.ops) if (op === 'obs' && KINDS[kind].pass === pass) return wz;
      return null;
    };
    const totemAt = chunks.flatMap((c) => c.ops.filter((o) => o[0] === 'totem').map((o) => o[3]))[0];
    const tip = (word) => TUTORIAL.find((tp) => tp.text.includes(word)).at;
    const firstObstacle = Math.min(...chunks.flatMap((c) => c.ops.filter((o) => o[0] === 'obs').map((o) => o[3])));
    // a tip needs about two seconds at the opening pace (15 m/s) to be read
    expect(tip('switch lanes')).toBeLessThan(firstObstacle - 30);
    expect(tip('jump')).toBeLessThan(firstAt('jump') - 25);
    expect(tip('slide')).toBeLessThan(firstAt('slide') - 25);
    expect(tip('totems')).toBeLessThan(totemAt - 25);
    // and each tip comes after the obstacle before it, so they don't pile up
    expect(tip('jump')).toBeGreaterThan(firstAt('hard'));
    expect(tip('slide')).toBeGreaterThan(firstAt('jump'));
  });
});
