import { describe, it, expect, beforeEach } from 'vitest';
import {
  save, ensureMissions, checkMissions, claimMissionSet, multiplier, claimDaily,
  collectMission, skipMission, skipCost, uncollected, missionSetReady,
} from '../app/data/save.js';

describe('progress & missions', () => {
  beforeEach(() => {
    save.missions = null;
    save.missionLevel = 0;
    save.seeds = 0;
    save.lastDaily = '';
    save.streak = 0;
  });

  it('starts new players with sensible defaults', () => {
    expect(save.runner).toBe('zuri');
    expect(save.charms).toBe(1);
    expect(save.regionMax).toBe(0);
  });

  it('completes a mission set and raises the multiplier', () => {
    const ms = ensureMissions();
    expect(ms).toHaveLength(3);
    const stats = Object.fromEntries(ms.map((m) => [m.stat, m.n]));
    expect(checkMissions(stats)).toHaveLength(3);
    // the set waits until every reward is collected
    expect(claimMissionSet()).toBe(false);
    expect(uncollected()).toHaveLength(3);
    for (const m of ms) expect(collectMission(m.id)).toBe(100);
    expect(collectMission(ms[0].id)).toBe(0); // only once
    expect(save.seeds).toBe(300);
    expect(claimMissionSet()).toBe(250);
    expect(multiplier()).toBe(2);
    expect(save.seeds).toBe(550);
    expect(ensureMissions().every((m) => !m.done && m.reward === 150)).toBe(true);
  });

  it('tracks the best run towards each mission', () => {
    const ms = ensureMissions();
    ms[0] = { ...ms[0], id: 'jumps', stat: 'jumps', n: 15, best: 0, done: false };
    const m = ms[0];
    checkMissions({ jumps: 7 });
    checkMissions({ jumps: 1 });
    expect(m.best).toBe(7);
    expect(m.done).toBe(false);
  });

  it('skips a stubborn mission for a fee, without paying its reward', () => {
    const ms = ensureMissions();
    const cost = skipCost(ms[0]);
    expect(cost).toBe(150);
    expect(skipMission(ms[0].id)).toBe(false); // can't afford
    save.seeds = 200;
    expect(skipMission(ms[0].id)).toBe(true);
    expect(save.seeds).toBe(50);
    expect(ms[0]).toMatchObject({ done: true, claimed: true, skipped: true });
    expect(skipMission(ms[0].id)).toBe(false); // already settled
    expect(collectMission(ms[0].id)).toBe(0);
    // finishing the other two settles the set
    checkMissions(Object.fromEntries(ms.slice(1).map((m) => [m.stat, m.n])));
    ms.slice(1).forEach((m) => collectMission(m.id));
    expect(missionSetReady()).toBe(true);
  });

  it('prices missions saved before rewards existed', () => {
    save.missions = ensureMissions().map(({ id, stat, n, text }, i) => ({ id, stat, n, text, done: i === 0 }));
    const ms = ensureMissions();
    expect(ms.every((m) => m.reward === 100 && m.claimed === false)).toBe(true);
    expect(ms[0].best).toBe(ms[0].n);
  });

  it('pays the daily reward once per day', () => {
    const first = claimDaily();
    expect(first).toMatchObject({ streak: 1, reward: 50 });
    expect(claimDaily()).toBeNull();
  });
});

describe('journey migration', () => {
  it('carries progress from the 8-region journey over by region', async () => {
    const { fromJourneyV1 } = await import('../app/data/save.js');
    const { REGIONS } = await import('../app/data/regions.js');
    const id = (i) => REGIONS[fromJourneyV1(i)].id;
    expect(id(0)).toBe('serengeti');
    expect(id(2)).toBe('kilimanjaro');
    expect(id(3)).toBe('selous');
    expect(id(4)).toBe('zanzibar');
    expect(id(7)).toBe('bwindi');
    expect(id(99)).toBe('bwindi');
  });
});

describe('moving progress', () => {
  it('exports the player and imports them elsewhere, keeping device settings', async () => {
    const { exportSave, importSave, hasProgress } = await import('../app/data/save.js');
    save.seeds = 777;
    save.name = 'Allen';
    save.quality = 'low';
    save.playerToken = 'a'.repeat(64);
    const out = exportSave();
    expect(out.quality).toBeUndefined();
    expect(out).toMatchObject({ seeds: 777, name: 'Allen', playerToken: 'a'.repeat(64) });
    // a fresh install elsewhere
    save.seeds = 0;
    save.name = '';
    save.quality = 'high';
    expect(importSave({ ...out, seeds: -5, quality: 'low' }, { restoredCode: 'ABCD2345' })).toBe(true);
    expect(save).toMatchObject({ name: 'Allen', playerToken: 'a'.repeat(64), quality: 'high', restoredCode: 'ABCD2345', seeds: 0 });
    expect(hasProgress()).toBe(true);
    expect(importSave(null)).toBe(false);
    expect(importSave([1, 2])).toBe(false);
  });
});
