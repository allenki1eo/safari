/**
 * Friend challenges and their coin bets. Server-only (reads the database through the
 * leaderboard's client).
 *
 * A finished run is stored with its route and shadow-runner recording and gets a short id for
 * the link. With a stake, the first friend who accepts matches it and the bet is locked to
 * them; when their run ends the higher score takes the pot (a tie goes to the challenger).
 * The challenger collects winnings and refunds the next time their game asks. Coins live on
 * each device; this table is the referee that says who gets paid.
 */
import { randomBytes } from 'node:crypto';
import { ROUTE_RE } from '../app/data/daily.js';
import { REGIONS } from '../app/data/regions.js';
import { validTrack } from '../app/game/ghostTrack.js';
import { RUNNER_IDS, TOKEN_RE, cleanName, fail, getClient, hashToken, now, strictInt } from './leaderboard.js';
import { notifyBetSettled, notifyBetTaken } from './push.js';

export const STAKE_MAX = 5000;
/** An open bet nobody takes is refunded after this long. */
export const OPEN_TTL = 3 * 24 * 60 * 60 * 1000;
/** A friend who takes a bet and never finishes their run forfeits after this long. */
export const TAKEN_TTL = 2 * 60 * 60 * 1000;
const ID_RE = /^[a-z0-9]{8}$/;

const bad = (error) => ({ status: 400, body: { error } });
const conflict = (error, code) => ({ status: 409, body: { error, code } });
const ms = () => now().getTime();

function newId() {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  return [...randomBytes(8)].map((b) => alphabet[b % alphabet.length]).join('');
}

export function validateChallenge(body) {
  if (body == null || typeof body !== 'object') return { ok: false, error: 'Challenge must be a JSON object.' };
  if (typeof body.token !== 'string' || !TOKEN_RE.test(body.token)) return { ok: false, error: 'Player token is missing or invalid.' };
  const name = cleanName(body.name);
  if (!name) return { ok: false, error: 'Pick a runner name first.' };
  const score = strictInt(body.score, 99_999_999);
  const distance = strictInt(body.distance ?? 0, 9_999_999);
  const duration = strictInt(body.duration ?? 0, 100_000);
  if (score == null || distance == null || duration == null) return { ok: false, error: 'Run numbers are not valid.' };
  const startRegion = strictInt(body.startRegion ?? 0, REGIONS.length - 1);
  if (startRegion == null) return { ok: false, error: 'Start region is not valid.' };
  if (typeof body.route !== 'string' || !ROUTE_RE.test(body.route)) return { ok: false, error: 'Route is not valid.' };
  const track = body.track ?? '';
  if (track !== '' && !validTrack(track)) return { ok: false, error: 'Shadow-runner recording is not valid.' };
  const stake = strictInt(body.stake ?? 0, STAKE_MAX);
  if (stake == null) return { ok: false, error: `Bets go from 0 to ${STAKE_MAX} coins.` };
  const runner = RUNNER_IDS.has(body.runner) ? body.runner : 'zuri';
  return { ok: true, value: { token: body.token, name, score, distance, duration, startRegion, route: body.route, track, stake, runner } };
}

/** Lazily closes bets whose time ran out: untaken ones expire, abandoned ones go to the host. */
async function settleStale(db) {
  const t = ms();
  await db.execute({
    sql: "UPDATE challenges SET status = 'expired', settled_ms = ? WHERE status = 'open' AND stake > 0 AND created_ms < ?",
    args: [t, t - OPEN_TTL],
  });
  await db.execute({
    sql: "UPDATE challenges SET status = 'settled', winner = 'host', settled_ms = ? WHERE status = 'taken' AND taken_ms < ?",
    args: [t, t - TAKEN_TTL],
  });
}

function publicView(row) {
  return {
    id: String(row.id),
    name: String(row.host_name),
    runner: String(row.runner),
    score: Number(row.score),
    distance: Number(row.distance),
    duration: Number(row.duration),
    startRegion: Number(row.start_region),
    route: String(row.route),
    track: String(row.track),
    stake: Number(row.stake),
    status: String(row.status),
    rivalName: row.rival_name == null ? null : String(row.rival_name),
  };
}

