/**
 * The admin dashboard's server side (static/admin.html). Every action needs the admin key
 * (KIMBIA_ADMIN_KEY on the server), compared in constant time.
 *
 *   overview   headline numbers and a two-week series of players and runs
 *   players    find runners by name
 *   player     one runner in detail: recent days, prizes, side, devices
 *   ban        take a runner off (or back onto) every board, prize and derby total
 *   prizes     the latest prizes and whether they were collected
 *   broadcast  one notification to everyone who turned them on (at most every 10 minutes)
 */
import { timingSafeEqual } from 'node:crypto';
import { DERBY, PRIZES } from '../app/data/content.js';
import { darDay, darDayEnd, darWeekStart, shiftDarDay } from '../app/data/daily.js';
import { cleanName, fail, getClient, nameKey, now } from './leaderboard.js';
import { derbyBoard } from './derby.js';
import { broadcast, pushKeys } from './push.js';

const BROADCAST_GAP = 10 * 60 * 1000;
const TITLE_MAX = 60;
const BODY_MAX = 160;

const bad = (error) => ({ status: 400, body: { error } });
const num = (v) => Number(v ?? 0);

export function adminAllowed(given) {
  const key = process.env.KIMBIA_ADMIN_KEY?.trim();
  const g = String(given ?? '');
  return !!key && g.length === key.length && timingSafeEqual(Buffer.from(g), Buffer.from(key));
}

const one = async (db, sql, args = []) => (await db.execute({ sql, args })).rows[0] ?? {};

/** Midnight in Dar at the start of `day`, as the ISO string the created_at columns use. */
const dayStartIso = (day) => new Date(darDayEnd(day) - 24 * 60 * 60 * 1000).toISOString();

async function overview() {
  const db = await getClient();
  const today = darDay(now());
  const week = darWeekStart(today);
  const from = shiftDarDay(today, -13);
  const [players, fresh, todayP, weekP, runsToday, runsAll, push, pins, bets, banned] = await Promise.all([
    one(db, 'SELECT COUNT(*) AS n, SUM(best_score > 0) AS scored FROM players'),
    one(db, 'SELECT COUNT(*) AS n FROM players WHERE created_at >= ?', [dayStartIso(today)]),
    one(db, 'SELECT COUNT(*) AS n FROM daily_scores WHERE day = ?', [today]),
    one(db, 'SELECT COUNT(DISTINCT player_id) AS n FROM daily_scores WHERE day BETWEEN ? AND ?', [week, today]),
    one(db, "SELECT COUNT(*) AS n FROM scores WHERE date(created_at, '+3 hours') = ?", [today]),
    one(db, 'SELECT COUNT(*) AS n FROM scores'),
    one(db, 'SELECT COUNT(*) AS n FROM push_subs'),
    one(db, 'SELECT COUNT(*) AS n FROM accounts WHERE pin_hash IS NOT NULL'),
    one(db, "SELECT COUNT(*) AS n, COALESCE(SUM(stake), 0) AS coins FROM challenges WHERE stake > 0 AND status IN ('open', 'taken')"),
    one(db, 'SELECT COUNT(*) AS n FROM banned'),
  ]);
  const daily = (await db.execute({
    sql: 'SELECT day, COUNT(*) AS players FROM daily_scores WHERE day BETWEEN ? AND ? GROUP BY day',
    args: [from, today],
  })).rows;
  const runs = (await db.execute({
    sql: "SELECT date(created_at, '+3 hours') AS day, COUNT(*) AS runs FROM scores WHERE created_at >= ? GROUP BY day",
    args: [dayStartIso(from)],
  })).rows;
  const byDay = Object.fromEntries(daily.map((r) => [String(r.day), num(r.players)]));
  const runsBy = Object.fromEntries(runs.map((r) => [String(r.day), num(r.runs)]));
  const series = Array.from({ length: 14 }, (_, i) => {
    const day = shiftDarDay(from, i);
    return { day, players: byDay[day] ?? 0, runs: runsBy[day] ?? 0 };
  });
  return {
    status: 200,
    body: {
      today,
      players: num(players.n),
      scored: num(players.scored),
      newToday: num(fresh.n),
      activeToday: num(todayP.n),
      activeWeek: num(weekP.n),
      runsToday: num(runsToday.n),
      runsAll: num(runsAll.n),
      notify: num(push.n),
      pins: num(pins.n),
      openBets: num(bets.n),
      coinsInBets: num(bets.coins),
      banned: num(banned.n),
      pushReady: !!pushKeys(),
      series,
      derby: await derbyBoard(),
      derbyTitle: DERBY.title,
    },
  };
}

