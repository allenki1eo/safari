import { describe, it, expect } from 'vitest';
import { makeChunk } from '../app/game/patterns.js';
import { REGIONS } from '../app/data/regions.js';
import { HERD_STEP, herdCursor, planHerd } from '../app/game/layout.js';
import {
  LIVE_ORIGIN,
  challengeUrl,
  chunkPlan,
  darDay,
  ghostDistance,
  ghostFrom,
  lionClip,
  nearMissSpec,
  parseShareLink,
  routeForLink,
  seedFromDay,
  shareText,
  shiftDarDay,
  waterClear,
  whatsAppHref,
  wildebeestFill,
} from '../app/data/daily.js';

function course(day, region = REGIONS[0]) {
  let z = 45;
  const fingerprint = [];
  for (let i = 0; i < 24; i++) {
    const plan = chunkPlan(day, z);
    const chunk = makeChunk({
      z: plan.z,
      D: plan.D,
      speed: plan.speed,
      rng: plan.rng,
      region,
      wantTotem: false,
    });
    fingerprint.push([chunk.pat, chunk.len, chunk.ops.filter((op) => op[0] === 'obs').map((op) => [op[1], op[2], op[3]])]);
    z += chunk.len + plan.gap;
  }
  return fingerprint;
}

describe('Dar es Salaam day', () => {
  it('rolls the day at midnight in Dar, not UTC', () => {
    expect(darDay(new Date('2026-10-04T20:59:59Z'))).toBe('2026-10-04');
    expect(darDay(new Date('2026-10-04T21:00:00Z'))).toBe('2026-10-05');
    expect(shiftDarDay('2026-10-04', -1)).toBe('2026-10-03');
    expect(shiftDarDay('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftDarDay('2024-03-01', -1)).toBe('2024-02-29');
  });

  it('gives every player the same seed for a calendar day', () => {
    expect(seedFromDay('2026-10-04')).toBe(seedFromDay('2026-10-04'));
    expect(seedFromDay('2026-10-04')).not.toBe(seedFromDay('2026-10-05'));
  });
});

describe('daily route', () => {
  it('lays out the same obstacles, rivers and gaps for one day', () => {
    const day = '2026-10-04';
    expect(course(day)).toEqual(course(day));
    expect(course(day)).not.toEqual(course('2026-10-05'));
  });

  it('can place a river, a lion and a wildebeest on the shared course', () => {
    const seen = new Set();
    for (let n = 0; n < 12; n++) {
      const day = `2026-10-${String(n + 1).padStart(2, '0')}`;
      for (const step of course(day)) seen.add(step[0]);
    }
    expect(seen.has('river')).toBe(true);
    expect(seen.has('lion')).toBe(true);
    expect(seen.has('beast')).toBe(true);
  });

  it('puts the same herd on the same spot for everyone that day', () => {
    const region = REGIONS[0];
    const day = '2026-10-04';
    expect(herdCursor(0)).toBe(0);
    expect(herdCursor(1)).toBe(HERD_STEP);
    expect(herdCursor(HERD_STEP)).toBe(HERD_STEP);
    const here = planHerd(region, day, 88);
    expect(planHerd(region, day, 88)).toEqual(here);
    expect(planHerd(region, '2026-10-05', 88)).not.toEqual(here);
    expect(here.kind).toBeTruthy();
    expect(planHerd({ ...region, herd: [] }, day, 88)).toBeNull();
  });
});

describe('near-miss moments', () => {
  it('names a lion clip, a screen-filling wildebeest and a last jump, each with a Swahili shout', () => {
    expect(lionClip({ kind: 'lion', dx: 1.8 })).toBe(true);
    expect(lionClip({ kind: 'lion', dx: 0.4 })).toBe(false);
    expect(lionClip({ kind: 'rhino', dx: 1.8 })).toBe(false);
    expect(wildebeestFill({ kind: 'wildebeest', dz: 1.2, dx: 2.1 })).toBe(true);
    expect(wildebeestFill({ kind: 'wildebeest', dz: 12, dx: 2.1 })).toBe(false);
    expect(waterClear({ jumped: true, grounded: true, margin: 0.4 })).toBe(true);
    expect(waterClear({ jumped: true, grounded: true, margin: 1.8, wasOver: true })).toBe(true);
    expect(waterClear({ jumped: true, grounded: true, margin: 6 })).toBe(false);
    expect(waterClear({ jumped: false, grounded: true, margin: 0.2 })).toBe(false);

    expect(nearMissSpec('lion')).toMatchObject({ line: 'Lion clip', shout: 'Karibu!' });
    expect(nearMissSpec('wildebeest')).toMatchObject({ line: 'Wildebeest filled the screen', shout: 'Kimbia!' });
    expect(nearMissSpec('water').shout).toBe('Kimbia!');
    expect(nearMissSpec('truck')).toBeNull();
  });
});

describe('share link', () => {
  const run = {
    day: '2026-10-04',
    score: 12000,
    distance: 842,
    duration: 38,
    name: 'Allen',
    startRegion: 0,
    runner: 'zuri',
    rank: 4,
    nearMiss: { line: 'Lion clip', shout: 'Karibu!' },
  };

  it('opens WhatsApp with a link to the live site and that same route', () => {
    const url = challengeUrl({ ...run, route: 'r9x8y7', challengeId: 'abcd2345' });
    expect(url.startsWith(`${LIVE_ORIGIN}/?`)).toBe(true);
    const params = new URL(url).searchParams;
    expect(params.get('ch')).toBe('abcd2345');
    expect(params.get('rt')).toBe('r9x8y7');
    expect(params.get('c')).toBe('12000');
    expect(params.get('m')).toBe('842');
    expect(params.get('s')).toBe('38');
    expect(params.get('n')).toBe('Allen');
    expect(params.get('from')).toBe('0');
    const href = whatsAppHref(run);
    expect(href.startsWith('https://wa.me/?text=')).toBe(true);
    expect(decodeURIComponent(href)).toContain(challengeUrl(run));
    expect(shareText(run)).toContain('Lion clip');
    expect(shareText(run)).toContain('#4');
    expect(shareText({ ...run, stake: 200 })).toContain('200 coins');
  });

  it('a challenge link carries the route, the start and the friend for the shadow runner', () => {
    const link = parseShareLink(new URL(challengeUrl({ ...run, route: 'r9x8y7', challengeId: 'abcd2345' })).searchParams);
    const r = routeForLink(link);
    expect(r).toMatchObject({ id: 'abcd2345', route: 'r9x8y7', startRegion: 0, challenge: { name: 'Allen', score: 12000 } });
    expect(ghostFrom(r.friend)).toMatchObject({ source: 'friend', name: 'Allen', distance: 842, duration: 38, track: null });
    // older links were dealt from a calendar day, which still reproduces their route
    const old = routeForLink(parseShareLink(new URLSearchParams('day=2026-10-04&c=5&n=Juma&m=10&s=4')));
    expect(old.route).toBe('2026-10-04');
    // junk is ignored rather than trusted
    const junk = parseShareLink(new URLSearchParams('ch=DROP;&rt=<x>&n=Zuri&c=1'));
    expect(junk.id).toBeNull();
    expect(junk.route).toBeNull();
    // no challenge, no shadow runner
    expect(routeForLink(null).friend).toBeNull();
    expect(ghostFrom(null)).toBeNull();
    expect(ghostFrom({ name: '', distance: 10, duration: 4 })).toBeNull();
    expect(ghostFrom({ name: 'Juma', distance: 10, duration: 0 })).toBeNull();
    expect(ghostFrom({ name: 'Juma', distance: 0, duration: 0, track: 'AAAA' })).toMatchObject({ track: 'AAAA' });
  });

  it('places the ghost on their real pace and stops them where that run ended', () => {
    const ghost = { distance: 100, duration: 10 };
    expect(ghostDistance(ghost, 0)).toBe(0);
    expect(ghostDistance(ghost, 5)).toBe(50);
    expect(ghostDistance(ghost, 40)).toBe(100);
    expect(ghostDistance(null, 5)).toBeNull();
    expect(ghostDistance({ distance: 100, duration: 0 }, 5)).toBeNull();
  });
});

describe('word hunt', () => {
  it('deals every word once per round, the same for everyone on a day', async () => {
    const { HUNT_WORDS } = await import('../app/data/content.js');
    const { huntWord } = await import('../app/data/daily.js');
    const day = '2026-10-04';
    const round = HUNT_WORDS.map((_, i) => huntWord(HUNT_WORDS, day, i).word);
    expect(new Set(round).size).toBe(HUNT_WORDS.length);
    expect(huntWord(HUNT_WORDS, day, HUNT_WORDS.length)).toEqual(huntWord(HUNT_WORDS, day, 0));
    expect(huntWord(HUNT_WORDS, day, 3)).toEqual(huntWord(HUNT_WORDS, day, 3));
    const other = HUNT_WORDS.map((_, i) => huntWord(HUNT_WORDS, '2026-10-05', i).word);
    expect(other).not.toEqual(round);
  });

  it('only uses letters the trail tokens can show', async () => {
    const { HUNT_WORDS } = await import('../app/data/content.js');
    for (const { word, line } of HUNT_WORDS) {
      expect(word).toMatch(/^[A-Z]{4,11}$/);
      expect(line.length).toBeGreaterThan(5);
    }
    expect(HUNT_WORDS.map((w) => w.word)).toEqual(expect.arrayContaining(['NGORONGORO', 'SERENGETI', 'TANZANIA', 'RUAHA']));
  });
});

describe('herd behaviour', () => {
  it('mixes modes for plains animals but keeps them deterministic per day', async () => {
    const { ROAMERS, nextMode } = await import('../app/game/layout.js');
    const region = REGIONS[0];
    const modes = new Set();
    for (let wz = 0; wz < 4000; wz += HERD_STEP) {
      const h = planHerd(region, '2026-10-04', wz);
      if (ROAMERS.has(h.kind)) modes.add(h.mode);
    }
    expect([...modes].sort()).toEqual(['idle', 'run', 'walk']);
    for (const m of ['idle', 'walk', 'run']) for (const r of [0, 0.3, 0.6, 0.95]) expect(['idle', 'walk', 'run']).toContain(nextMode(m, r));
  });
});
