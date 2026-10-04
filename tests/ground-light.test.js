import { describe, it, expect } from 'vitest';
import { GROUND_LIFT, GROUND_LIGHT } from '../app/game/materials.js';
import { REGIONS } from '../app/data/regions.js';

describe('running lanes stay lit', () => {
  it('holds a share of the ground colour above Lambert and the night sun', () => {
    expect(GROUND_LIFT).toBeGreaterThanOrEqual(1);
    expect(GROUND_LIGHT.fragmentLight).toContain('uGroundLift');
    expect(GROUND_LIGHT.fragmentLight).toContain('groundFloor');
    expect(GROUND_LIGHT.uniforms.uGroundLift.value).toBe(GROUND_LIFT);
  });

  it('uses that one floor for every region, morning through night', () => {
    expect(REGIONS.map((r) => r.id)).toEqual([
      'serengeti', 'ngorongoro', 'kilimanjaro', 'selous', 'zanzibar', 'mara', 'amboseli', 'bwindi',
    ]);
    for (const r of REGIONS) {
      expect(r.ground.grass, r.id).toMatch(/^#[0-9a-f]{6}$/i);
      expect(r.ground.path, r.id).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
