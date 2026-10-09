/**
 * Day, week and month prize boards.
 *
 * A period's board is every player's single best run in it, read straight from daily_scores
 * (one row per player per Dar day). When a period closes, the first request that comes along
 * writes its top ten into `prizes`; each winner collects on their next visit, on whichever
 * device holds a key to their runner. Settling is idempotent: the unique keys on `prizes`
 * make a second, racing settle a no-op.
 */
import { PRIZES } from '../app/data/content.js';
import { darDay, periodDays, periodEnd, periodOf, previousPeriod } from '../app/data/daily.js';
import { TOKEN_RE, TOP_LIMIT, getClient, hashToken, now, playerIdForToken } from './leaderboard.js';
import { postInbox } from './inbox.js';
import { fairRunSql, prizeScoreSql } from './plausible.js';

export const KINDS = ['day', 'week', 'month'];
// closed periods looked back over on each settle, so a quiet night still pays out
const LOOKBACK = { day: 7, week: 3, month: 2 };
// A run counts for prizes only when it passes the same checks as the score route
// (server/plausible.js), and its multiplier counts up to PRIZE_MULT_CAP.

/**
 * Best run per player across the period's days, best first; ties go to whoever got there first.
 * One pass over the period's rows (a window ranks each player's runs), so a month of boards
 * costs about as much as a day.
 */
async function periodTop(db, kind, period, limit = TOP_LIMIT) {
  const [from, to] = periodDays(kind, period);
  const result = await db.execute({
    sql: `SELECT player_id, id, name, pscore AS score, distance, seeds, allies, chapter, runner FROM (
            SELECT d.*, ${prizeScoreSql('d', 'm')} AS pscore,
                   ROW_NUMBER() OVER (PARTITION BY d.player_id ORDER BY ${prizeScoreSql('d', 'm')} DESC, d.id ASC) AS pick
            FROM daily_scores d
            LEFT JOIN run_meta m ON m.day = d.day AND m.player_id = d.player_id
            WHERE d.day BETWEEN ? AND ? AND ${fairRunSql('d')} AND d.player_id NOT IN (SELECT player_id FROM banned)
          )
          WHERE pick = 1
          ORDER BY score DESC, id ASC
          LIMIT ?`,
    args: [from, to, limit],
  });
  return result.rows.map((row, i) => ({
    id: Number(row.player_id),
    rank: i + 1,
    name: String(row.name),
    score: Number(row.score),
    distance: Number(row.distance),
    seeds: Number(row.seeds),
    allies: Number(row.allies),
    chapter: Number(row.chapter),
    runner: String(row.runner),
    prize: PRIZES[kind][i] ?? 0,
  }));
}

// Periods this server instance already knows are paid, per database client, so the common
// case (everything settled) costs no queries at all.
const settledBy = new WeakMap();

/** Writes the prize lists of every recently closed period that has not been paid yet. */
export async function settlePrizes(db) {
  const t = now().getTime();
  const today = darDay(now());
  const known = settledBy.get(db) ?? new Set();
  settledBy.set(db, known);
  const due = [];
  for (const kind of KINDS) {
    let period = periodOf(kind, today);
    for (let i = 0; i < LOOKBACK[kind]; i++) {
      period = previousPeriod(kind, period);
      const mark = `prizes:${kind}:${period}`;
      if (periodEnd(kind, period) <= t && !known.has(mark)) due.push({ kind, period, mark });
    }
  }
  if (!due.length) return;
  const marks = due.map((d) => d.mark);
  const done = new Set((await db.execute({
    sql: `SELECT key FROM meta WHERE key IN (${marks.map(() => '?').join(', ')})`,
    args: marks,
  })).rows.map((r) => String(r.key)));
  for (const { kind, period, mark } of due) {
    if (!done.has(mark)) {
      const winners = await periodTop(db, kind, period, PRIZES[kind].length);
      if (winners.length) {
        await db.batch(winners.map((w) => ({
          sql: `INSERT OR IGNORE INTO prizes (kind, period, rank, player_id, name, runner, score, amount, created_ms)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [kind, period, w.rank, w.id, w.name, w.runner, w.score, w.prize, t],
        })), 'write');
        for (const w of winners) {
          await postInbox(db, w.id, 'prize', { kind, period, rank: w.rank, amount: w.prize, score: w.score }, `prize:${kind}:${period}:${w.rank}`);
        }
      }
      await db.execute({ sql: 'INSERT OR IGNORE INTO meta (key, value) VALUES (?, ?)', args: [mark, String(t)] });
    }
    known.add(mark);
  }
}

/** Last period's winner, shown wearing the crown on this period's board. */
async function champion(db, kind, period) {
  const row = (await db.execute({
    sql: 'SELECT name, runner, score FROM prizes WHERE kind = ? AND period = ? AND rank = 1',
    args: [kind, previousPeriod(kind, period)],
  })).rows[0];
  return row ? { name: String(row.name), runner: String(row.runner), score: Number(row.score) } : null;
}

/** The live board for this day, week or month, with what each place wins and when it closes. */
export async function prizeBoard(kind) {
  const db = await getClient();
  await settlePrizes(db);
  const period = periodOf(kind, darDay(now()));
  return {
    kind,
    period,
    endsAt: periodEnd(kind, period),
    prizes: PRIZES[kind],
    top: await periodTop(db, kind, period),
    champion: await champion(db, kind, period),
  };
}

/** Hands this player every prize they have won and not collected yet (each only once). */
export async function claimPrizes(body) {
  if (typeof body?.token !== 'string' || !TOKEN_RE.test(body.token)) {
    return { status: 400, body: { error: 'Player token is missing or invalid.' } };
  }
  const db = await getClient();
  await settlePrizes(db);
  const id = await playerIdForToken(db, hashToken(body.token));
  if (id == null) return { status: 200, body: { prizes: [] } };
  const result = await db.execute({
    sql: `UPDATE prizes SET claimed_ms = ? WHERE player_id = ? AND claimed_ms IS NULL
          RETURNING kind, period, rank, score, amount`,
    args: [now().getTime(), id],
  });
  const order = { month: 0, week: 1, day: 2 };
  const prizes = result.rows
    .map((r) => ({ kind: String(r.kind), period: String(r.period), rank: Number(r.rank), score: Number(r.score), amount: Number(r.amount) }))
    .sort((a, b) => order[a.kind] - order[b.kind] || a.rank - b.rank);
  return { status: 200, body: { prizes } };
}
