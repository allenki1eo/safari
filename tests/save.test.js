import { describe, it, expect, beforeEach } from 'vitest';
import {
  save, ensureMissions, checkMissions, claimMissionSet, multiplier, claimDaily, dailyDue,
  collectMission, skipMission, skipCost, uncollected, missionSetReady,
} from '../app/data/save.js';

describe('progress & missions', () => {
  beforeEach(() => {
    save.missions = null;
    save.missionLevel = 0;
    save.seeds = 0;
    save.lastDaily = '';
    save.dailyDay = '';
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

  const at = (iso) => new Date(iso);

  it('resets the daily reward at midnight in Dar es Salaam, not UTC', () => {
    // 20:30 UTC = 23:30 in Dar on 9 Oct
    expect(claimDaily(at('2026-10-09T20:30:00Z'))).toMatchObject({ streak: 1 });
    expect(save.dailyDay).toBe('2026-10-09');
    expect(dailyDue(at('2026-10-09T20:59:00Z'))).toBe(false);
    // 21:00 UTC = midnight in Dar: a new day, the streak carries on
    expect(dailyDue(at('2026-10-09T21:00:00Z'))).toBe(true);
    expect(claimDaily(at('2026-10-09T21:00:00Z'))).toMatchObject({ streak: 2, reward: 100 });
    expect(claimDaily(at('2026-10-10T20:59:00Z'))).toBeNull();
    // missing a whole Dar day starts the streak over
    expect(claimDaily(at('2026-10-11T21:30:00Z'))).toMatchObject({ streak: 1 });
  });

  it('builds to the day-7 bonus on Dar days', () => {
    for (let d = 1; d <= 7; d++) {
      const r = claimDaily(at(`2026-10-${String(d).padStart(2, '0')}T22:00:00Z`)); // 01:00 in Dar
      expect(r.streak).toBe(d);
      if (d === 7) expect(r.reward).toBe(850);
    }
  });

  describe('saves from the UTC-midnight days', () => {
    beforeEach(() => {
      save.lastDaily = '2026-10-09';
      save.streak = 3;
    });

    it('does not pay twice on the switchover before the UTC day ends', () => {
      // already 00:30 on the 10th in Dar, but still the 9th in UTC: the old claim covers it
      expect(dailyDue(at('2026-10-09T21:30:00Z'))).toBe(false);
      expect(claimDaily(at('2026-10-09T21:30:00Z'))).toBeNull();
      expect(claimDaily(at('2026-10-09T10:00:00Z'))).toBeNull();
    });

    it('pays the next Dar day and keeps the streak', () => {
      const r = claimDaily(at('2026-10-10T06:00:00Z'));
      expect(r).toMatchObject({ streak: 4, reward: 200 });
      expect(save.dailyDay).toBe('2026-10-10');
      expect(claimDaily(at('2026-10-10T20:00:00Z'))).toBeNull();
      expect(claimDaily(at('2026-10-10T21:05:00Z'))).toMatchObject({ streak: 5 });
    });

    it('keeps the streak for a claim made just after midnight in Dar', () => {
      // a 22:00 UTC claim on the 9th was already the 10th in Dar; coming back on the 11th is consecutive
      expect(claimDaily(at('2026-10-11T08:00:00Z'))).toMatchObject({ streak: 4 });
    });

    it('starts over after a real gap', () => {
      expect(claimDaily(at('2026-10-12T08:00:00Z'))).toMatchObject({ streak: 1 });
    });
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
