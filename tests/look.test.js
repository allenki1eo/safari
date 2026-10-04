import { describe, it, expect } from 'vitest';
import { OUTFITS, outfitId } from '../app/data/content.js';
import { save } from '../app/data/save.js';
import { REGIONS } from '../app/data/regions.js';
import { daylightAt } from '../app/game/world.js';
import { GROUND_LIFT } from '../app/game/materials.js';

describe('wearable outfits', () => {
  it('offers distinct garments and falls back to the running kit', () => {
    const ids = OUTFITS.map((o) => o.id);
    expect(ids).toEqual(['kit', 'jersey', 'kanga', 'vest', 'journey']);
    expect(new Set(OUTFITS.map((o) => o.line)).size).toBe(ids.length);
    expect(outfitId('kanga')).toBe('kanga');
    expect(outfitId('no-such-skin')).toBe('kit');
    expect(save.outfit).toBe('kit');
  });
});

describe('Zanzibar stays a bright coast', () => {
  const zanzibar = REGIONS.find((r) => r.id === 'zanzibar');
  const bwindi = REGIONS.find((r) => r.id === 'bwindi');
  const serengeti = REGIONS.find((r) => r.id === 'serengeti');
  const selous = REGIONS.find((r) => r.id === 'selous');

  it('keeps only a light haze on the island, and mist in the forest', () => {
    expect(zanzibar.fog.amount).toBeLessThanOrEqual(0.12);
    expect(zanzibar.fog.near).toBeGreaterThanOrEqual(110);
    expect(zanzibar.fog.far).toBeGreaterThanOrEqual(320);
    expect(bwindi.fog.amount).toBeGreaterThan(0.4);
    expect(serengeti.fog).toBeNull();
    expect(GROUND_LIFT).toBeGreaterThanOrEqual(1);
  });

  it('opens a new run on a Serengeti morning and a Zanzibar run in daylight', () => {
    const morning = daylightAt(0);
    expect(morning.night).toBe(0);
    expect(morning.sunH).toBeGreaterThan(0.3);
    const coast = daylightAt(zanzibar.at + 20);
    expect(coast.night).toBeLessThan(0.05);
    expect(coast.sunH).toBeGreaterThan(0.6);
    const river = daylightAt(selous.at + selous.len * 0.5);
    expect(river.night).toBeGreaterThan(0.8);
  });
});
