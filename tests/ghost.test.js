import { describe, it, expect } from 'vitest';
import { GhostRecorder, GhostTrack, GHOST_HZ, decodeBytes, encodeBytes, validTrack } from '../app/game/ghostTrack.js';
import { makeChunk, KINDS } from '../app/game/patterns.js';
import { REGIONS } from '../app/data/regions.js';
import { mulberry32, newRoute, ROUTE_RE, chunkPlan } from '../app/data/daily.js';

describe('shadow runner recording', () => {
  it('packs bytes losslessly', () => {
    for (const n of [0, 1, 2, 3, 4, 5, 255]) {
      const bytes = Array.from({ length: n }, (_, i) => (i * 37 + 11) & 255);
      expect(decodeBytes(encodeBytes(bytes))).toEqual(bytes);
    }
    expect(decodeBytes('no*way')).toBeNull();
  });

  it('replays where the runner was and what they were doing', () => {
    const r = new GhostRecorder();
    // run 15 m/s, change lanes at 1 s, jump at 2 s, slide at 3 s
    for (let t = 0; t <= 4; t += 1 / 60) {
      const x = t < 1 ? -2.5 : t < 1.2 ? -2.5 + (t - 1) * 12.5 : 0;
      const y = t > 2 && t < 2.5 ? 1.5 : 0;
      const pose = t > 2 && t < 2.5 ? 'jump' : t > 3 && t < 3.6 ? 'slide' : 'run';
      r.sample(t, t * 15, x, y, pose);
    }
    expect(r.length).toBeGreaterThanOrEqual(4 * GHOST_HZ);
    const str = r.encode();
    expect(validTrack(str)).toBe(true);
    const g = new GhostTrack(str);
    expect(g.at(0.5).x).toBeCloseTo(-2.5, 1);
    expect(g.at(1.5).x).toBeCloseTo(0, 1);
    expect(g.at(2.25)).toMatchObject({ pose: 'jump' });
    expect(g.at(2.25).y).toBeCloseTo(1.5, 1);
    expect(g.at(3.3).pose).toBe('slide');
    expect(g.at(3).distance).toBeCloseTo(45, 0);
    expect(g.at(99).done).toBe(true);
  });

  it('rejects junk recordings', () => {
    expect(validTrack('')).toBe(false);
    expect(validTrack('AAA')).toBe(false); // not whole samples
    expect(validTrack(42)).toBe(false);
  });
});

describe('routes', () => {
  it('deals a fresh route key every run, and a key replays the same layout', () => {
    const a = newRoute();
    const b = newRoute();
    expect(a).toMatch(ROUTE_RE);
    expect(a).not.toBe(b);
    const lay = (route) => makeChunk({ ...chunkPlan(route, 600), region: REGIONS[0] }).ops.map((o) => o.slice(0, 4).join()).join('|');
    expect(lay(a)).toBe(lay(a));
  });
});

describe('the Great Ruaha', () => {
  it('every lane is a crossing of jumpable gaps between logs and stones', () => {
    const ruaha = REGIONS.find((r) => r.id === 'ruaha');
    let found = 0;
    for (let seed = 1; seed < 400 && found < 12; seed++) {
      for (const speed of [16, 24, 32]) {
        const c = makeChunk({ z: 1000, D: 2000, speed, region: ruaha, rng: mulberry32(seed * 7 + speed) });
        if (c.pat !== 'greatRiver') continue;
        found++;
        const span = c.ops.find((o) => o[1] === 'span');
        expect(span).toBeTruthy();
        for (const lane of [0, 1, 2]) {
          const gaps = c.ops.filter((o) => o[0] === 'obs' && o[1] === 'water' && o[2] === lane).map((o) => o[4].len);
          expect(gaps.length).toBeGreaterThan(2);
          for (const g of gaps) expect(g).toBeLessThanOrEqual(3.0 + 1e-9);
          const rafts = span[4].rafts.filter((r) => r.lane === lane);
          for (const r of rafts) expect(r.to - r.from).toBeGreaterThan(Math.max(8, speed * 0.62) * 0.5);
        }
        // hippos only stand where a neighbouring lane has somewhere to go
        for (const h of c.ops.filter((o) => o[1] === 'hippo')) expect(h[4]).toEqual({});
      }
    }
    expect(found).toBeGreaterThan(3);
    expect(KINDS.water.len).toBeLessThan(4);
  });
});
