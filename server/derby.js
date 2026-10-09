/**
 * Kariakoo Derby Special on the server: a runner's side (their first pick sticks, on every device that holds
 * a key to the runner) and each side's total distance, which every run adds to while the event
 * is live. Runs with an impossible pace add nothing, and one run adds at most RUN_MAX metres.
 */
import { DERBY, DERBY_SIDES, derbyLive } from '../app/data/content.js';
import { TOKEN_RE, getClient, hashToken, now, playerIdForToken } from './leaderboard.js';

const RUN_MAX = 60_000;
const MAX_PACE = 90; // m/s, as for the prize boards

export const cleanSide = (side) => (DERBY_SIDES.includes(side) ? side : null);

/** Signs the runner up for `side` unless they already have one; returns the side they hold. */
export async function joinSide(db, playerId, side) {
  if (side && derbyLive(now().getTime())) {
    await db.execute({
      sql: 'INSERT OR IGNORE INTO derby_fans (event, player_id, side, joined_ms) VALUES (?, ?, ?, ?)',
      args: [DERBY.id, playerId, side, now().getTime()],
    });
  }
  const row = (await db.execute({
    sql: 'SELECT side FROM derby_fans WHERE event = ? AND player_id = ?',
    args: [DERBY.id, playerId],
  })).rows[0];
  return row ? String(row.side) : null;
}

/** Adds a finished run to its runner's side. Returns { side, added } or null outside the event. */
export async function derbyRun(db, playerId, run, side) {
  if (!derbyLive(now().getTime())) return null;
  const held = await joinSide(db, playerId, side);
  if (!held) return null;
  const banned = (await db.execute({ sql: 'SELECT 1 FROM banned WHERE player_id = ?', args: [playerId] })).rows.length > 0;
  const fair = !banned && run.duration > 0 && run.distance <= run.duration * MAX_PACE;
  const added = fair ? Math.min(run.distance, RUN_MAX) : 0;
  if (added > 0) {
    await db.execute({
      sql: `INSERT INTO derby_totals (event, side, distance, runs) VALUES (?, ?, ?, 1)
            ON CONFLICT (event, side) DO UPDATE SET distance = distance + excluded.distance, runs = runs + 1`,
      args: [DERBY.id, held, added],
    });
  }
  return { side: held, added };
}

/** The tug of war: each side's distance, runs and fans. */
export async function derbyBoard() {
  const db = await getClient();
  const totals = (await db.execute({ sql: 'SELECT side, distance, runs FROM derby_totals WHERE event = ?', args: [DERBY.id] })).rows;
  const fans = (await db.execute({ sql: 'SELECT side, COUNT(*) AS n FROM derby_fans WHERE event = ? GROUP BY side', args: [DERBY.id] })).rows;
  const sides = Object.fromEntries(DERBY_SIDES.map((id) => [id, { distance: 0, runs: 0, fans: 0 }]));
  for (const r of totals) if (sides[r.side]) Object.assign(sides[r.side], { distance: Number(r.distance), runs: Number(r.runs) });
  for (const r of fans) if (sides[r.side]) sides[r.side].fans = Number(r.n);
  const t = now().getTime();
  return { event: DERBY.id, live: derbyLive(t), opens: DERBY.opens, closes: DERBY.closes, sides };
}

/** POST { action: 'side', token, side }: lock in a side for a runner who already has a name. */
export async function pickSide(body) {
  const side = cleanSide(body?.side);
  if (!side) return { status: 400, body: { error: 'Pick a side.' } };
  if (typeof body?.token !== 'string' || !TOKEN_RE.test(body.token)) return { status: 400, body: { error: 'Player token is missing or invalid.' } };
  if (!derbyLive(now().getTime())) return { status: 409, body: { error: 'Kariakoo Derby Special is over.', code: 'CLOSED' } };
  const db = await getClient();
  const id = await playerIdForToken(db, hashToken(body.token));
  if (id == null) return { status: 200, body: { side, pending: true } }; // joins with their first saved run
  return { status: 200, body: { side: await joinSide(db, id, side) } };
}
