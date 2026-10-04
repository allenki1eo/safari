import { describe, it, expect, beforeEach } from 'vitest';
import { save, ensureMissions, checkMissions, claimMissionSet, multiplier, claimDaily } from '../app/data/save.js';

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
    expect(claimMissionSet()).toBe(true);
    expect(multiplier()).toBe(2);
    expect(save.seeds).toBe(250);
    expect(ensureMissions().every((m) => !m.done)).toBe(true);
  });

  it('pays the daily reward once per day', () => {
    const first = claimDaily();
    expect(first).toMatchObject({ streak: 1, reward: 50 });
    expect(claimDaily()).toBeNull();
  });
});
