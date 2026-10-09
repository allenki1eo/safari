/**
 * The in-game inbox. Everything worth telling a player — a prize won, a friend taking or
 * finishing their bet, an announcement from the game's admin — is written here as well as
 * (when they turned notifications on) pushed to their phone, so players without notifications
 * still see it next time they open the game.
 */
import { TOKEN_RE, getClient, hashToken, now, playerIdForToken } from './leaderboard.js';

export const INBOX_DAYS = 30;
export const INBOX_MAX = 40;
export const KINDS = ['broadcast', 'prize', 'bet-taken', 'bet-won', 'bet-lost'];

/** Writes one message: to a runner, or to everyone when `playerId` is null. Never throws. */
export async function postInbox(db, playerId, kind, data, ref = null) {
  try {
    await db.execute({
      sql: 'INSERT OR IGNORE INTO inbox (player_id, kind, data, ref, created_ms) VALUES (?, ?, ?, ?, ?)',
      args: [playerId, kind, JSON.stringify(data ?? {}), ref, now().getTime()],
    });
  } catch (err) {
    console.error('inbox:', err?.message || err);
  }
}

/** POST { action: 'inbox', token }: this runner's messages and everyone's, newest first. */
export async function inboxFor(body) {
  if (typeof body?.token !== 'string' || !TOKEN_RE.test(body.token)) {
    return { status: 400, body: { error: 'Player token is missing or invalid.' } };
  }
  const db = await getClient();
  const id = await playerIdForToken(db, hashToken(body.token));
  const since = now().getTime() - INBOX_DAYS * 24 * 60 * 60 * 1000;
  const rows = (await db.execute({
    sql: `SELECT id, kind, data, created_ms FROM inbox
          WHERE created_ms > ? AND (player_id IS NULL OR player_id = ?)
          ORDER BY created_ms DESC, id DESC LIMIT ?`,
    args: [since, id ?? -1, INBOX_MAX],
  })).rows;
  const messages = rows.map((r) => {
    let data = {};
    try {
      data = JSON.parse(String(r.data));
    } catch {
      /* keep it empty */
    }
    return { id: Number(r.id), kind: String(r.kind), data, at: Number(r.created_ms) };
  });
  return { status: 200, body: { messages } };
}
