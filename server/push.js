/**
 * Notifications that bring players back: a come-back nudge in the evening, prize news in the
 * morning, and word from friend challenges the moment it happens.
 *
 * Web push needs a VAPID key pair on the server (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY; the
 * admin page can make one). Without it, nothing is offered and nothing is sent. The two daily
 * jobs run from Vercel Cron (vercel.json); when CRON_SECRET is set, only Vercel can run them,
 * and either way each player hears at most once a day and about each prize once.
 */
import webpush from 'web-push';
import { timingSafeEqual } from 'node:crypto';
import { PRIZES } from '../app/data/content.js';
import { darDay } from '../app/data/daily.js';
import { TOKEN_RE, fail, getClient, hashToken, now, playerIdForToken } from './leaderboard.js';
import { settlePrizes } from './prizes.js';
import { inboxFor, postInbox } from './inbox.js';

const ENDPOINT_MAX = 1024;
const KEY_RE = /^[A-Za-z0-9_-]{16,200}={0,2}$/;
const MAX_FAILS = 5;
const SEND_TIMEOUT = 4000;

export function pushKeys() {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  return publicKey && privateKey ? { publicKey, privateKey } : null;
}

/** Delivers one notification. Tests swap this out; production uses web-push. */
const webSender = async (sub, payload) => {
  const keys = pushKeys();
  if (!keys) return;
  await webpush.sendNotification(
    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
    JSON.stringify(payload),
    {
      TTL: 12 * 60 * 60,
      urgency: payload.urgency ?? 'normal',
      vapidDetails: { subject: process.env.VAPID_SUBJECT?.trim() || 'https://safari-blush.vercel.app', ...keys },
      timeout: SEND_TIMEOUT,
    },
  );
};
let sender = webSender;
/** Tests capture notifications instead of sending them; `null` restores the real sender. */
export function setPushSender(fn) {
  sender = fn ?? webSender;
}

