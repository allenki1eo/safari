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
    const url = challengeUrl(run);
    expect(url.startsWith(`${LIVE_ORIGIN}/?`)).toBe(true);
    const params = new URL(url).searchParams;
    expect(params.get('day')).toBe('2026-10-04');
    expect(params.get('c')).toBe('12000');
    expect(params.get('m')).toBe('842');
    expect(params.get('s')).toBe('38');
    expect(params.get('n')).toBe('Allen');
    expect(params.get('from')).toBe('0');
    const href = whatsAppHref(run);
    expect(href.startsWith('https://wa.me/?text=')).toBe(true);
    expect(decodeURIComponent(href)).toContain(url);
    expect(shareText(run)).toContain('Lion clip');
    expect(shareText(run)).toContain('#4');
  });

  it('rebuilds the friend ghost from the link and hides it when the numbers are missing', () => {
    const params = new URL(challengeUrl(run)).searchParams;
    const link = parseShareLink(params);
    const today = routeForLink(link, '2026-10-04');
    expect(today.sameDay).toBe(true);
    expect(today.startRegion).toBe(0);
    expect(ghostFrom(today.friend, null)).toMatchObject({ source: 'friend', name: 'Allen', distance: 842, duration: 38 });

    const stale = routeForLink(link, '2026-10-05');
    expect(stale.sameDay).toBe(false);
    expect(stale.startRegion).toBeNull();
    expect(ghostFrom(stale.friend, { name: 'Juma', distance: 10, duration: 4 })).toMatchObject({ source: 'friend', name: 'Allen' });

    expect(ghostFrom(null, null)).toBeNull();
    expect(ghostFrom(null, { name: 'Juma', distance: 10, duration: 0 })).toBeNull();
    expect(ghostFrom({ name: '', distance: 10, duration: 4 }, null)).toBeNull();
    expect(ghostFrom(null, { name: 'Juma', distance: 90, duration: 30, runner: 'neema' })).toMatchObject({
      source: 'yesterday',
      name: 'Juma',
      runner: 'neema',
    });
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
