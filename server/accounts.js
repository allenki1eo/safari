/**
 * Getting a runner back on another phone or browser.
 *
 * A runner name belongs to whoever holds its device key, which lives in one browser's
 * storage. Lose that storage (another browser, WhatsApp's or Instagram's built-in browser,
 * cleared site data) and the player's own name reads "taken". So:
 *
 *   setPin   on the device that owns the runner, protect it with a 4–6 digit PIN
 *   sync     keep a cloud copy of the player's progress (only once a PIN is set)
 *   recover  on any device: runner name + PIN (or an admin recovery code) adds that device's
 *            key to the runner and hands back the cloud save
 *   status   whether this device's runner has a PIN yet
 *   adminCode  the game's admin issues a one-time code for a runner that never set a PIN,
 *            after checking the player is who they say (needs KIMBIA_ADMIN_KEY on the server)
 *
 * Wrong guesses are counted per runner: five in a row lock recovery for 15 minutes.
 */
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { TOKEN_RE, cleanName, fail, getClient, hashToken, nameKey, now, playerIdForToken } from './leaderboard.js';

export const PIN_RE = /^\d{4,6}$/;
export const SAVE_MAX = 32 * 1024;
export const MAX_FAILS = 5;
export const LOCK_MS = 15 * 60 * 1000;
export const CODE_TTL = 7 * 24 * 60 * 60 * 1000;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const bad = (error, code) => ({ status: 400, body: { error, code } });
const ms = () => now().getTime();
const hashPin = (pin, salt) => scryptSync(String(pin), salt, 32).toString('hex');

