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

loadLocalEnv();

// Applied in order on first use; every statement is idempotent.
const SCHEMA_SQL = ['001_scores.sql', '002_players.sql', '003_daily.sql']
  .map((file) => readFileSync(new URL(`../migrations/${file}`, import.meta.url), 'utf8'))
  .join('\n');
const TOKEN_RE = /^[a-f0-9]{64}$/;

export const TOP_LIMIT = 20;
export const NAME_MAX = 16;

const SCORE_MAX = 99_999_999;
const DISTANCE_MAX = 9_999_999;
const SEEDS_MAX = 999_999;
const ALLIES_MAX = 999;
const DURATION_MAX = 100_000;

let clock = () => new Date();

/** Tests pin the Dar day. Production uses the real clock. */
export function setLeaderboardClock(fn) {
  clock = typeof fn === 'function' ? fn : () => new Date();
}
// `chapter` is the furthest journey region reached (0 = Serengeti … 7 = Bwindi)
const CHAPTER_MAX = REGIONS.length - 1;
const RUNNER_IDS = new Set(RUNNERS.map((runner) => runner.id));

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

export function getClient() {
  const url = databaseUrl();
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim() || undefined;
  if (!url.startsWith('file:') && !authToken) throw notConfigured();
  if (clientPromise && clientUrl === url) return clientPromise;
  ensureLocalDir(url);
  const client = createClient({ url, authToken });
  clientUrl = url;
  clientPromise = client.executeMultiple(SCHEMA_SQL).then(() => client).catch((err) => {
    clientPromise = null;
    clientUrl = '';
    throw err;
  });
  return clientPromise;
}

function cleanName(raw) {
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

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function strictInt(value, max) {
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
  return { ok: true, value: { token: body.token, name, score, distance, seeds, allies, chapter, runner, duration } };
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
  WHERE best_score > 0
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

function fail(err) {
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
 * Finds (or creates) the player behind `token`, makes sure they own `name`,
 * then keeps the run only if it beats their best.
 */
export async function submitScore(body) {
  const parsed = validateSubmission(body);
  if (!parsed.ok) return { status: 400, body: { error: parsed.error } };
  const v = parsed.value;
  const db = await getClient();
  const th = hashToken(v.token);
  const key = nameKey(v.name);

  let player = (await db.execute({ sql: `SELECT ${COLS}, name_key FROM players WHERE token_hash = ?`, args: [th] })).rows[0];
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

  player = (await db.execute({ sql: `SELECT ${COLS} FROM players WHERE token_hash = ?`, args: [th] })).rows[0];
  if (!player) return taken(); // lost a race for the name
  const id = Number(player.id);

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
  return { status: 200, body: { entry: { ...mapRow(player, rank), improved, run: v.score }, top, daily } };
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
  const rankId = storedScore === v.score ? Number(stored.id) : 0;
  const rank = await dailyRank(db, day, v.score, rankId);
  return { day, rank, score: v.score, distance: v.distance };
}

async function dailyRank(db, day, score, id) {
  const result = await db.execute({
    sql: `SELECT COUNT(*) AS n FROM daily_scores
          WHERE day = ? AND (score > ? OR (score = ? AND id < ?))`,
    args: [day, score, score, id],
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
  FROM daily_scores
  WHERE day = ? AND score > 0
  ORDER BY score DESC, id ASC
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

export async function handleScoreRequest(method, body, query) {
  try {
    if (method === 'GET') {
      if (query?.board === 'daily') return { status: 200, body: await dailyBoard() };
      return { status: 200, body: { top: await listTop() } };
    }
    if (method === 'POST') return await submitScore(body);
    return { status: 405, body: { error: 'Method not allowed.' } };
  } catch (err) {
    return fail(err);
  }
}
