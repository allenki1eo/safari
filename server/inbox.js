/**
 * The in-game inbox. Everything worth telling a player — a prize won, a friend taking or
 * finishing their bet, an announcement from the game's admin — is written here as well as
 * (when they turned notifications on) pushed to their phone, so players without notifications
 * still see it next time they open the game.
 */
import { TOKEN_RE, getClient, hashToken, now, playerIdForToken } from './leaderboard.js';

export const INBOX_DAYS = 30;
export const INBOX_MAX = 40;
export const KINDS = ['broadcast', 'prize', 'bet-taken', 'bet-won', 'bet-lost', 'ref-joined'];

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

/** Removes one message by its ref (news that has been overtaken). Never throws. */
export async function dropInbox(db, ref) {
  try {
    await db.execute({ sql: 'DELETE FROM inbox WHERE ref = ?', args: [ref] });
  } catch (err) {
    console.error('inbox:', err?.message || err);
  }
}

/** How far this runner has read their inbox, on any device (epoch ms; 0 when never). */
async function seenFor(db, id) {
  if (id == null) return 0;
  const row = (await db.execute({ sql: 'SELECT seen_ms FROM inbox_seen WHERE player_id = ?', args: [id] })).rows[0];
  return row ? Number(row.seen_ms) : 0;
}

/** POST { action: 'inbox-read', token, at }: everything up to `at` has been read. */
export async function inboxRead(body) {
  if (typeof body?.token !== 'string' || !TOKEN_RE.test(body.token)) {
    return { status: 400, body: { error: 'Player token is missing or invalid.' } };
  }
  const at = Math.min(Math.floor(Number(body.at) || 0), now().getTime());
  if (!(at > 0)) return { status: 400, body: { error: 'Read time is not valid.' } };
  const db = await getClient();
  const id = await playerIdForToken(db, hashToken(body.token));
  if (id == null) return { status: 200, body: { seen: 0 } };
  await db.execute({
    sql: `INSERT INTO inbox_seen (player_id, seen_ms) VALUES (?, ?)
          ON CONFLICT(player_id) DO UPDATE SET seen_ms = MAX(seen_ms, excluded.seen_ms)`,
    args: [id, at],
  });
  return { status: 200, body: { seen: await seenFor(db, id) } };
}

/** POST { action: 'inbox', token }: this runner's messages and everyone's, newest first. */
export async function inboxFor(body) {
  if (typeof body?.token !== 'string' || !TOKEN_RE.test(body.token)) {
    return { status: 400, body: { error: 'Player token is missing or invalid.' } };
  }
  const db = await getClient();
  const id = await playerIdForToken(db, hashToken(body.token));
  if (id != null) {
    // lapsed bets settle first, so their results are here and "took your bet" isn't
    const { settleStale } = await import('./challenges.js');
    await settleStale(db);
    // "X took your bet" only stands while the bet is running; once it's settled or lapsed the
    // result message says it all (older rows from before results replaced it are tidied here)
    await db.execute({
      sql: `DELETE FROM inbox WHERE player_id = ? AND kind = 'bet-taken' AND ref IN (
              SELECT 'bet-taken:' || id FROM challenges WHERE status != 'taken')`,
      args: [id],
    });
  }
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
  return { status: 200, body: { messages, seen: await seenFor(db, id) } };
}
