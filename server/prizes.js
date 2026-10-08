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

export const KINDS = ['day', 'week', 'month'];
// closed periods looked back over on each settle, so a quiet night still pays out
const LOOKBACK = { day: 7, week: 3, month: 2 };
// fastest believable pace, m/s (top speed with every boost is under 80)
const MAX_PACE = 90;

/** A run counts for prizes when it reports a real distance and a believable pace. */
const fair = (t) => `${t}.score > 0 AND ${t}.duration > 0 AND ${t}.distance <= ${t}.duration * ${MAX_PACE}`;

/** Best run per player across the period's days, best first; ties go to whoever got there first. */
async function periodTop(db, kind, period, limit = TOP_LIMIT) {
  const [from, to] = periodDays(kind, period);
  const result = await db.execute({
    sql: `SELECT d.player_id, d.id, d.name, d.score, d.distance, d.seeds, d.allies, d.chapter, d.runner
          FROM daily_scores d
          WHERE d.day BETWEEN ? AND ? AND ${fair('d')}
            AND d.id = (
              SELECT d2.id FROM daily_scores d2
              WHERE d2.player_id = d.player_id AND d2.day BETWEEN ? AND ? AND ${fair('d2')}
              ORDER BY d2.score DESC, d2.id ASC LIMIT 1
            )
          ORDER BY d.score DESC, d.id ASC
          LIMIT ?`,
    args: [from, to, from, to, limit],
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

/** Writes the prize lists of every recently closed period that has not been paid yet. */
export async function settlePrizes(db) {
  const t = now().getTime();
  const today = darDay(now());
  for (const kind of KINDS) {
    let period = periodOf(kind, today);
    for (let i = 0; i < LOOKBACK[kind]; i++) {
      period = previousPeriod(kind, period);
      if (periodEnd(kind, period) > t) continue;
      const mark = `prizes:${kind}:${period}`;
      const done = await db.execute({ sql: 'SELECT 1 FROM meta WHERE key = ?', args: [mark] });
      if (done.rows.length) continue;
      const winners = await periodTop(db, kind, period, PRIZES[kind].length);
      for (const w of winners) {
        await db.execute({
          sql: `INSERT OR IGNORE INTO prizes (kind, period, rank, player_id, name, runner, score, amount, created_ms)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [kind, period, w.rank, w.id, w.name, w.runner, w.score, w.prize, t],
        });
      }
      await db.execute({ sql: 'INSERT OR IGNORE INTO meta (key, value) VALUES (?, ?)', args: [mark, String(t)] });
    }
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
