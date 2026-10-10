/**
 * Talks to /api/challenges: posting a finished run as a challenge (optionally with a coin
 * bet), opening a friend's challenge, taking their bet, reporting the result, and collecting
 * what your own bets earned. Coins move on this device only after the server agrees.
 */
import { save, persist } from '../data/save.js';
import { LIVE_ORIGIN } from '../data/daily.js';
import { playerToken } from './leaderboard.js';

/** Bet sizes offered on the challenge sheet. */
export const STAKES = [0, 50, 100, 250, 500, 1000];

async function call(method, body, query = '') {
  const res = await fetch(`/api/challenges${query}`, {
    method,
    headers: { accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    /* empty */
  }
  if (!res.ok) throw Object.assign(new Error(data.error || 'The challenge server is unavailable.'), { status: res.status, code: data.code });
  return data;
}

/** Links point at the site they were made on (a preview stays a preview), else the live game. */
export function linkOrigin() {
  const { protocol, hostname, origin } = location;
  return protocol === 'https:' && hostname !== 'localhost' ? origin : LIVE_ORIGIN;
}

/** Posts the run; with a stake, the coins leave the bank once the server has the bet. */
export async function createChallenge(run, stake, name) {
  const data = await call('POST', {
    action: 'create',
    token: playerToken(),
    name,
    runner: run.runner,
    score: run.score,
    distance: run.distance,
    duration: run.duration,
    seeds: run.seeds ?? 0,
    mult: run.mult ?? undefined,
    startRegion: run.startRegion ?? 0,
    route: run.route,
    track: run.track ?? '',
    stake,
  });
  if (stake > 0) {
    save.seeds = Math.max(0, save.seeds - stake);
    save.betsOut = [...new Set([...(save.betsOut ?? []), data.id])];
    persist();
  }
  return data;
}

/** A friend's challenge, plus `done`: whether you're already finished with it (any device). */
export async function fetchChallenge(id) {
  return (await call('POST', { action: 'view', token: playerToken(), id })).challenge;
}

/* ------------------------------------------- challenges you're finished with */
const DONE_MAX = 60;
/** The URL parameters a challenge link carries. */
export const CHALLENGE_PARAMS = ['ch', 'c', 'm', 's', 'n', 'from', 'r', 'rt', 'day'];

/** A stable key for a challenge link: its server id, or (older links) its numbers. */
export function challengeKey(id, link) {
  if (id) return `ch:${id}`;
  if (!link) return null;
  return `ln:${link.name ?? ''}|${link.score ?? ''}|${link.route ?? link.day ?? ''}`;
}

export const isChallengeDone = (key) => !!key && (save.challengesDone ?? []).includes(key);

/** Remembers on this device that a challenge was played, declined or ran out. */
export function rememberChallengeDone(key) {
  if (!key || isChallengeDone(key)) return;
  save.challengesDone = [...(save.challengesDone ?? []), key].slice(-DONE_MAX);
  persist();
}

/** Tells the server too, so the challenge stays gone on your other devices. Quiet on failure. */
export async function markChallengeDone(id, reason = 'played') {
  if (!id) return false;
  try {
    await call('POST', { action: 'done', token: playerToken(), id, reason });
    return true;
  } catch {
    return false;
  }
}

/** The page's query string without the challenge link in it (so a reload doesn't bring it back). */
export function withoutChallenge(search) {
  const params = new URLSearchParams(search);
  for (const k of CHALLENGE_PARAMS) params.delete(k);
  const rest = params.toString();
  return rest ? `?${rest}` : '';
}

/** Takes a friend's bet: the matching stake leaves the bank when the server confirms. */
export async function acceptBet(id, name) {
  const data = await call('POST', { action: 'accept', token: playerToken(), id, name });
  if (!data.again) {
    save.seeds = Math.max(0, save.seeds - data.stake);
    persist();
  }
  return data;
}

/** Reports the run against the bet; a win pays the whole pot into the bank. */
export async function finishBet(id, run) {
  const data = await call('POST', {
    action: 'finish', token: playerToken(), id,
    score: run.score, distance: run.distance ?? 0, duration: run.duration ?? 0, seeds: run.seeds ?? 0, mult: run.mult ?? undefined,
  });
  if (data.winner === 'rival') {
    save.seeds += data.pot;
    persist();
  }
  return data;
}

/** Collects winnings and refunds from your own challenges. Quiet when you have none out. */
export async function collectBets() {
  if (!save.betsOut?.length) return [];
  const { payouts } = await call('POST', { action: 'collect', token: playerToken() });
  if (!payouts.length) return [];
  for (const p of payouts) save.seeds += p.amount;
  const paid = new Set(payouts.map((p) => p.id));
  save.betsOut = save.betsOut.filter((id) => !paid.has(id));
  persist();
  return payouts;
}
