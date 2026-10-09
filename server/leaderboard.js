/**
 * Server-only leaderboard. Imported by the Vercel route and the Vite dev
 * middleware. Do not import this module from app/ — it reads TURSO_AUTH_TOKEN.
 */
import { createClient } from '@libsql/client';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { RUNNERS } from '../app/data/content.js';
import { darDay, shiftDarDay } from '../app/data/daily.js';
import { REGIONS } from '../app/data/regions.js';
import { loadLocalEnv } from './env.js';
import { KINDS, claimPrizes, prizeBoard } from './prizes.js';
import { cleanSide, derbyBoard, derbyRun, pickSide } from './derby.js';
import { MAX_MULT, fairRunSql, plausibleRun, prizeScore, prizeScoreSql } from './plausible.js';

loadLocalEnv();

// Applied in order on first use; every statement is idempotent.
const SCHEMA_SQL = ['001_scores.sql', '002_players.sql', '003_daily.sql', '004_challenges.sql', '005_transfers.sql', '006_accounts.sql', '007_prizes.sql', '008_push.sql', '009_derby.sql', '010_banned.sql', '011_inbox.sql', '012_fair_play.sql']
  .map((file) => readFileSync(new URL(`../migrations/${file}`, import.meta.url), 'utf8'))
  .join('\n');
export const TOKEN_RE = /^[a-f0-9]{64}$/;

export const TOP_LIMIT = 20;
export const NAME_MAX = 16;

const SCORE_MAX = 99_999_999;
const DISTANCE_MAX = 9_999_999;
const SEEDS_MAX = 999_999;
const ALLIES_MAX = 999;
const DURATION_MAX = 100_000;

let clock = () => new Date();
export const now = () => clock();

/** Tests pin the Dar day. Production uses the real clock. */
export function setLeaderboardClock(fn) {
  clock = typeof fn === 'function' ? fn : () => new Date();
}
// `chapter` is the furthest journey region reached (an index into REGIONS: 0 = Serengeti)
const CHAPTER_MAX = REGIONS.length - 1;
export const RUNNER_IDS = new Set(RUNNERS.map((runner) => runner.id));

let clientPromise = null;
let clientUrl = '';

export function resetLeaderboardClient() {
  clientPromise = null;
  clientUrl = '';
}

function notConfigured() {
  const err = new Error('Leaderboard storage is not configured');
  err.code = 'NOT_CONFIGURED';
  return err;
}

function databaseUrl() {
  const url = process.env.TURSO_DATABASE_URL?.trim();
  if (!url) throw notConfigured();
  return url;
}

