import { describe, it, expect } from 'vitest';
import { REGIONS, COUNTRIES, PROP_TYPES, HERD_TYPES, JOURNEY_LEN, regionIndexAt } from '../app/data/regions.js';
import { KINDS } from '../app/game/patterns.js';

describe('journey regions', () => {
  it('has unique ids and known countries', () => {
    expect(new Set(REGIONS.map((r) => r.id)).size).toBe(REGIONS.length);
    for (const r of REGIONS) expect(COUNTRIES[r.country], r.id).toBeDefined();
  });

  it('visits Tanzania, then Kenya, Uganda, Congo and Rwanda', () => {
    const order = [...new Set(REGIONS.map((r) => r.country))];
    expect(order).toEqual(['tz', 'ke', 'ug', 'cd', 'rw']);
  });

  it('only ever adds regions at the end, so saved indexes and journey distances hold', () => {
    // saves, challenge links and the leaderboard store region indexes; routes are keyed by distance
    const first = ['serengeti', 'ngorongoro', 'manyara', 'tarangire', 'kilimanjaro', 'ruaha', 'selous', 'zanzibar', 'mara', 'amboseli', 'bwindi'];
    expect(REGIONS.slice(0, first.length).map((r) => r.id)).toEqual(first);
    expect(REGIONS.find((r) => r.id === 'bwindi').at).toBe(7900);
  });

  it('only references props, animals and blockers the game can build', () => {
    for (const r of REGIONS) {
      for (const [p] of r.props) expect(PROP_TYPES, `${r.id}:${p}`).toContain(p);
      for (const [h] of r.herd) expect(HERD_TYPES, `${r.id}:${h}`).toContain(h);
      for (const b of r.blocks) expect(KINDS[b]?.pass, `${r.id}:${b}`).toBe('hard');
      expect(r.line.length).toBeGreaterThan(10);
    }
  });

  it('maps distances to regions and loops into a legend lap', () => {
    expect(regionIndexAt(0).index).toBe(0);
    expect(regionIndexAt(REGIONS[3].at + 1).index).toBe(3);
    const lap = regionIndexAt(JOURNEY_LEN + 5);
    expect(lap).toMatchObject({ index: 0, lap: 1 });
  });
});
