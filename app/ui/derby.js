/**
 * Kariakoo Derby Special, from the player's side: the live tug of war, and picking a side (which hands over
 * that side's limited kit for good). The server keeps the side and the totals (server/derby.js).
 */
import { DERBY, derbyLive } from '../data/content.js';
import { save, persist } from '../data/save.js';
import { playerToken } from './leaderboard.js';

export async function fetchDerby() {
  const res = await fetch('/api/scores?board=derby', { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error('The derby score is unavailable.');
  return res.json();
}

/** Joins a side: the kit goes on straight away; the server keeps the first side a runner picks. */
export async function joinSide(side) {
  if (!DERBY.sides[side] || !derbyLive()) return null;
  save.side = side;
  save.outfit = `derby-${side}`;
  persist();
  try {
    const res = await fetch('/api/scores', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ action: 'side', token: playerToken(), side }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.side && data.side !== side) adoptSide(data.side); // picked on another phone first
  } catch {
    /* the side also rides along with the next saved run */
  }
  return save.side;
}

/** The server says this runner is on `side` (their first pick, maybe on another phone). */
export function adoptSide(side) {
  if (!DERBY.sides[side] || save.side === side) return;
  const wasKit = String(save.outfit).startsWith('derby-');
  save.side = side;
  if (wasKit) save.outfit = `derby-${side}`;
  persist();
}

/** "1,204 km", "38.5 km", "640 m" */
export function km(metres) {
  const m = Math.max(0, Number(metres) || 0);
  if (m < 1000) return `${Math.round(m)} m`;
  const k = m / 1000;
  return `${k.toLocaleString(undefined, { maximumFractionDigits: k < 100 ? 1 : 0 })} km`;
}
