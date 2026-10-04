/**
 * The daily route. One calendar day in Dar es Salaam is one river, herd and
 * obstacle layout for everyone. Share links, the near-miss line and the ghost
 * all read from here so a friend who opens the link is racing the same trail.
 */
import { RUNNERS } from './content.js';

export const LIVE_ORIGIN = 'https://safari-blush.vercel.app';

const DAR = 'Africa/Dar_es_Salaam';
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** YYYY-MM-DD in Africa/Dar_es_Salaam. Midnight there is 21:00 UTC. */
export function darDay(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: DAR,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Midnight at the start of a Dar calendar day, as a UTC timestamp. */
function darMidnight(day) {
  const [y, m, d] = String(day).split('-').map(Number);
  return Date.UTC(y, m - 1, d) - 3 * HOUR;
}

/** Steps a Dar calendar day by `delta` days, including leap days. */
export function shiftDarDay(day, delta) {
  return darDay(new Date(darMidnight(day) + delta * DAY + HOUR));
}

export function seedFromDay(day) {
  let h = 2166136261;
  const s = String(day);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mixSeed(day, salt, z) {
  const zi = Math.round(Number(z) * 1000);
  let h = seedFromDay(day) ^ Math.imul((salt + 1) >>> 0, 0x9e3779b1) ^ Math.imul(zi, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return (h ^ (h >>> 16)) >>> 0;
}

/** A fresh rng for one salt and one distance, so layout does not depend on frame timing. */
export function rngAt(day, salt, z) {
  return mulberry32(mixSeed(day, salt, z));
}

export function chunkRng(day, z) {
  return rngAt(day, 1, z);
}

export function herdRng(day, wz) {
  return rngAt(day, 2, wz);
}

/** Cruise speed the course was designed for, from distance alone. */
export function cruiseSpeed(z) {
  return 15 + 21 * (1 - Math.exp(-Math.max(0, z) / 4200));
}

/** Difficulty handed to the pattern generator. It is the chunk distance, not who is faster. */
export function chunkDifficulty(z) {
  return z;
}

export function chunkGap(z) {
  const speed = cruiseSpeed(z);
  const diff = Math.min(1, Math.max(0, z) / 6000);
  return Math.max(12, speed * (1.15 + (0.62 - 1.15) * diff));
}

export function chunkPlan(day, z) {
  return {
    z,
    D: chunkDifficulty(z),
    speed: cruiseSpeed(z),
    rng: chunkRng(day, z),
    gap: chunkGap(z),
  };
}

export const NEAR_MISS = {
  lion: { kind: 'lion', line: 'Lion clip', shout: 'Karibu!' },
  wildebeest: { kind: 'wildebeest', line: 'Wildebeest filled the screen', shout: 'Kimbia!' },
  water: { kind: 'water', line: 'Last jump over the water', shout: 'Kimbia!' },
};

export function nearMissSpec(kind) {
  const spec = NEAR_MISS[kind];
  return spec ? { ...spec } : null;
}

export function lionClip({ kind, dx } = {}) {
  return kind === 'lion' && dx >= 1.15 && dx <= 2.75;
}

export function wildebeestFill({ kind, dz, dx } = {}) {
  return kind === 'wildebeest' && dz >= -0.5 && dz <= 3.2 && dx >= 1.15 && dx <= 2.7;
}

export function waterClear({ jumped, grounded, margin, wasOver } = {}) {
  if (!jumped || !grounded) return false;
  if (margin < 1.15) return true;
  return !!(wasOver && margin < 2.4);
}

function finite(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function parseShareLink(params) {
  if (!params || typeof params.get !== 'function') return null;
  const day = params.get('day') || null;
  const score = finite(params.get('c'));
  const distance = finite(params.get('m'));
  const duration = finite(params.get('s'));
  const name = String(params.get('n') || '').trim();
  const from = finite(params.get('from'));
  const runner = params.get('r') || null;
  if (!day && score == null && !name) return null;
  return {
    day,
    score,
    distance,
    duration,
    name,
    startRegion: from == null ? null : Math.floor(from),
    runner,
  };
}

/**
 * A same-day link locks the start region. A stale day keeps the friend as a
 * ghost and lets the player run today's trail from their own start.
 * Old links with a score and a name but no day still count as a challenge.
 */
export function routeForLink(link, today) {
  const empty = { sameDay: true, startRegion: null, friend: null, challenge: null };
  if (!link) return empty;
  const dated = !!link.day;
  const sameDay = !dated || link.day === today;
  const startRegion = dated && link.day === today && link.startRegion != null
    ? Math.max(0, link.startRegion)
    : null;
  const friend = link.name
    ? {
      name: link.name,
      score: link.score,
      distance: link.distance,
      duration: link.duration,
      runner: link.runner,
    }
    : null;
  const challenge = link.name && link.score != null
    ? { name: link.name, score: link.score, sameDay }
    : null;
  return { sameDay, startRegion, friend, challenge };
}

function realGhost(run, source) {
  if (!run) return null;
  const name = String(run.name || '').trim().slice(0, 16);
  const distance = Math.floor(Number(run.distance) || 0);
  const duration = Math.floor(Number(run.duration) || 0);
  if (!name || distance <= 0 || duration <= 0) return null;
  const runner = RUNNERS.some((r) => r.id === run.runner) ? run.runner : 'zuri';
  return { source, name, distance, duration, runner };
}

/** Friend link wins. Yesterday's best is the fallback. Missing numbers hide the ghost. */
export function ghostFrom(friend, yesterday) {
  return realGhost(friend, 'friend') || realGhost(yesterday, 'yesterday');
}

/** Metres along the ghost's own pace, capped where that run ended. */
export function ghostDistance(ghost, time) {
  if (!ghost) return null;
  const distance = Number(ghost.distance) || 0;
  const duration = Number(ghost.duration) || 0;
  if (distance <= 0 || duration <= 0) return null;
  const t = Math.max(0, Number(time) || 0);
  return Math.min(distance, (distance / duration) * t);
}

export function challengeUrl(run, origin = LIVE_ORIGIN) {
  const params = new URLSearchParams();
  if (run?.day) params.set('day', String(run.day));
  params.set('c', String(Math.max(0, Math.floor(Number(run?.score) || 0))));
  params.set('m', String(Math.max(0, Math.floor(Number(run?.distance) || 0))));
  params.set('s', String(Math.max(0, Math.floor(Number(run?.duration) || 0))));
  if (run?.name) params.set('n', String(run.name));
  params.set('from', String(Math.max(0, Math.floor(Number(run?.startRegion) || 0))));
  if (run?.runner) params.set('r', String(run.runner));
  return `${origin}/?${params.toString()}`;
}

export function shareText(run) {
  const distance = Math.max(0, Math.floor(Number(run?.distance) || 0)).toLocaleString();
  const rank = run?.rank ? ` #${run.rank}` : '';
  const miss = run?.nearMiss?.line
    ? `${run.nearMiss.line}${run.nearMiss.shout ? ` — ${run.nearMiss.shout}` : ''}`
    : 'Clean run';
  return `I ran ${distance}m${rank} on today's KIMBIA! route. ${miss} Can you beat it?`;
}

export function whatsAppHref(run) {
  const url = challengeUrl(run);
  return `https://wa.me/?text=${encodeURIComponent(`${shareText(run)} ${url}`)}`;
}
