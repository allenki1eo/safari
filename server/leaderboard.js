/**
 * Server-only leaderboard. Imported by the Vercel route and the Vite dev
 * middleware. Do not import this module from app/ — it reads TURSO_AUTH_TOKEN.
 */
import { createClient } from '@libsql/client';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { CHAPTERS, RUNNERS } from '../app/data/content.js';
import { loadLocalEnv } from './env.js';

loadLocalEnv();

const SCHEMA_SQL = readFileSync(
  new URL('../migrations/001_scores.sql', import.meta.url),
  'utf8',
);

export const TOP_LIMIT = 20;
export const NAME_MAX = 16;

const SCORE_MAX = 99_999_999;
const DISTANCE_MAX = 9_999_999;
const SEEDS_MAX = 999_999;
const ALLIES_MAX = 999;
const CHAPTER_MAX = CHAPTERS.length - 1;
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
  const name = raw.replace(/[\u0000-\u001F\u007F]/g, '').trim().replace(/\s+/g, ' ');
  const length = [...name].length;
  if (length < 1 || length > NAME_MAX) return null;
  return name;
}

function strictInt(value, max) {
  let n;
  if (typeof value === 'number') n = value;
  else if (typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value)) n = Number(value);
  else return null;
  if (!Number.isSafeInteger(n) || n < 0 || n > max) return null;
  return n;
}

/** Accepts a score payload. Client-supplied rank, id, and other fields are dropped. */
export function validateSubmission(body) {
  if (body == null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Score must be a JSON object.' };
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
  let runner = 'zuri';
  if (body.runner != null && body.runner !== '') {
    if (typeof body.runner !== 'string' || !RUNNER_IDS.has(body.runner)) {
      return { ok: false, error: 'Runner is not valid.' };
    }
    runner = body.runner;
  }
  return { ok: true, value: { name, score, distance, seeds, allies, chapter, runner } };
}

function mapRow(row, rank) {
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

const TOP_SQL = `
  SELECT id, name, score, distance, seeds, allies, chapter, runner
  FROM scores
  ORDER BY score DESC, id ASC
  LIMIT ?
`;

async function queryTop(db) {
  const result = await db.execute({ sql: TOP_SQL, args: [TOP_LIMIT] });
  return result.rows.map((row, index) => mapRow(row, index + 1));
}

async function rankOf(db, score, id) {
  const result = await db.execute({
    sql: 'SELECT COUNT(*) AS n FROM scores WHERE score > ? OR (score = ? AND id < ?)',
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

export async function listTop() {
  const db = await getClient();
  return queryTop(db);
}

export async function submitScore(body) {
  const parsed = validateSubmission(body);
  if (!parsed.ok) return { status: 400, body: { error: parsed.error } };
  const value = parsed.value;
  const db = await getClient();
  const inserted = await db.execute({
    sql: `INSERT INTO scores (name, score, distance, seeds, allies, chapter, runner)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [value.name, value.score, value.distance, value.seeds, value.allies, value.chapter, value.runner],
  });
  const id = Number(inserted.lastInsertRowid);
  const rank = await rankOf(db, value.score, id);
  const top = await queryTop(db);
  return { status: 201, body: { entry: { id, rank, ...value }, top } };
}

export async function handleScoreRequest(method, body) {
  try {
    if (method === 'GET') return { status: 200, body: { top: await listTop() } };
    if (method === 'POST') return await submitScore(body);
    return { status: 405, body: { error: 'Method not allowed.' } };
  } catch (err) {
    return fail(err);
  }
}