async function createChallenge(body) {
  const parsed = validateChallenge(body);
  if (!parsed.ok) return bad(parsed.error);
  const v = parsed.value;
  const db = await getClient();
  for (let tries = 0; tries < 4; tries++) {
    const id = newId();
    try {
      await db.execute({
        sql: `INSERT INTO challenges (id, host_hash, host_name, runner, score, distance, duration, start_region, route, track, stake, created_ms)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [id, hashToken(v.token), v.name, v.runner, v.score, v.distance, v.duration, v.startRegion, v.route, v.track, v.stake, ms()],
      });
      return { status: 200, body: { id, stake: v.stake } };
    } catch (err) {
      if (!/UNIQUE|constraint/i.test(String(err?.message || err))) throw err;
    }
  }
  throw new Error('could not allocate a challenge id');
}

async function getChallenge(id) {
  if (!ID_RE.test(String(id || ''))) return bad('Challenge id is not valid.');
  const db = await getClient();
  await settleStale(db);
  const row = (await db.execute({ sql: 'SELECT * FROM challenges WHERE id = ?', args: [id] })).rows[0];
  if (!row) return { status: 404, body: { error: 'That challenge has gone.' } };
  return { status: 200, body: { challenge: publicView(row) } };
}

async function acceptChallenge(body) {
  if (typeof body?.token !== 'string' || !TOKEN_RE.test(body.token)) return bad('Player token is missing or invalid.');
  if (!ID_RE.test(String(body.id || ''))) return bad('Challenge id is not valid.');
  const name = cleanName(body.name) ?? 'A friend';
  const db = await getClient();
  await settleStale(db);
  const th = hashToken(body.token);
  const row = (await db.execute({ sql: 'SELECT * FROM challenges WHERE id = ?', args: [body.id] })).rows[0];
  if (!row) return { status: 404, body: { error: 'That challenge has gone.' } };
  if (row.host_hash === th) return conflict('This is your own challenge.', 'OWN');
  if (Number(row.stake) <= 0) return conflict('There is no bet on this challenge.', 'NO_BET');
  if (row.status === 'taken' && row.rival_hash === th) return { status: 200, body: { stake: Number(row.stake), again: true } };
  const upd = await db.execute({
    sql: "UPDATE challenges SET status = 'taken', rival_hash = ?, rival_name = ?, taken_ms = ? WHERE id = ? AND status = 'open'",
    args: [th, name, ms(), body.id],
  });
  if (!upd.rowsAffected) return conflict('Someone already took this bet.', 'TAKEN');
  await notifyBetTaken(db, String(row.host_hash), { name, stake: Number(row.stake), id: String(row.id) });
  return { status: 200, body: { stake: Number(row.stake) } };
}

async function finishChallenge(body) {
  if (typeof body?.token !== 'string' || !TOKEN_RE.test(body.token)) return bad('Player token is missing or invalid.');
  if (!ID_RE.test(String(body.id || ''))) return bad('Challenge id is not valid.');
  const score = strictInt(body.score, 99_999_999);
  if (score == null) return bad('Score must be a non-negative integer.');
  const db = await getClient();
  const th = hashToken(body.token);
  const upd = await db.execute({
    sql: `UPDATE challenges
          SET status = 'settled', rival_score = ?, settled_ms = ?,
              winner = CASE WHEN ? > score THEN 'rival' ELSE 'host' END
          WHERE id = ? AND status = 'taken' AND rival_hash = ?`,
    args: [score, ms(), score, body.id, th],
  });
  const row = (await db.execute({ sql: 'SELECT * FROM challenges WHERE id = ?', args: [body.id] })).rows[0];
  if (!row || row.rival_hash !== th || row.status !== 'settled') return conflict('This bet is not yours to finish.', 'NOT_RIVAL');
  if (upd.rowsAffected) {
    await notifyBetSettled(db, String(row.host_hash), {
      name: String(row.rival_name), winner: String(row.winner), score, pot: Number(row.stake) * 2, id: String(row.id),
    });
  }
  return {
    status: 200,
    body: { winner: String(row.winner), pot: Number(row.stake) * 2, hostName: String(row.host_name), hostScore: Number(row.score) },
  };
}

/** Pays the host what their bets earned (wins, forfeits, refunds), once each. */
async function collectWinnings(body) {
  if (typeof body?.token !== 'string' || !TOKEN_RE.test(body.token)) return bad('Player token is missing or invalid.');
  const db = await getClient();
  await settleStale(db);
  const th = hashToken(body.token);
  const due = (await db.execute({
    sql: `SELECT id, stake, status, winner, rival_name, rival_score FROM challenges
          WHERE host_hash = ? AND host_paid = 0 AND stake > 0
            AND (status = 'expired' OR (status = 'settled' AND winner = 'host'))`,
    args: [th],
  })).rows;
  const payouts = [];
  for (const row of due) {
    const upd = await db.execute({ sql: 'UPDATE challenges SET host_paid = 1 WHERE id = ? AND host_paid = 0', args: [row.id] });
    if (!upd.rowsAffected) continue;
    const stake = Number(row.stake);
    payouts.push({
      id: String(row.id),
      kind: row.status === 'expired' ? 'refund' : row.rival_score == null ? 'forfeit' : 'won',
      amount: row.status === 'expired' ? stake : stake * 2,
      rivalName: row.rival_name == null ? null : String(row.rival_name),
      rivalScore: row.rival_score == null ? null : Number(row.rival_score),
    });
  }
  // and the bets friends won against you, so the game can tell you
  const lost = (await db.execute({
    sql: `SELECT id, stake, rival_name, rival_score FROM challenges
          WHERE host_hash = ? AND host_paid = 0 AND status = 'settled' AND winner = 'rival'`,
    args: [th],
  })).rows;
  for (const row of lost) {
    await db.execute({ sql: 'UPDATE challenges SET host_paid = 1 WHERE id = ?', args: [row.id] });
    payouts.push({ id: String(row.id), kind: 'lost', amount: 0, stake: Number(row.stake), rivalName: String(row.rival_name), rivalScore: Number(row.rival_score) });
  }
  return { status: 200, body: { payouts } };
}

export async function handleChallengeRequest(method, body, query) {
  try {
    if (method === 'GET') return await getChallenge(query?.id);
    if (method !== 'POST') return { status: 405, body: { error: 'Method not allowed.' } };
    switch (body?.action) {
      case 'create': return await createChallenge(body);
      case 'accept': return await acceptChallenge(body);
      case 'finish': return await finishChallenge(body);
      case 'collect': return await collectWinnings(body);
      default: return bad('Unknown action.');
    }
  } catch (err) {
    return fail(err);
  }
}