/* ------------------------------------------------------------------ text */
const fmt = (n) => Math.floor(Number(n) || 0).toLocaleString('en-US');
const TEXT = {
  en: {
    raceTitle: '🏁 Today’s board closes at midnight',
    raceLead: '{leader} leads with {score}. #1 wins {prize} seeds — can you catch them?',
    raceOpen: 'Nobody has run today yet. Grab the top spot and {prize} seeds.',
    missTitle: '🦁 The savanna misses you',
    missBody: 'Your best is {best}. Lace up and beat it — today’s #1 wins {prize} seeds.',
    missNew: 'Zuri is waiting at the Serengeti. One quick run?',
    prizeTitle: '🏆 You won {total} seeds!',
    prizeOne: 'You finished {place} on the {board} board. Open Kimbia to collect.',
    prizeMany: '{count} prizes from the leaderboards are waiting. Open Kimbia to collect.',
    takenTitle: '🎯 Bet taken!',
    takenBody: '{name} took your {stake}-seed bet and is racing your shadow now.',
    wonTitle: '🏆 {name} couldn’t beat you!',
    wonBody: 'You kept your crown — {pot} seeds are yours. Open Kimbia to collect.',
    lostTitle: '😬 {name} beat your challenge',
    lostBody: '{score} beat your run and took the {pot}-seed pot. Run it back?',
    testTitle: '🔔 Notifications are on',
    testBody: 'This is how Kimbia! will tell you about prizes and challenges.',
    board: { day: 'daily', week: 'weekly', month: 'monthly' },
    place: (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`,
  },
  sw: {
    raceTitle: '🏁 Ubao wa leo unafungwa saa sita usiku',
    raceLead: '{leader} anaongoza kwa {score}. Wa 1 anashinda mbegu {prize} — utamfikia?',
    raceOpen: 'Bado hakuna aliyekimbia leo. Chukua nafasi ya kwanza na mbegu {prize}.',
    missTitle: '🦁 Savana inakukumbuka',
    missBody: 'Rekodi yako ni {best}. Kimbia uivunje — wa 1 leo anashinda mbegu {prize}.',
    missNew: 'Zuri anakusubiri Serengeti. Mbio moja fupi?',
    prizeTitle: '🏆 Umeshinda mbegu {total}!',
    prizeOne: 'Umemaliza {place} kwenye ubao wa {board}. Fungua Kimbia uchukue.',
    prizeMany: 'Zawadi {count} kutoka kwenye mbao zinakusubiri. Fungua Kimbia uchukue.',
    takenTitle: '🎯 Dau limekubaliwa!',
    takenBody: '{name} amekubali dau lako la mbegu {stake} na anakimbia dhidi ya kivuli chako sasa.',
    wonTitle: '🏆 {name} hakukushinda!',
    wonBody: 'Bado wewe ni bingwa — mbegu {pot} ni zako. Fungua Kimbia uchukue.',
    lostTitle: '😬 {name} ameshinda changamoto yako',
    lostBody: '{score} imeshinda mbio zako na kuchukua mbegu {pot}. Jaribu tena?',
    testTitle: '🔔 Arifa zimewashwa',
    testBody: 'Hivi ndivyo Kimbia! itakavyokuambia kuhusu zawadi na changamoto.',
    board: { day: 'siku', week: 'wiki', month: 'mwezi' },
    place: (n) => `nafasi ya ${n}`,
  },
};
const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
const text = (lang) => TEXT[lang] ?? TEXT.en;

/* ------------------------------------------------------------- delivery */
async function deliver(db, sub, payload) {
  try {
    await Promise.race([
      sender(sub, payload),
      new Promise((_, reject) => setTimeout(() => reject(Object.assign(new Error('push timed out'), { statusCode: 0 })), SEND_TIMEOUT + 500)),
    ]);
    if (Number(sub.fails)) await db.execute({ sql: 'UPDATE push_subs SET fails = 0 WHERE endpoint = ?', args: [sub.endpoint] });
    return true;
  } catch (err) {
    const gone = err?.statusCode === 404 || err?.statusCode === 410;
    if (gone || Number(sub.fails) + 1 >= MAX_FAILS) {
      await db.execute({ sql: 'DELETE FROM push_subs WHERE endpoint = ?', args: [sub.endpoint] });
    } else {
      await db.execute({ sql: 'UPDATE push_subs SET fails = fails + 1 WHERE endpoint = ?', args: [sub.endpoint] });
    }
    return false;
  }
}

/** Every browser that belongs to this runner. */
async function subsForPlayer(db, playerId) {
  return (await db.execute({
    sql: `SELECT * FROM push_subs WHERE token_hash IN (
            SELECT token_hash FROM players WHERE id = ? AND token_hash IS NOT NULL
            UNION SELECT token_hash FROM player_keys WHERE player_id = ?)`,
    args: [playerId, playerId],
  })).rows;
}

async function subsForTokenHash(db, th) {
  const id = await playerIdForToken(db, th);
  if (id != null) return subsForPlayer(db, id);
  return (await db.execute({ sql: 'SELECT * FROM push_subs WHERE token_hash = ?', args: [th] })).rows;
}

/** Sends `build(text)` to each browser in its own language. Never throws. */
async function tell(db, subs, build) {
  let sent = 0;
  for (const sub of subs) {
    if (await deliver(db, sub, build(text(String(sub.lang))))) sent++;
  }
  return sent;
}

/** Admin: one message to every browser that has notifications on. Returns how many took it. */
export async function broadcast(db, build) {
  const subs = (await db.execute('SELECT * FROM push_subs')).rows;
  return { devices: subs.length, sent: await tell(db, subs, build) };
}

/* ------------------------------------------------------- challenge news */
/** A friend took your bet. Called from the challenge handlers; quiet on any failure. */
export async function notifyBetTaken(db, hostHash, { name, stake, id }) {
  const hostId = await playerIdForToken(db, hostHash).catch(() => null);
  if (hostId != null) await postInbox(db, hostId, 'bet-taken', { name, stake }, `bet-taken:${id}`);
  if (!pushKeys()) return;
  try {
    await tell(db, await subsForTokenHash(db, hostHash), (T) => ({
      title: T.takenTitle,
      body: fill(T.takenBody, { name, stake: fmt(stake) }),
      tag: `bet-${id}`,
      url: '/',
    }));
  } catch (err) {
    console.error('push:', err?.message || err);
  }
}

/** A friend finished your challenge: tell the host who won. */
export async function notifyBetSettled(db, hostHash, { name, winner, score, pot, id }) {
  const hostId = await playerIdForToken(db, hostHash).catch(() => null);
  if (hostId != null) {
    await postInbox(db, hostId, winner === 'rival' ? 'bet-lost' : 'bet-won', { name, score, pot }, `bet-settled:${id}`);
  }
  if (!pushKeys()) return;
  try {
    await tell(db, await subsForTokenHash(db, hostHash), (T) => winner === 'rival'
      ? { title: fill(T.lostTitle, { name }), body: fill(T.lostBody, { score: fmt(score), pot: fmt(pot) }), tag: `bet-${id}`, url: '/' }
      : { title: fill(T.wonTitle, { name }), body: fill(T.wonBody, { pot: fmt(pot) }), tag: `bet-${id}`, url: '/', urgency: 'high' });
  } catch (err) {
    console.error('push:', err?.message || err);
  }
}

/* ------------------------------------------------------------ daily jobs */
/** Morning: news of every prize settled overnight that its winner has not collected yet. */
export async function morningJob() {
  const db = await getClient();
  await settlePrizes(db);
  const since = now().getTime() - 3 * 24 * 60 * 60 * 1000;
  const fresh = (await db.execute({
    sql: `SELECT p.id, p.player_id, p.kind, p.rank, p.amount FROM prizes p
          WHERE p.claimed_ms IS NULL AND p.created_ms > ? AND p.amount > 0
            AND NOT EXISTS (SELECT 1 FROM push_sent s WHERE s.key = 'prize:' || p.id)
          ORDER BY p.player_id, p.amount DESC`,
    args: [since],
  })).rows;
  const byPlayer = new Map();
  for (const p of fresh) byPlayer.set(Number(p.player_id), [...(byPlayer.get(Number(p.player_id)) ?? []), p]);
  let sent = 0;
  for (const [playerId, prizes] of byPlayer) {
    const total = prizes.reduce((sum, p) => sum + Number(p.amount), 0);
    const top = prizes[0];
    sent += await tell(db, await subsForPlayer(db, playerId), (T) => ({
      title: fill(T.prizeTitle, { total: fmt(total) }),
      body: prizes.length === 1
        ? fill(T.prizeOne, { place: T.place(Number(top.rank)), board: T.board[String(top.kind)] })
        : fill(T.prizeMany, { count: prizes.length }),
      tag: 'prizes',
      url: '/',
      urgency: 'high',
    }));
    for (const p of prizes) {
      await db.execute({ sql: 'INSERT OR IGNORE INTO push_sent (key, sent_ms) VALUES (?, ?)', args: [`prize:${p.id}`, now().getTime()] });
    }
  }
  return { players: byPlayer.size, sent };
}

/**
 * Should a player who last ran `idle` days ago hear from us today? Every day for the first
 * three, then every third day up to a month, then we stop asking.
 */
export const remindToday = (idle) => idle >= 1 && (idle <= 3 || (idle <= 30 && idle % 3 === 0));

const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

/** Evening: nudge players who have not run today, with today's race as the bait. */
export async function eveningJob() {
  const db = await getClient();
  const today = darDay(now());
  const leader = (await db.execute({
    sql: 'SELECT name, score FROM daily_scores WHERE day = ? AND score > 0 ORDER BY score DESC, id ASC LIMIT 1',
    args: [today],
  })).rows[0];
  const subs = (await db.execute({
    sql: 'SELECT * FROM push_subs WHERE reminded_day IS NULL OR reminded_day <> ?',
    args: [today],
  })).rows;
  const prize = fmt(PRIZES.day[0]);
  let sent = 0;
  for (const sub of subs) {
    const id = await playerIdForToken(db, String(sub.token_hash));
    const player = id == null ? null : (await db.execute({
      sql: `SELECT p.name, p.best_score, (SELECT MAX(day) FROM daily_scores WHERE player_id = p.id) AS last_day
            FROM players p WHERE p.id = ?`,
      args: [id],
    })).rows[0];
    const created = darDay(new Date(Number(sub.created_ms)));
    const lastDay = player?.last_day ? String(player.last_day) : created;
    const idle = daysBetween(lastDay, today);
    if (!remindToday(idle)) continue;
    await db.execute({ sql: 'UPDATE push_subs SET reminded_day = ? WHERE endpoint = ?', args: [today, sub.endpoint] });
    const T = text(String(sub.lang));
    const isLeader = leader && player && String(leader.name) === String(player.name);
    let payload;
    if (idle <= 2 && !isLeader) {
      payload = {
        title: T.raceTitle,
        body: leader ? fill(T.raceLead, { leader: String(leader.name), score: fmt(leader.score), prize }) : fill(T.raceOpen, { prize }),
      };
    } else {
      payload = {
        title: T.missTitle,
        body: player && Number(player.best_score) > 0 ? fill(T.missBody, { best: fmt(player.best_score), prize }) : T.missNew,
      };
    }
    if (await deliver(db, sub, { ...payload, tag: 'reminder', url: '/' })) sent++;
  }
  return { checked: subs.length, sent };
}

/* ---------------------------------------------------------------- routes */
const bad = (error) => ({ status: 400, body: { error } });

function cleanSubscription(raw) {
  const endpoint = raw?.endpoint;
  if (typeof endpoint !== 'string' || endpoint.length > ENDPOINT_MAX || !/^https:\/\/[^\s]+$/.test(endpoint)) return null;
  const { p256dh, auth } = raw?.keys ?? {};
  if (!KEY_RE.test(String(p256dh ?? '')) || !KEY_RE.test(String(auth ?? ''))) return null;
  return { endpoint, p256dh, auth };
}

async function subscribe(body) {
  if (!pushKeys()) return { status: 503, body: { error: 'Notifications are not switched on yet.' } };
  if (typeof body?.token !== 'string' || !TOKEN_RE.test(body.token)) return bad('Player token is missing or invalid.');
  const sub = cleanSubscription(body.subscription);
  if (!sub) return bad('That subscription is not valid.');
  const lang = body.lang === 'sw' ? 'sw' : 'en';
  const db = await getClient();
  await db.execute({
    sql: `INSERT INTO push_subs (endpoint, token_hash, p256dh, auth, lang, created_ms) VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT (endpoint) DO UPDATE SET token_hash = excluded.token_hash, p256dh = excluded.p256dh,
            auth = excluded.auth, lang = excluded.lang, fails = 0`,
    args: [sub.endpoint, hashToken(body.token), sub.p256dh, sub.auth, lang, now().getTime()],
  });
  return { status: 200, body: { ok: true } };
}

async function unsubscribe(body) {
  if (typeof body?.endpoint !== 'string' || body.endpoint.length > ENDPOINT_MAX) return bad('Endpoint is missing.');
  const db = await getClient();
  await db.execute({ sql: 'DELETE FROM push_subs WHERE endpoint = ?', args: [body.endpoint] });
  return { status: 200, body: { ok: true } };
}

function adminOk(given) {
  const key = process.env.KIMBIA_ADMIN_KEY?.trim();
  const g = String(given ?? '');
  return !!key && g.length === key.length && timingSafeEqual(Buffer.from(g), Buffer.from(key));
}

/** Admin: send a test notification to a runner, to check the keys work end to end. */
async function test(body) {
  if (!adminOk(body?.adminKey)) return { status: 403, body: { error: 'Wrong admin key.' } };
  if (!pushKeys()) return { status: 503, body: { error: 'Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY on the server first.' } };
  const db = await getClient();
  const p = (await db.execute({ sql: 'SELECT id, name FROM players WHERE name_key = lower(trim(?))', args: [String(body?.name ?? '')] })).rows[0];
  if (!p) return { status: 404, body: { error: 'No runner has that name.' } };
  const subs = await subsForPlayer(db, Number(p.id));
  const sent = await tell(db, subs, (T) => ({ title: T.testTitle, body: T.testBody, tag: 'test', url: '/' }));
  return { status: 200, body: { name: String(p.name), devices: subs.length, sent } };
}

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET` when that variable is set. */
export function cronAllowed(authorization) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return true; // each job is safe to repeat: once a day per player, once per prize
  const want = `Bearer ${secret}`;
  const got = String(authorization ?? '');
  return got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

export async function runPushJob(job, authorization) {
  try {
    if (!cronAllowed(authorization)) return { status: 401, body: { error: 'Not allowed.' } };
    if (!pushKeys()) return { status: 200, body: { skipped: 'no VAPID keys' } };
    if (job === 'morning') return { status: 200, body: await morningJob() };
    if (job === 'evening') return { status: 200, body: await eveningJob() };
    return bad('Unknown job.');
  } catch (err) {
    return fail(err);
  }
}

export async function handlePushRequest(method, body) {
  try {
    if (method === 'GET') return { status: 200, body: { publicKey: pushKeys()?.publicKey ?? null } };
    if (method !== 'POST') return { status: 405, body: { error: 'Method not allowed.' } };
    switch (body?.action) {
      case 'subscribe': return await subscribe(body);
      case 'unsubscribe': return await unsubscribe(body);
      case 'test': return await test(body);
      case 'inbox': return await inboxFor(body);
      default: return bad('Unknown action.');
    }
  } catch (err) {
    return fail(err);
  }
}

