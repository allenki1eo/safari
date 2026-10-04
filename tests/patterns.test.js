import { describe, it, expect } from 'vitest';
import { makeChunk, tutorialChunk, KINDS, TRUCK_LEN } from '../app/game/patterns.js';
import { REGIONS } from '../app/data/regions.js';

// small deterministic PRNG so failures are reproducible
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hard (lane-switch only) intervals per lane, ignoring moving hazards and ramped truck trains. */
function hardIntervals(ops) {
  const lanes = [[], [], []];
  const obs = ops.filter((o) => o[0] === 'obs');
  for (const [, kind, lane, wz, opts] of obs) {
    const k = KINDS[kind];
    if (k.pass !== 'hard' || opts.moving || opts.cross) continue;
    if (kind === 'truck') {
      // a truck you can reach from a ramp (directly or via the truck in front) is a walkway
      let front = wz - TRUCK_LEN / 2;
      let reachable = false;
      for (let guard = 0; guard < 6 && !reachable; guard++) {
        const ramp = obs.find((o) => o[1] === 'ramp' && o[2] === lane && Math.abs(o[3] + KINDS.ramp.len / 2 - front) < 0.01);
        if (ramp) reachable = true;
        const prev = obs.find((o) => o[1] === 'truck' && o[2] === lane && !o[4].moving && Math.abs(o[3] + TRUCK_LEN / 2 - front) < 0.01);
        if (!prev) break;
        front = prev[3] - TRUCK_LEN / 2;
      }
      if (reachable) continue;
    }
    lanes[lane].push([wz - k.len / 2, wz + k.len / 2]);
  }
  return lanes;
}

function fullyBlocked(ops) {
  const lanes = hardIntervals(ops);
  const cuts = [...new Set(lanes.flat().flat())].sort((a, b) => a - b);
  for (let i = 0; i < cuts.length - 1; i++) {
    const mid = (cuts[i] + cuts[i + 1]) / 2;
    if (lanes.every((iv) => iv.some(([a, b]) => mid > a && mid < b))) return mid;
  }
  return null;
}

describe('obstacle patterns', () => {
  it('fairness check catches a wall of boulders', () => {
    const wall = [0, 1, 2].map((l) => ['obs', 'boulder', l, 50, {}]);
    expect(fullyBlocked(wall)).not.toBeNull();
    const ramped = [['obs', 'ramp', 0, 47.5, {}], ['obs', 'truck', 0, 53.5, {}], ['obs', 'boulder', 1, 52, {}], ['obs', 'boulder', 2, 52, {}]];
    expect(fullyBlocked(ramped)).toBeNull();
  });

  const distances = [60, 400, 1200, 4000, 9000];

  for (const region of REGIONS) {
    it(`always leaves a way through in ${region.name}`, () => {
      const rng = mulberry32(region.id.length * 9973);
      for (const D of distances) {
        const speed = 15 + 21 * (1 - Math.exp(-D / 4200));
        for (let n = 0; n < 400; n++) {
          const chunk = makeChunk({ z: D + 100, D, speed, region, wantTotem: n % 7 === 0, rng });
          expect(chunk.len).toBeGreaterThan(0);
          const blocked = fullyBlocked(chunk.ops);
          if (blocked !== null) throw new Error(`${region.id} pattern "${chunk.pat}" blocks all lanes at ${blocked.toFixed(1)}`);
        }
      }
    });
  }

  it('only uses obstacle kinds with collision profiles', () => {
    const rng = mulberry32(42);
    for (const region of REGIONS) {
      for (let n = 0; n < 300; n++) {
        const { ops } = makeChunk({ z: 500, D: 2000, speed: 28, region, rng });
        for (const op of ops) if (op[0] === 'obs') expect(KINDS[op[1]], op[1]).toBeDefined();
      }
    }
  });

  it('never drops an ally totem inside a solid obstacle', () => {
    const rng = mulberry32(7);
    for (const region of REGIONS) {
      for (let n = 0; n < 300; n++) {
        const { ops } = makeChunk({ z: 500, D: 2000, speed: 28, region, wantTotem: true, rng });
        const lanes = hardIntervals(ops);
        for (const op of ops.filter((o) => o[0] === 'totem')) {
          const [, , lane, wz] = op;
          expect(lanes[lane].some(([a, b]) => wz > a - 1.5 && wz < b + 1.5)).toBe(false);
        }
      }
    }
  });

  it('puts prize boxes on open ground or on top of a truck, never inside an obstacle', () => {
    const rng = mulberry32(11);
    let seen = 0;
    for (const region of REGIONS) {
      for (let n = 0; n < 300; n++) {
        const { ops } = makeChunk({ z: 500, D: 2000, speed: 28, region, wantBox: true, rng });
        const lanes = hardIntervals(ops);
        const trucks = ops.filter((o) => o[0] === 'obs' && o[1] === 'truck');
        for (const [, lane, wz, y] of ops.filter((o) => o[0] === 'box')) {
          seen++;
          if (y > 0) {
            expect(trucks.some((t) => t[2] === lane && Math.abs(t[3] - wz) < KINDS.truck.len / 2)).toBe(true);
          } else {
            expect(lanes[lane].some(([a, b]) => wz > a - 1.5 && wz < b + 1.5)).toBe(false);
          }
        }
      }
    }
    expect(seen).toBeGreaterThan(100);
  });

  it('only spawns region specials where they belong', () => {
    const rng = mulberry32(3);
    const zanzibar = REGIONS.find((r) => r.id === 'zanzibar');
    for (let n = 0; n < 500; n++) {
      const { ops } = makeChunk({ z: 500, D: 2000, speed: 28, region: zanzibar, rng });
      for (const op of ops) if (op[0] === 'obs') expect(['truck', 'ramp', 'rhino', 'boulder', 'mound']).not.toContain(op[1]);
    }
  });

  it('runs a finite scripted tutorial', () => {
    let i = 0;
    while (tutorialChunk(i, 0)) i++;
    expect(i).toBe(5);
  });
});

describe('the Zanzibar coast', () => {
  it('has no big game, but coconuts, scooters and the market', () => {
    const region = REGIONS.find((r) => r.id === 'zanzibar');
    const rng = mulberry32(7);
    const kinds = new Set();
    for (let n = 0; n < 1500; n++) {
      const { ops } = makeChunk({ z: 600, D: 2000, speed: 28, region, rng });
      for (const op of ops) if (op[0] === 'obs') kinds.add(op[1]);
    }
    for (const wild of ['lion', 'wildebeest', 'rhino', 'buffalo', 'crossing', 'truck']) expect(kinds.has(wild), wild).toBe(false);
    for (const coast of ['coconut', 'scooter', 'cart']) expect(kinds.has(coast), coast).toBe(true);
  });
});
