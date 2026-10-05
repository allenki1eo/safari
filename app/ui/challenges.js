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

export async function fetchChallenge(id) {
  return (await call('GET', null, `?id=${encodeURIComponent(id)}`)).challenge;
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
export async function finishBet(id, score) {
  const data = await call('POST', { action: 'finish', token: playerToken(), id, score });
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