function same(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

/** "abcd-2345" → "ABCD2345" */
export const cleanRecoveryCode = (raw) => {
  const c = String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[A-HJ-NP-Z2-9]{8}$/.test(c) ? c : null;
};

async function account(db, playerId) {
  await db.execute({ sql: 'INSERT OR IGNORE INTO accounts (player_id) VALUES (?)', args: [playerId] });
  return (await db.execute({ sql: 'SELECT * FROM accounts WHERE player_id = ?', args: [playerId] })).rows[0];
}

async function ownPlayer(db, token) {
  if (typeof token !== 'string' || !TOKEN_RE.test(token)) return null;
  const id = await playerIdForToken(db, hashToken(token));
  if (id == null) return null;
  return (await db.execute({ sql: 'SELECT id, name FROM players WHERE id = ?', args: [id] })).rows[0] ?? null;
}

function cleanSave(save) {
  if (save == null || typeof save !== 'object' || Array.isArray(save)) return null;
  const copy = { ...save };
  delete copy.playerToken; // device keys never leave the device
  const json = JSON.stringify(copy);
  return json.length > SAVE_MAX ? null : json;
}

async function status(body) {
  const db = await getClient();
  const p = await ownPlayer(db, body?.token);
  if (!p) return { status: 200, body: { registered: false, pin: false } };
  const a = await account(db, Number(p.id));
  return { status: 200, body: { registered: true, name: String(p.name), pin: !!a.pin_hash, savedAt: a.save_ms == null ? null : Number(a.save_ms) } };
}

async function setPin(body) {
  if (!PIN_RE.test(String(body?.pin ?? ''))) return bad('Your PIN must be 4 to 6 digits.', 'PIN_FORMAT');
  const db = await getClient();
  const p = await ownPlayer(db, body?.token);
  if (!p) return { status: 404, body: { error: 'Save a score with your runner name first.', code: 'NO_RUNNER' } };
  await account(db, Number(p.id));
  const salt = randomBytes(16).toString('hex');
  const save = cleanSave(body?.save);
  await db.execute({
    sql: `UPDATE accounts SET pin_hash = ?, pin_salt = ?, code_hash = NULL, code_ms = NULL, fails = 0, locked_until = 0,
          save = COALESCE(?, save), save_ms = CASE WHEN ? IS NULL THEN save_ms ELSE ? END WHERE player_id = ?`,
    args: [hashPin(body.pin, salt), salt, save, save, ms(), Number(p.id)],
  });
  return { status: 200, body: { ok: true, name: String(p.name) } };
}

async function sync(body) {
  const save = cleanSave(body?.save);
  if (!save) return bad('That save is not valid.');
  const db = await getClient();
  const p = await ownPlayer(db, body?.token);
  if (!p) return { status: 404, body: { error: 'Unknown runner.', code: 'NO_RUNNER' } };
  const a = await account(db, Number(p.id));
  if (!a.pin_hash) return { status: 409, body: { error: 'Set a recovery PIN first.', code: 'NO_PIN' } };
  await db.execute({ sql: 'UPDATE accounts SET save = ?, save_ms = ? WHERE player_id = ?', args: [save, ms(), Number(p.id)] });
  return { status: 200, body: { ok: true } };
}

async function recover(body) {
  const name = cleanName(body?.name);
  if (!name) return bad('Type your runner name.');
  if (typeof body?.token !== 'string' || !TOKEN_RE.test(body.token)) return bad('Device key is missing.');
  const pin = String(body?.pin ?? '').trim();
  const db = await getClient();
  const p = (await db.execute({ sql: 'SELECT id, name, best_score FROM players WHERE name_key = ?', args: [nameKey(name)] })).rows[0];
  if (!p) return { status: 404, body: { error: 'No runner has that name.', code: 'NO_RUNNER' } };
  const id = Number(p.id);
  const a = await account(db, id);
  const t = ms();
  if (Number(a.locked_until) > t) {
    const mins = Math.ceil((Number(a.locked_until) - t) / 60000);
    return { status: 429, body: { error: `Too many tries. Try again in ${mins} min.`, code: 'LOCKED', minutes: mins } };
  }
  const code = cleanRecoveryCode(pin);
  const codeOk = !!code && !!a.code_hash && Number(a.code_ms) > t - CODE_TTL && same(hashPin(code, String(id)), String(a.code_hash));
  const pinOk = PIN_RE.test(pin) && !!a.pin_hash && same(hashPin(pin, String(a.pin_salt)), String(a.pin_hash));
  if (!a.pin_hash && !a.code_hash) {
    return { status: 409, body: { error: 'This runner never set a recovery PIN.', code: 'NO_PIN' } };
  }
  if (!codeOk && !pinOk) {
    const fails = Number(a.fails) + 1;
    const lock = fails >= MAX_FAILS ? t + LOCK_MS : 0;
    await db.execute({ sql: 'UPDATE accounts SET fails = ?, locked_until = ? WHERE player_id = ?', args: [lock ? 0 : fails, lock, id] });
    return { status: 403, body: { error: 'That PIN is not right.', code: 'WRONG_PIN', triesLeft: lock ? 0 : MAX_FAILS - fails } };
  }
  // this device now holds a key to the runner; a used recovery code is spent
  await db.execute({
    sql: 'INSERT INTO player_keys (token_hash, player_id, created_ms) VALUES (?, ?, ?) ON CONFLICT (token_hash) DO UPDATE SET player_id = excluded.player_id',
    args: [hashToken(body.token), id, t],
  });
  await db.execute({
    sql: `UPDATE accounts SET fails = 0, locked_until = 0${codeOk ? ', code_hash = NULL, code_ms = NULL' : ''} WHERE player_id = ?`,
    args: [id],
  });
  return {
    status: 200,
    body: { name: String(p.name), best: Number(p.best_score), save: a.save ? JSON.parse(String(a.save)) : null, needsPin: !a.pin_hash },
  };
}

async function adminCode(body) {
  const key = process.env.KIMBIA_ADMIN_KEY?.trim();
  if (!key) return { status: 503, body: { error: 'Recovery codes are not switched on (set KIMBIA_ADMIN_KEY on the server).' } };
  const given = String(body?.adminKey ?? '');
  if (given.length !== key.length || !timingSafeEqual(Buffer.from(given), Buffer.from(key))) {
    return { status: 403, body: { error: 'Wrong admin key.' } };
  }
  const name = cleanName(body?.name);
  if (!name) return bad('Type the runner name.');
  const db = await getClient();
  const p = (await db.execute({ sql: 'SELECT id, name, best_score FROM players WHERE name_key = ?', args: [nameKey(name)] })).rows[0];
  if (!p) return { status: 404, body: { error: 'No runner has that name.' } };
  const id = Number(p.id);
  await account(db, id);
  const code = [...randomBytes(8)].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
  await db.execute({
    sql: 'UPDATE accounts SET code_hash = ?, code_ms = ?, fails = 0, locked_until = 0 WHERE player_id = ?',
    args: [hashPin(code, String(id)), ms(), id],
  });
  return { status: 200, body: { name: String(p.name), best: Number(p.best_score), code } };
}

export async function handleAccountRequest(method, body) {
  try {
    if (method !== 'POST') return { status: 405, body: { error: 'Method not allowed.' } };
    switch (body?.action) {
      case 'status': return await status(body);
      case 'setPin': return await setPin(body);
      case 'sync': return await sync(body);
      case 'recover': return await recover(body);
      case 'adminCode': return await adminCode(body);
      default: return bad('Unknown action.');
    }
  } catch (err) {
    return fail(err);
  }
}
