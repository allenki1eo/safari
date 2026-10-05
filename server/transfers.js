/**
 * Progress codes. iPhone gives a home-screen app storage of its own, apart from Safari's, so a
 * player who installs the game would start again from nothing (and their runner name would be
 * "taken" by their own Safari self). Before installing, the game parks a snapshot of the save
 * here under a short code; the installed app opens with that code and takes the save back.
 * The same codes move progress between any two browsers. Codes last a week.
 */
import { randomBytes } from 'node:crypto';
import { fail, getClient, now } from './leaderboard.js';

export const TRANSFER_TTL = 7 * 24 * 60 * 60 * 1000;
export const DATA_MAX = 32 * 1024;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I to misread
export const CODE_RE = /^[A-HJ-NP-Z2-9]{8}$/;

const bad = (error) => ({ status: 400, body: { error } });
const ms = () => now().getTime();

/** Accepts "abcd-2345", "ABCD 2345" and the like. */
export function cleanCode(raw) {
  const code = String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return CODE_RE.test(code) ? code : null;
}

function newCode() {
  return [...randomBytes(8)].map((b) => ALPHABET[b % ALPHABET.length]).join('');
}

async function createTransfer(body) {
  const data = body?.data;
  if (data == null || typeof data !== 'object' || Array.isArray(data)) return bad('Nothing to save.');
  const json = JSON.stringify(data);
  if (json.length > DATA_MAX) return bad('That save is too big.');
  const db = await getClient();
  // tidy up old codes while we're here
  await db.execute({ sql: 'DELETE FROM transfers WHERE created_ms < ?', args: [ms() - TRANSFER_TTL] });
  for (let tries = 0; tries < 4; tries++) {
    const code = newCode();
    try {
      await db.execute({ sql: 'INSERT INTO transfers (code, data, created_ms) VALUES (?, ?, ?)', args: [code, json, ms()] });
      return { status: 200, body: { code } };
    } catch (err) {
      if (!/UNIQUE|constraint/i.test(String(err?.message || err))) throw err;
    }
  }
  throw new Error('could not allocate a progress code');
}

async function claimTransfer(body) {
  const code = cleanCode(body?.code);
  if (!code) return bad('That code is not valid.');
  const db = await getClient();
  const row = (await db.execute({ sql: 'SELECT data, created_ms FROM transfers WHERE code = ?', args: [code] })).rows[0];
  if (!row || Number(row.created_ms) < ms() - TRANSFER_TTL) return { status: 404, body: { error: 'That code has expired or does not exist.' } };
  return { status: 200, body: { data: JSON.parse(String(row.data)) } };
}

/**
 * The web app manifest with a progress code in its start URL, so the app Safari adds to the
 * home screen opens straight into the player's own progress.
 */
export function manifestFor(code, base) {
  return { ...base, start_url: `/?restore=${code}` };
}

export async function handleTransferRequest(method, body) {
  try {
    if (method !== 'POST') return { status: 405, body: { error: 'Method not allowed.' } };
    if (body?.action === 'create') return await createTransfer(body);
    if (body?.action === 'claim') return await claimTransfer(body);
    return bad('Unknown action.');
  } catch (err) {
    return fail(err);
  }
}