function ensureLocalDir(url) {
  if (!url.startsWith('file:')) return;
  const path = url.slice('file:'.length).replace(/^\/\//, '/');
  mkdirSync(dirname(resolve(path)), { recursive: true });
}

// The schema's fingerprint: a new instance checks it with one read and runs the migrations only
// when they changed, instead of every cold start re-running them all (one scans the run log).
const SCHEMA_KEY = `schema:${createHash('sha256').update(SCHEMA_SQL).digest('hex').slice(0, 16)}`;

async function ensureSchema(client) {
  try {
    const hit = await client.execute({ sql: 'SELECT 1 FROM meta WHERE key = ?', args: [SCHEMA_KEY] });
    if (hit.rows.length) return;
  } catch {
    /* a fresh database has no meta table yet */
  }
  await client.executeMultiple(SCHEMA_SQL);
  await client.execute({ sql: 'INSERT OR IGNORE INTO meta (key, value) VALUES (?, ?)', args: [SCHEMA_KEY, new Date().toISOString()] });
}

export function getClient() {
  const url = databaseUrl();
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim() || undefined;
  if (!url.startsWith('file:') && !authToken) throw notConfigured();
  if (clientPromise && clientUrl === url) return clientPromise;
  ensureLocalDir(url);
  const client = createClient({ url, authToken });
  clientUrl = url;
  clientPromise = ensureSchema(client).then(() => client).catch((err) => {
    clientPromise = null;
    clientUrl = '';
    throw err;
  });
  return clientPromise;
}

export function cleanName(raw) {
  if (typeof raw !== 'string') return null;
  const name = raw.normalize('NFKC').replace(/[\u0000-\u001F\u007F]/g, '').trim().replace(/\s+/g, ' ');
  const length = [...name].length;
  if (length < 1 || length > NAME_MAX) return null;
  return name;
}

/** Case- and spacing-insensitive identity of a name: "Zuri", "zuri" and " ZURI " are the same runner. */
export function nameKey(name) {
  return name.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function strictInt(value, max) {
  let n;
  if (typeof value === 'number') n = value;
  else if (typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value)) n = Number(value);
  else return null;
  if (!Number.isSafeInteger(n) || n < 0 || n > max) return null;
  return n;
}

/**
 * Accepts a run. `token` is the player's device secret (64 hex chars); `name` claims
 * or renames their runner. Client-supplied rank, id, and other fields are dropped.
 */
export function validateSubmission(body) {
  if (body == null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Score must be a JSON object.' };
  }
  if (typeof body.token !== 'string' || !TOKEN_RE.test(body.token)) {
    return { ok: false, error: 'Player token is missing or invalid.' };
  }
  const name = cleanName(body.name);
  if (!name) return { ok: false, error: `Name must be 1–${NAME_MAX} characters.` };
  const score = strictInt(body.score, SCORE_MAX);
  if (score == null) return { ok: false, error: 'Score must be a non-negative integer.' };
  const distance = body.distance == null ? 0 : strictInt(body.distance, DISTANCE_MAX);
  if (distance == null) return { ok: false, error: 'Distance must be a non-negative integer.' };
  const seeds = body.seeds == null ? 0 : strictInt(body.seeds, SEEDS_MAX);
  if (seeds == null) return { ok: false, error: 'Seeds must be a non-negative integer.' };
  const allies = body.allies == null ? 0 : strictInt(body.allies, ALLIES_MAX);
  if (allies == null) return { ok: false, error: 'Allies must be a non-negative integer.' };
  const chapter = body.chapter == null ? 0 : strictInt(body.chapter, CHAPTER_MAX);
  if (chapter == null) return { ok: false, error: 'Chapter is not valid.' };
  const duration = body.duration == null ? 0 : strictInt(body.duration, DURATION_MAX);
  if (duration == null) return { ok: false, error: 'Duration must be a non-negative integer.' };
  let runner = 'zuri';
  if (body.runner != null && body.runner !== '') {
    if (typeof body.runner !== 'string' || !RUNNER_IDS.has(body.runner)) {
      return { ok: false, error: 'Runner is not valid.' };
    }
    runner = body.runner;
  }
  // the permanent multiplier the run was made with (newer clients send it; older ones don't)
  const mult = body.mult == null ? null : strictInt(body.mult, MAX_MULT);
  if (body.mult != null && (mult == null || mult < 1)) return { ok: false, error: 'Multiplier is not valid.' };
  // Derby Day: the side this runner is on (ignored outside the event or if not a real side)
  const side = cleanSide(body.side);
  return { ok: true, value: { token: body.token, name, score, distance, seeds, allies, chapter, runner, duration, mult, side } };
}

function mapRow(row, rank) {
  return {
    id: Number(row.id),
    rank,
    name: String(row.name),
    score: Number(row.best_score),
    distance: Number(row.distance),
    seeds: Number(row.seeds),
    allies: Number(row.allies),
    chapter: Number(row.chapter),
    runner: String(row.runner),
  };
}

const COLS = 'id, name, best_score, distance, seeds, allies, chapter, runner';
const TOP_SQL = `
  SELECT ${COLS}
  FROM players
  WHERE best_score > 0 AND id NOT IN (SELECT player_id FROM banned)
  ORDER BY best_score DESC, id ASC
  LIMIT ?
`;

async function queryTop(db) {
  const result = await db.execute({ sql: TOP_SQL, args: [TOP_LIMIT] });
  return result.rows.map((row, index) => mapRow(row, index + 1));
}

async function rankOf(db, score, id) {
  const result = await db.execute({
    sql: 'SELECT COUNT(*) AS n FROM players WHERE best_score > ? OR (best_score = ? AND id < ?)',
    args: [score, score, id],
  });
  return Number(result.rows[0].n) + 1;
}

export function fail(err) {
  if (err?.code === 'NOT_CONFIGURED') {
    return { status: 503, body: { error: 'The leaderboard is not set up yet.' } };
  }
  console.error('leaderboard:', err?.message || err);
  return { status: 500, body: { error: 'The leaderboard is unavailable.' } };
}

const taken = () => ({ status: 409, body: { error: 'That name is taken. Try another one.', code: 'NAME_TAKEN' } });
const isUnique = (err) => /UNIQUE|constraint/i.test(String(err?.message || err));

export async function listTop() {
  const db = await getClient();
  return queryTop(db);
}

/**
 * The player a device key belongs to: the key they registered with, or one added when they
 * got their runner back on another device (accounts.js).
 */
export async function playerIdForToken(db, th) {
  const own = (await db.execute({ sql: 'SELECT id FROM players WHERE token_hash = ?', args: [th] })).rows[0];
  if (own) return Number(own.id);
  const extra = (await db.execute({ sql: 'SELECT player_id FROM player_keys WHERE token_hash = ?', args: [th] })).rows[0];
  return extra ? Number(extra.player_id) : null;
}

/**
 * Finds (or creates) the player behind `token`, makes sure they own `name`,
 * then keeps the run only if it beats their best.
 */
export async function submitScore(body, ctx = null) {
  const parsed = validateSubmission(body);
  if (!parsed.ok) return { status: 400, body: { error: parsed.error } };
  const v = parsed.value;
  const db = await getClient();
  const th = hashToken(v.token);
  if (ctx && !(await withinRateLimit(db, th, ctx.ip))) return slowDown();
  const key = nameKey(v.name);

  const pid = await playerIdForToken(db, th);
  let player = pid == null ? null : (await db.execute({ sql: `SELECT ${COLS}, name_key FROM players WHERE id = ?`, args: [pid] })).rows[0];
  const owner = (await db.execute({ sql: 'SELECT id, token_hash FROM players WHERE name_key = ?', args: [key] })).rows[0];

  try {
    if (!player) {
      if (owner && owner.token_hash == null) {
        // first device to post under a name from the old board claims it
        await db.execute({ sql: 'UPDATE players SET token_hash = ?, name = ? WHERE id = ? AND token_hash IS NULL', args: [th, v.name, owner.id] });
      } else if (owner) {
        return taken();
      } else {
        await db.execute({ sql: 'INSERT INTO players (name, name_key, token_hash) VALUES (?, ?, ?)', args: [v.name, key, th] });
      }
    } else if (player.name_key !== key) {
      if (owner) return taken();
      await db.execute({ sql: 'UPDATE players SET name = ?, name_key = ? WHERE id = ?', args: [v.name, key, player.id] });
    } else if (player.name !== v.name) {
      await db.execute({ sql: 'UPDATE players SET name = ? WHERE id = ?', args: [v.name, player.id] });
    }
  } catch (err) {
    if (isUnique(err)) return taken();
    throw err;
  }

  const id0 = await playerIdForToken(db, th);
  player = id0 == null ? null : (await db.execute({ sql: `SELECT ${COLS} FROM players WHERE id = ?`, args: [id0] })).rows[0];
  if (!player) return taken(); // lost a race for the name
  const id = Number(player.id);

  // a run that could not have happened is turned away (the name above is still theirs)
  const real = plausibleRun(v);
  if (!real.ok) {
    return { status: 422, body: { error: "That run doesn't add up, so it wasn't saved.", code: 'IMPLAUSIBLE', reason: real.reason } };
  }

  let improved = false;
  if (v.score > 0) {
    const upd = await db.execute({
      sql: `UPDATE players
            SET best_score = ?, distance = ?, seeds = ?, allies = ?, chapter = ?, runner = ?,
                best_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE id = ? AND best_score < ?`,
      args: [v.score, v.distance, v.seeds, v.allies, v.chapter, v.runner, id, v.score],
    });
    improved = upd.rowsAffected > 0;
    await db.execute({
      sql: 'INSERT INTO scores (name, score, distance, seeds, allies, chapter, runner) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [v.name, v.score, v.distance, v.seeds, v.allies, v.chapter, v.runner],
    });
    if (improved) player = (await db.execute({ sql: `SELECT ${COLS} FROM players WHERE id = ?`, args: [id] })).rows[0];
  }

  const best = Number(player.best_score);
  const rank = best > 0 ? await rankOf(db, best, id) : null;
  const top = await queryTop(db);
  // The all-time row above is unchanged. Today's rank is only here so the
  // share card can show where this run sits on the daily board.
  const daily = v.score > 0 ? await recordDaily(db, id, v) : null;
  const derby = v.score > 0 || v.side ? await derbyRun(db, id, v, v.side) : null;
  return { status: 200, body: { entry: { ...mapRow(player, rank), improved, run: v.score }, top, daily, derby } };
}

const DAILY_UPSERT = `
  INSERT INTO daily_scores (day, player_id, name, score, distance, duration, seeds, allies, chapter, runner)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(day, player_id) DO UPDATE SET
    name = excluded.name,
    runner = CASE WHEN excluded.score > daily_scores.score THEN excluded.runner ELSE daily_scores.runner END,
    score = CASE WHEN excluded.score > daily_scores.score THEN excluded.score ELSE daily_scores.score END,
    distance = CASE WHEN excluded.score > daily_scores.score THEN excluded.distance ELSE daily_scores.distance END,
    duration = CASE WHEN excluded.score > daily_scores.score THEN excluded.duration ELSE daily_scores.duration END,
    seeds = CASE WHEN excluded.score > daily_scores.score THEN excluded.seeds ELSE daily_scores.seeds END,
    allies = CASE WHEN excluded.score > daily_scores.score THEN excluded.allies ELSE daily_scores.allies END,
    chapter = CASE WHEN excluded.score > daily_scores.score THEN excluded.chapter ELSE daily_scores.chapter END
`;

async function recordDaily(db, playerId, v) {
  const day = darDay(clock());
  await db.execute({
    sql: DAILY_UPSERT,
    args: [day, playerId, v.name, v.score, v.distance, v.duration, v.seeds, v.allies, v.chapter, v.runner],
  });
  const stored = (await db.execute({
    sql: 'SELECT id, score FROM daily_scores WHERE day = ? AND player_id = ?',
    args: [day, playerId],
  })).rows[0];
  const storedScore = Number(stored.score);
  if (storedScore === v.score && v.mult != null) {
    await db.execute({
      sql: `INSERT INTO run_meta (day, player_id, mult) VALUES (?, ?, ?)
            ON CONFLICT (day, player_id) DO UPDATE SET mult = excluded.mult`,
      args: [day, playerId, v.mult],
    });
  }
  const rankId = storedScore === v.score ? Number(stored.id) : 0;
  // ranked the way the day prize board ranks: fair runs only, multiplier counted up to the cap
  const rank = await dailyRank(db, day, prizeScore(v.score, v.mult), rankId);
  return { day, rank, score: v.score, distance: v.distance };
}

async function dailyRank(db, day, pscore, id) {
  const result = await db.execute({
    sql: `SELECT COUNT(*) AS n FROM (
            SELECT d.id, ${prizeScoreSql('d', 'm')} AS pscore
            FROM daily_scores d
            LEFT JOIN run_meta m ON m.day = d.day AND m.player_id = d.player_id
            WHERE d.day = ? AND ${fairRunSql('d')} AND d.player_id NOT IN (SELECT player_id FROM banned)
          )
          WHERE id != ? AND (pscore > ? OR (pscore = ? AND id < ?))`,
    args: [day, id, pscore, pscore, id],
  });
  return Number(result.rows[0].n) + 1;
}

function mapDaily(row, rank) {
  return {
    id: Number(row.id),
    rank,
    name: String(row.name),
    score: Number(row.score),
    distance: Number(row.distance),
    seeds: Number(row.seeds),
    allies: Number(row.allies),
    chapter: Number(row.chapter),
    runner: String(row.runner),
  };
}

const DAILY_TOP_SQL = `
  SELECT id, name, score, distance, duration, seeds, allies, chapter, runner
  FROM daily_scores d
  WHERE d.day = ? AND ${fairRunSql('d')} AND d.player_id NOT IN (SELECT player_id FROM banned)
  ORDER BY d.score DESC, d.id ASC
  LIMIT ?
`;

async function queryDaily(db, day) {
  const result = await db.execute({ sql: DAILY_TOP_SQL, args: [day, TOP_LIMIT] });
  return result.rows.map((row, index) => mapDaily(row, index + 1));
}

/** Yesterday's best real run, or null when that day has no ghost to draw. */
async function yesterdayBest(db, today) {
  const result = await db.execute({
    sql: `SELECT name, score, distance, duration, runner
          FROM daily_scores
          WHERE day = ? AND score > 0 AND distance > 0 AND duration > 0
          ORDER BY score DESC, id ASC
          LIMIT 1`,
    args: [shiftDarDay(today, -1)],
  });
  const row = result.rows[0];
  if (!row) return null;
  return {
    name: String(row.name),
    score: Number(row.score),
    distance: Number(row.distance),
    duration: Number(row.duration),
    runner: String(row.runner),
  };
}

async function dailyBoard() {
  const db = await getClient();
  const day = darDay(clock());
  return { day, top: await queryDaily(db, day), yesterday: await yesterdayBest(db, day) };
}

/* ------------------------------------------------------------- rate limits */
// a device posts one run per game; a few a minute is plenty. A network (many phones behind one
// mobile carrier address) gets a much bigger allowance.
export const RATE = { windowMs: 60_000, perDevice: 8, perNetwork: 120 };

const slowDown = () => ({ status: 429, body: { error: 'Too many runs at once. Wait a moment and try again.', code: 'RATE_LIMITED' } });

async function bump(db, key, limit, t) {
  const row = (await db.execute({
    sql: `INSERT INTO rate_limits (key, window_start, n) VALUES (?, ?, 1)
          ON CONFLICT (key) DO UPDATE SET
            n = CASE WHEN ? - rate_limits.window_start >= ? THEN 1 ELSE rate_limits.n + 1 END,
            window_start = CASE WHEN ? - rate_limits.window_start >= ? THEN ? ELSE rate_limits.window_start END
          RETURNING n`,
    args: [key, t, t, RATE.windowMs, t, RATE.windowMs, t],
  })).rows[0];
  return Number(row.n) <= limit;
}

/** Counts this post against its device and its network; false once either is over the limit. */
export async function withinRateLimit(db, tokenHash, ip) {
  const t = now().getTime();
  if (Math.random() < 0.02) {
    await db.execute({ sql: 'DELETE FROM rate_limits WHERE window_start < ?', args: [t - 24 * 60 * 60 * 1000] });
  }
  const device = await bump(db, `d:${tokenHash}`, RATE.perDevice, t);
  const network = ip ? await bump(db, `n:${hashToken(`ip:${ip}`)}`, RATE.perNetwork, t) : true;
  return device && network;
}

export async function handleScoreRequest(method, body, query, ctx = null) {
  try {
    if (method === 'GET') {
      if (query?.board === 'daily') return { status: 200, body: await dailyBoard() };
      if (KINDS.includes(query?.board)) return { status: 200, body: await prizeBoard(query.board) };
      if (query?.board === 'derby') return { status: 200, body: await derbyBoard() };
      return { status: 200, body: { top: await listTop() } };
    }
    if (method === 'POST' && body?.action === 'prizes') return await claimPrizes(body);
    if (method === 'POST' && body?.action === 'side') return await pickSide(body);
    if (method === 'POST') return await submitScore(body, ctx);
    return { status: 405, body: { error: 'Method not allowed.' } };
  } catch (err) {
    return fail(err);
  }
}