const PLAYER_COLS = `p.id, p.name, p.best_score, p.distance, p.runner, p.created_at, p.best_at,
  (SELECT MAX(day) FROM daily_scores d WHERE d.player_id = p.id) AS last_day,
  (SELECT COUNT(*) FROM daily_scores d WHERE d.player_id = p.id) AS days,
  (SELECT reason FROM banned b WHERE b.player_id = p.id) AS banned,
  (SELECT side FROM derby_fans f WHERE f.player_id = p.id AND f.event = ?) AS side`;

const mapPlayer = (r) => ({
  id: num(r.id),
  name: String(r.name),
  best: num(r.best_score),
  distance: num(r.distance),
  runner: String(r.runner),
  joined: String(r.created_at),
  bestAt: String(r.best_at),
  lastDay: r.last_day == null ? null : String(r.last_day),
  days: num(r.days),
  banned: r.banned == null ? null : String(r.banned),
  side: r.side == null ? null : String(r.side),
});

async function players(body) {
  const db = await getClient();
  const q = String(body?.q ?? '').trim().toLowerCase().slice(0, 32);
  const sort = body?.sort === 'recent' ? 'p.id DESC' : 'p.best_score DESC, p.id ASC';
  const rows = (await db.execute({
    sql: `SELECT ${PLAYER_COLS} FROM players p ${q ? "WHERE p.name_key LIKE ? ESCAPE '\\'" : ''} ORDER BY ${sort} LIMIT 30`,
    args: q ? [DERBY.id, `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`] : [DERBY.id],
  })).rows;
  return { status: 200, body: { players: rows.map(mapPlayer) } };
}

async function player(body) {
  const id = Number(body?.id);
  if (!Number.isSafeInteger(id)) return bad('Pick a runner.');
  const db = await getClient();
  const row = (await db.execute({ sql: `SELECT ${PLAYER_COLS} FROM players p WHERE p.id = ?`, args: [DERBY.id, id] })).rows[0];
  if (!row) return { status: 404, body: { error: 'No such runner.' } };
  const recent = (await db.execute({
    sql: 'SELECT day, score, distance, duration FROM daily_scores WHERE player_id = ? ORDER BY day DESC LIMIT 14',
    args: [id],
  })).rows.map((r) => ({ day: String(r.day), score: num(r.score), distance: num(r.distance), duration: num(r.duration) }));
  const prizes = (await db.execute({
    sql: 'SELECT kind, period, rank, amount, claimed_ms FROM prizes WHERE player_id = ? ORDER BY id DESC LIMIT 20',
    args: [id],
  })).rows.map((r) => ({ kind: String(r.kind), period: String(r.period), rank: num(r.rank), amount: num(r.amount), claimed: r.claimed_ms != null }));
  const extra = await one(db, `SELECT
      (SELECT COUNT(*) FROM push_subs s WHERE s.token_hash IN (SELECT token_hash FROM players WHERE id = ? UNION SELECT token_hash FROM player_keys WHERE player_id = ?)) AS devices,
      (SELECT COUNT(*) FROM player_keys WHERE player_id = ?) AS recovered,
      (SELECT pin_hash IS NOT NULL FROM accounts WHERE player_id = ?) AS pin`, [id, id, id, id]);
  return {
    status: 200,
    body: { player: { ...mapPlayer(row), recent, prizes, devices: num(extra.devices), recovered: num(extra.recovered), pin: !!num(extra.pin) } },
  };
}

