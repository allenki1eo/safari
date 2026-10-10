/**
 * Invite links and the game's social links.
 *
 * Every runner has an invite code (their player id in base 36, e.g. "?ref=2s"). A new runner who
 * opens the game through it is tied to the inviter when their name is first saved
 * (recordReferral), and the referral counts once they finish a real run of REFERRAL.qualifyM
 * metres (qualifyReferral). Then the inviter is told and earns REFERRAL.reward seeds (for up to
 * REFERRAL.cap friends) and the new runner gets REFERRAL.welcome; each side collects once
 * (claimReferrals), the same way prizes are collected.
 *
 * The admin sets the game's TikTok handle; the game reads it with GET ?board=social.
 */
import { REFERRAL } from '../app/data/content.js';
import { TOKEN_RE, getClient, hashToken, now, playerIdForToken } from './leaderboard.js';
import { notifyFriendJoined } from './push.js';

const CODE_RE = /^[0-9a-z]{1,10}$/;

export const refCode = (playerId) => Number(playerId).toString(36);

/** The player id behind an invite code, or null for anything that is not one. */
export function refId(code) {
  const c = String(code ?? '').trim().toLowerCase();
  if (!CODE_RE.test(c)) return null;
  const id = parseInt(c, 36);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/** Ties a runner who has just been created to the friend whose link brought them. Never throws. */
export async function recordReferral(db, playerId, code) {
  const referrer = refId(code);
  if (referrer == null || referrer === playerId) return;
  try {
    await db.execute({
      sql: `INSERT OR IGNORE INTO referrals (player_id, referrer_id, created_ms)
            SELECT ?, id, ? FROM players WHERE id = ? AND id NOT IN (SELECT player_id FROM banned)`,
      args: [playerId, now().getTime(), referrer],
    });
  } catch (err) {
    console.error('referrals:', err?.message || err);
  }
}

/**
 * Called with every real run: the first one of qualifyM metres or more makes this runner's
 * referral count, pays their inviter (while under the cap) and tells them. Never throws.
 */
export async function qualifyReferral(db, playerId, name, distance) {
  if (distance < REFERRAL.qualifyM) return;
  try {
    const row = (await db.execute({
      sql: `UPDATE referrals
            SET qualified_ms = ?,
                rewarded = (SELECT COUNT(*) FROM referrals r WHERE r.referrer_id = referrals.referrer_id AND r.rewarded = 1) < ?
            WHERE player_id = ? AND qualified_ms IS NULL
            RETURNING referrer_id, rewarded`,
      args: [now().getTime(), REFERRAL.cap, playerId],
    })).rows[0];
    if (row && Number(row.rewarded)) {
      await notifyFriendJoined(db, Number(row.referrer_id), { name, amount: REFERRAL.reward, friendId: playerId });
    }
  } catch (err) {
    console.error('referrals:', err?.message || err);
  }
}

/**
 * POST { action: 'referrals', token }: this runner's invite code and friends, and any seeds they
 * have earned since they last looked (each referral pays each side only once).
 */
export async function claimReferrals(body) {
  if (typeof body?.token !== 'string' || !TOKEN_RE.test(body.token)) {
    return { status: 400, body: { error: 'Player token is missing or invalid.' } };
  }
  const db = await getClient();
  const id = await playerIdForToken(db, hashToken(body.token));
  const base = { ...REFERRAL, code: null, friends: [], joined: 0, pending: 0, earned: 0, reward: REFERRAL.reward, collected: 0, welcome: 0 };
  if (id == null) return { status: 200, body: base };
  const t = now().getTime();
  const [paid, welcomed, friends] = await Promise.all([
    db.execute({
      sql: `UPDATE referrals SET referrer_paid_ms = ?
            WHERE referrer_id = ? AND rewarded = 1 AND referrer_paid_ms IS NULL RETURNING player_id`,
      args: [t, id],
    }),
    db.execute({
      sql: `UPDATE referrals SET friend_paid_ms = ?
            WHERE player_id = ? AND qualified_ms IS NOT NULL AND friend_paid_ms IS NULL RETURNING referrer_id`,
      args: [t, id],
    }),
    db.execute({
      sql: `SELECT p.name, r.qualified_ms, r.rewarded FROM referrals r JOIN players p ON p.id = r.player_id
            WHERE r.referrer_id = ? ORDER BY r.created_ms DESC LIMIT 50`,
      args: [id],
    }),
  ]);
  const list = friends.rows.map((r) => ({ name: String(r.name), done: r.qualified_ms != null }));
  const rewarded = friends.rows.filter((r) => Number(r.rewarded)).length;
  return {
    status: 200,
    body: {
      ...base,
      code: refCode(id),
      friends: list.slice(0, 20),
      joined: list.filter((f) => f.done).length,
      pending: list.filter((f) => !f.done).length,
      earned: rewarded * REFERRAL.reward,
      collected: paid.rows.length * REFERRAL.reward,
      welcome: welcomed.rows.length ? REFERRAL.welcome : 0,
    },
  };
}

/** GET ?ref=CODE: who sent this invite, for the "Juma invited you" greeting. */
export async function inviterOf(code) {
  const id = refId(code);
  if (id == null) return { status: 404, body: { error: 'No such invite.' } };
  const db = await getClient();
  const row = (await db.execute({
    sql: 'SELECT name, best_score FROM players WHERE id = ? AND id NOT IN (SELECT player_id FROM banned)',
    args: [id],
  })).rows[0];
  if (!row) return { status: 404, body: { error: 'No such invite.' } };
  return { status: 200, body: { name: String(row.name), best: Number(row.best_score), welcome: REFERRAL.welcome } };
}

/* ------------------------------------------------------------ social links */
// TikTok usernames: letters, numbers, underscores and full stops, up to 24 characters.
const HANDLE_RE = /^[A-Za-z0-9._]{2,24}$/;

/** A TikTok handle from whatever the admin pasted ("@kimbia", "kimbia", a profile link), or null. */
export function cleanHandle(raw) {
  let s = String(raw ?? '').trim();
  const fromUrl = s.match(/tiktok\.com\/@([^/?#\s]+)/i);
  if (fromUrl) s = fromUrl[1];
  s = s.replace(/^@/, '');
  return HANDLE_RE.test(s) && !/^\.|\.$/.test(s) ? s : null;
}

export async function socialLinks() {
  const db = await getClient();
  const row = (await db.execute("SELECT value FROM meta WHERE key = 'social:tiktok'")).rows[0];
  return { tiktok: row?.value ? String(row.value) : null };
}

/** Admin: sets (or with an empty value, clears) the TikTok handle. */
export async function setSocialLinks(body) {
  const raw = String(body?.tiktok ?? '').trim();
  const db = await getClient();
  if (!raw) {
    await db.execute("DELETE FROM meta WHERE key = 'social:tiktok'");
    return { status: 200, body: { tiktok: null } };
  }
  const handle = cleanHandle(raw);
  if (!handle) return { status: 400, body: { error: 'That is not a TikTok username (letters, numbers, _ and . only).' } };
  await db.execute({
    sql: "INSERT INTO meta (key, value) VALUES ('social:tiktok', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
    args: [handle],
  });
  return { status: 200, body: { tiktok: handle } };
}
