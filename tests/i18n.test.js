import { describe, it, expect } from 'vitest';
import { t, missionText, KISWAHILI } from '../app/i18n.js';
import { RUNNERS, OUTFITS, ALLIES, INTRO, TUTORIAL, MISSION_POOL, HUNT_WORDS, BOOSTS } from '../app/data/content.js';
import { REGIONS } from '../app/data/regions.js';

describe('languages', () => {
  it('speaks English by default and fills placeholders', () => {
    expect(t('Runners')).toBe('Runners');
    expect(t('Best {n}', { n: '5,400' })).toBe('Best 5,400');
    expect(t('a string nobody translated')).toBe('a string nobody translated');
  });

  it('rebuilds saved missions from their definitions', () => {
    expect(missionText({ id: 'jumps', n: 30, text: 'old text' })).toBe('Jump 30 times in one run');
    expect(missionText({ id: 'gone', n: 1, text: 'kept as saved' })).toBe('kept as saved');
  });

  it('has Kiswahili for every region, ally, runner, outfit, mission, word and powerup', () => {
    for (const r of REGIONS) {
      const sw = KISWAHILI.regions[r.id];
      expect(sw, r.id).toBeDefined();
      for (const k of ['title', 'line', 'blurb']) expect(sw[k], `${r.id}.${k}`).toBeTruthy();
    }
    for (const id of Object.keys(ALLIES)) expect(KISWAHILI.allies[id]?.lines?.length, id).toBe(ALLIES[id].lines.length);
    for (const r of RUNNERS) expect(KISWAHILI.runners[r.id]?.bio, r.id).toBeTruthy();
    for (const o of OUTFITS) expect(KISWAHILI.outfits[o.id]?.line, o.id).toBeTruthy();
    for (const m of MISSION_POOL) expect(KISWAHILI.missions[m.id], m.id).toContain('{n}');
    for (const w of HUNT_WORDS) expect(KISWAHILI.hunt[w.word], w.word).toBeTruthy();
    for (const id of Object.keys(BOOSTS)) expect(KISWAHILI.boosts[id]?.intro, id).toBeTruthy();
    expect(KISWAHILI.intro).toHaveLength(INTRO.length);
    expect(KISWAHILI.tutorial).toHaveLength(TUTORIAL.length);
  });
});