async function ban(body) {
  const id = Number(body?.id);
  if (!Number.isSafeInteger(id)) return bad('Pick a runner.');
  const db = await getClient();
  if (body?.banned) {
    const reason = String(body?.reason ?? '').trim().slice(0, 120) || 'Removed by admin';
    await db.execute({
      sql: 'INSERT INTO banned (player_id, reason, banned_ms) VALUES (?, ?, ?) ON CONFLICT (player_id) DO UPDATE SET reason = excluded.reason',
      args: [id, reason, now().getTime()],
    });
  } else {
    await db.execute({ sql: 'DELETE FROM banned WHERE player_id = ?', args: [id] });
  }
  return { status: 200, body: { ok: true, banned: !!body?.banned } };
}

async function prizes() {
  const db = await getClient();
  const rows = (await db.execute(
    'SELECT kind, period, rank, name, score, amount, claimed_ms, created_ms FROM prizes ORDER BY id DESC LIMIT 60',
  )).rows;
  return {
    status: 200,
    body: {
      amounts: PRIZES,
      prizes: rows.map((r) => ({
        kind: String(r.kind), period: String(r.period), rank: num(r.rank), name: String(r.name),
        score: num(r.score), amount: num(r.amount), claimed: r.claimed_ms != null,
      })),
    },
  };
}

async function sendBroadcast(body) {
  if (!pushKeys()) return { status: 503, body: { error: 'Notifications are not set up yet (add the VAPID keys in Vercel).' } };
  const title = String(body?.title ?? '').trim().slice(0, TITLE_MAX);
  const text = String(body?.body ?? '').trim().slice(0, BODY_MAX);
  if (!title || !text) return bad('Write a title and a message.');
  const db = await getClient();
  const last = num((await one(db, "SELECT value FROM meta WHERE key = 'broadcast:last'")).value);
  const t = now().getTime();
  if (t - last < BROADCAST_GAP) {
    return { status: 429, body: { error: `One broadcast every 10 minutes — try again in ${Math.ceil((BROADCAST_GAP - (t - last)) / 60000)} min.` } };
  }
  await db.execute({ sql: "INSERT INTO meta (key, value) VALUES ('broadcast:last', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value", args: [String(t)] });
  const result = await broadcast(db, () => ({ title, body: text, tag: `broadcast-${t}`, url: '/' }));
  return { status: 200, body: result };
}

export async function handleAdminRequest(method, body) {
  try {
    if (method !== 'POST') return { status: 405, body: { error: 'Method not allowed.' } };
    if (!process.env.KIMBIA_ADMIN_KEY?.trim()) return { status: 503, body: { error: 'Set KIMBIA_ADMIN_KEY in Vercel to use the dashboard.' } };
    if (!adminAllowed(body?.adminKey)) return { status: 403, body: { error: 'Wrong admin key.' } };
    switch (body?.action) {
      case 'login': return { status: 200, body: { ok: true } };
      case 'overview': return await overview();
      case 'players': return await players(body);
      case 'player': return await player(body);
      case 'find': {
        const name = cleanName(body?.name);
        if (!name) return bad('Type a runner name.');
        const db = await getClient();
        const r = await one(db, 'SELECT id FROM players WHERE name_key = ?', [nameKey(name)]);
        return r.id == null ? { status: 404, body: { error: 'No runner has that name.' } } : player({ id: num(r.id) });
      }
      case 'ban': return await ban(body);
      case 'prizes': return await prizes();
      case 'broadcast': return await sendBroadcast(body);
      default: return bad('Unknown action.');
    }
  } catch (err) {
    return fail(err);
  }
}
