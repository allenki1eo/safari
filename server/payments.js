/**
 * The shop: hearts and seed packs for real money, paid through Snippe payment links
 * (https://docs.snippe.sh/docs/2026-01-25/sessions/payment-links).
 *
 * The admin makes one payment link per pack in the Snippe dashboard and pastes it on the admin
 * page (no API key needed). Buying opens an order and sends the player to that pack's link with
 * the order in its `?meta=` (base64 JSON); Snippe hands it back on the signed `payment.completed`
 * webhook as data.metadata.url_metadata, and that settles the order. With SNIPPE_API_KEY set
 * instead, the server makes a checkout session per order and double-checks each one with Snippe.
 *
 *   buy      opens an order and returns the checkout URL for the pack
 *   order    how an order stands (with an API key, we also ask Snippe, at most every CHECK_GAP)
 *   webhook  Snippe says a payment completed: verified with the webhook signing key
 *            (SNIPPE_WEBHOOK_SECRET), and for the right amount, before anything is paid
 *   wallet   this runner's hearts, and any bought seeds not yet in their bank (collected once)
 *   use      spends one heart on a revive
 *
 * Hearts live here against the runner (they follow a recovered runner to a new phone and can't
 * be edited on the device). An order pays out exactly once: settling flips it from pending to
 * paid in one statement and only the call that wins adds the hearts; seeds are collected the same
 * way. The shop opens once SNIPPE_WEBHOOK_SECRET is set and packs have links (or an API key is set).
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { SHOP_PACKS } from '../app/data/content.js';
import { TOKEN_RE, fail, getClient, hashToken, now, playerIdForToken } from './leaderboard.js';

const API = (process.env.SNIPPE_API_BASE || 'https://api.snippe.sh').replace(/\/$/, '');
// Snippe documents sessions at /api/v1/sessions; payments live at /v1. Try the documented path first.
const SESSION_PATHS = ['/api/v1/sessions', '/v1/sessions'];
const CHECK_GAP = 8000; // Snippe allows 60 requests a minute: ask about one order at most this often
const PENDING_MAX = 4; // open orders per runner within PENDING_WINDOW
const PENDING_WINDOW = 30 * 60 * 1000;
const CHECKOUT_TTL_S = 1800; // a checkout link lasts half an hour
const REPLAY_S = 300; // signed webhooks older than this are refused
const CLOSED = { expired: 'expired', cancelled: 'cancelled', failed: 'failed', voided: 'failed' };

let request = (url, init) => fetch(url, init);
/** Tests swap Snippe for a fake. */
export function setSnippeFetch(fn) {
  request = fn ?? ((url, init) => fetch(url, init));
}

/** The Snippe settings in Vercel: the webhook signing key (needed), and an API key (optional). */
export function payKeys() {
  const key = process.env.SNIPPE_API_KEY?.trim() || null;
  const secret = process.env.SNIPPE_WEBHOOK_SECRET?.trim() || null;
  return key || secret ? { key, secret } : null;
}

/* ---------------------------------------------------------- pack links */
const LINK_HOSTS = /(^|\.)snippe\.(me|sh)$/i;

/** A Snippe payment link the admin pasted, as a clean https URL, or null. */
export function cleanLink(raw) {
  try {
    const url = new URL(String(raw ?? '').trim());
    if (url.protocol !== 'https:' || !LINK_HOSTS.test(url.hostname)) return null;
    url.searchParams.delete('meta');
    return url.toString();
  } catch {
    return null;
  }
}

export async function packLinks(db) {
  const row = (await db.execute("SELECT value FROM meta WHERE key = 'shop:links'")).rows[0];
  try {
    const links = JSON.parse(String(row?.value ?? '{}'));
    return Object.fromEntries(SHOP_PACKS.filter((p) => cleanLink(links[p.id])).map((p) => [p.id, cleanLink(links[p.id])]));
  } catch {
    return {};
  }
}

/** Admin: sets the payment link of each pack (an empty value removes it). */
export async function setPackLinks(db, links) {
  const out = {};
  for (const p of SHOP_PACKS) {
    const raw = String(links?.[p.id] ?? '').trim();
    if (!raw) continue;
    const link = cleanLink(raw);
    if (!link) return { status: 400, body: { error: `The link for ${p.id} is not a Snippe payment link (https://snippe.me/…).` } };
    out[p.id] = link;
  }
  await db.execute({
    sql: "INSERT INTO meta (key, value) VALUES ('shop:links', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
    args: [JSON.stringify(out)],
  });
  return { status: 200, body: { links: out } };
}

/** Which packs can be bought now: those with a link (once webhooks can be verified), or all with an API key. */
async function openPacks(db) {
  const keys = payKeys();
  if (!keys?.secret && !keys?.key) return [];
  if (keys.key) return SHOP_PACKS;
  const links = await packLinks(db);
  return SHOP_PACKS.filter((p) => links[p.id]);
}

/** A pack's link with the order riding along in ?meta= (base64 JSON), as Snippe documents. */
export function linkWithOrder(link, order, pack) {
  const url = new URL(link);
  url.searchParams.set('meta', Buffer.from(JSON.stringify({ order, pack })).toString('base64'));
  return url.toString();
}

const bad = (error, code) => ({ status: 400, body: { error, ...(code ? { code } : {}) } });

async function call(method, path, body) {
  const res = await request(`${API}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${payKeys().key}`,
      accept: 'application/json',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.message || `Snippe answered ${res.status}`), { status: res.status });
  return data.data ?? data;
}

let sessionPath = null; // the path that worked, once one has
async function sessions(method, suffix = '', body) {
  for (const path of sessionPath ? [sessionPath] : SESSION_PATHS) {
    try {
      const out = await call(method, `${path}${suffix}`, body);
      sessionPath = path;
      return out;
    } catch (err) {
      if (err.status !== 404 || sessionPath) throw err;
    }
  }
  throw Object.assign(new Error('Snippe sessions endpoint not found'), { status: 404 });
}

async function playerFor(db, token) {
  if (typeof token !== 'string' || !TOKEN_RE.test(token)) return null;
  return playerIdForToken(db, hashToken(token));
}

async function heartsOf(db, playerId) {
  const row = (await db.execute({ sql: 'SELECT balance FROM hearts WHERE player_id = ?', args: [playerId] })).rows[0];
  return Number(row?.balance ?? 0);
}

/**
 * Settles an order from Snippe's own record of its checkout. Completed, for the right amount, in
 * shillings: the order turns paid (once) and its hearts land. Expired or cancelled: it closes.
 */
async function settle(db, order, session, paymentRef = null) {
  const status = String(session?.status ?? '');
  const amount = Number(session?.amount?.value ?? session?.amount ?? NaN);
  const currency = String(session?.amount?.currency ?? session?.currency ?? 'TZS');
  if (status === 'completed') {
    if (amount !== Number(order.price) || currency !== 'TZS') {
      // paid, but not what this order asked for: leave it for the admin rather than guess
      console.error('payments: amount mismatch on', order.id, amount, currency);
      return 'pending';
    }
    const won = (await db.execute({
      sql: "UPDATE orders SET status = 'paid', paid_ms = ?, payment_ref = ? WHERE id = ? AND status = 'pending' RETURNING player_id, hearts",
      args: [now().getTime(), paymentRef ?? session?.payment_reference ?? null, order.id],
    })).rows[0];
    if (won && Number(won.hearts) > 0) {
      await db.execute({
        sql: `INSERT INTO hearts (player_id, balance, bought) VALUES (?, ?, ?)
              ON CONFLICT (player_id) DO UPDATE SET balance = balance + excluded.balance, bought = bought + excluded.bought`,
        args: [Number(won.player_id), Number(won.hearts), Number(won.hearts)],
      });
    }
    return 'paid';
  }
  const closed = CLOSED[status];
  if (closed) {
    await db.execute({ sql: "UPDATE orders SET status = ? WHERE id = ? AND status = 'pending'", args: [closed, order.id] });
    return closed;
  }
  return 'pending';
}

/** Asks Snippe how a pending order's checkout stands (not more often than CHECK_GAP). */
async function refresh(db, order, force = false) {
  if (String(order.status) !== 'pending' || !order.reference || !payKeys()?.key) return String(order.status);
  const t = now().getTime();
  if (!force && order.checked_ms != null && t - Number(order.checked_ms) < CHECK_GAP) return 'pending';
  await db.execute({ sql: 'UPDATE orders SET checked_ms = ? WHERE id = ?', args: [t, order.id] });
  return settle(db, order, await sessions('GET', `/${encodeURIComponent(String(order.reference))}`));
}

/** GET: whether the shop is open, and the packs on sale. */
async function shop() {
  const packs = await openPacks(await getClient());
  return { status: 200, body: { ready: packs.length > 0, packs } };
}

/** POST { action: 'buy', token, pack, back }: opens an order and its Snippe checkout. */
async function buy(body, ctx) {
  const db = await getClient();
  const packs = await openPacks(db);
  if (!packs.length) return { status: 503, body: { error: 'The shop is not open yet.' } };
  const pack = packs.find((p) => p.id === body?.pack);
  if (!pack) return bad('Pick a pack.');
  const id = await playerFor(db, body?.token);
  if (id == null) return { status: 409, body: { error: 'Pick your runner name first.', code: 'NAME_FIRST' } };
  const t = now().getTime();
  const open = (await db.execute({
    sql: "SELECT COUNT(*) AS n FROM orders WHERE player_id = ? AND status = 'pending' AND created_ms > ?",
    args: [id, t - PENDING_WINDOW],
  })).rows[0];
  if (Number(open?.n ?? 0) >= PENDING_MAX) {
    return { status: 429, body: { error: 'You have checkouts waiting. Finish or wait for them to expire first.', code: 'TOO_MANY' } };
  }
  const name = String((await db.execute({ sql: 'SELECT name FROM players WHERE id = ?', args: [id] })).rows[0]?.name ?? 'Runner');
  const orderId = `kb${randomBytes(12).toString('hex')}`;
  const origin = ctx?.origin || process.env.PUBLIC_URL || 'https://safari-blush.vercel.app';
  await db.execute({
    sql: `INSERT INTO orders (id, player_id, pack, price, hearts, seeds, status, created_ms) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
    args: [orderId, id, pack.id, pack.price, pack.hearts, pack.seeds, t],
  });
  const what = pack.kind === 'hearts' ? `${pack.hearts} hearts` : `${pack.seeds.toLocaleString('en-US')} seeds`;
  const link = (await packLinks(db))[pack.id];
  if (link) {
    // the admin's payment link for this pack, carrying the order back to us on the webhook
    const url = linkWithOrder(link, orderId, pack.id);
    await db.execute({ sql: 'UPDATE orders SET checkout_url = ? WHERE id = ?', args: [url, orderId] });
    return { status: 200, body: { order: orderId, url, price: pack.price } };
  }
  try {
    const session = await sessions('POST', '', {
      amount: pack.price,
      currency: 'TZS',
      allowed_methods: ['mobile_money'],
      customer: { name: name.slice(0, 200) },
      redirect_url: `${origin}/?paid=${orderId}`,
      webhook_url: `${origin}/api/pay`,
      description: `KIMBIA! · ${what} for ${name}`.slice(0, 500),
      metadata: { order: orderId, player: id, pack: pack.id },
      expires_in: CHECKOUT_TTL_S,
    });
    const url = session?.checkout_url ?? session?.payment_link_url;
    if (!session?.reference || !url) throw new Error('Snippe returned no checkout');
    await db.execute({ sql: 'UPDATE orders SET reference = ?, checkout_url = ? WHERE id = ?', args: [String(session.reference), String(url), orderId] });
    return { status: 200, body: { order: orderId, url: String(url), price: pack.price } };
  } catch (err) {
    console.error('payments: checkout failed:', err?.message || err);
    await db.execute({ sql: "UPDATE orders SET status = 'failed' WHERE id = ?", args: [orderId] });
    return { status: 502, body: { error: "Couldn't open the checkout just now. Nothing was charged — try again." } };
  }
}

/** Bought seeds not yet in the bank: marks them collected and returns the total (once). */
async function collectSeeds(db, playerId) {
  const rows = (await db.execute({
    sql: `UPDATE orders SET claimed_ms = ? WHERE player_id = ? AND status = 'paid' AND seeds > 0 AND claimed_ms IS NULL
          RETURNING seeds`,
    args: [now().getTime(), playerId],
  })).rows;
  return rows.reduce((sum, r) => sum + Number(r.seeds), 0);
}

/** POST { action: 'wallet', token }: hearts, and bought seeds to bank now. */
async function wallet(body) {
  const db = await getClient();
  const id = await playerFor(db, body?.token);
  const ready = (await openPacks(db)).length > 0;
  if (id == null) return { status: 200, body: { hearts: 0, seeds: 0, ready } };
  return { status: 200, body: { hearts: await heartsOf(db, id), seeds: await collectSeeds(db, id), ready } };
}

/** POST { action: 'order', token, order }: how an order stands; once paid, its hearts and seeds. */
async function order(body) {
  const db = await getClient();
  const id = await playerFor(db, body?.token);
  const row = id == null ? null : (await db.execute({
    sql: 'SELECT * FROM orders WHERE id = ? AND player_id = ?',
    args: [String(body?.order ?? ''), id],
  })).rows[0];
  if (!row) return { status: 404, body: { error: 'No such order.' } };
  let status = String(row.status);
  try {
    status = await refresh(db, row);
  } catch (err) {
    console.error('payments: status check failed:', err?.message || err);
  }
  const paid = status === 'paid';
  return {
    status: 200,
    body: { order: String(row.id), status, pack: String(row.pack), hearts: await heartsOf(db, id), seeds: paid ? await collectSeeds(db, id) : 0, url: row.checkout_url ? String(row.checkout_url) : null },
  };
}

/** POST { action: 'use', token }: spends one heart on a revive. */
async function use(body) {
  const db = await getClient();
  const id = await playerFor(db, body?.token);
  const row = id == null ? null : (await db.execute({
    sql: 'UPDATE hearts SET balance = balance - 1, used = used + 1 WHERE player_id = ? AND balance > 0 RETURNING balance',
    args: [id],
  })).rows[0];
  if (!row) return { status: 409, body: { error: 'No hearts left.', code: 'NO_HEARTS', hearts: 0 } };
  return { status: 200, body: { ok: true, hearts: Number(row.balance) } };
}

/* -------------------------------------------------------------- webhook */
const safeEqual = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * Snippe signs `{timestamp}.{body}` with HMAC-SHA256 (hex). Older senders signed the body alone,
 * sometimes as "sha256=<hex>"; any of those, with a fresh timestamp, passes.
 */
export function webhookSignatureOk(raw, headers, secret, nowS = Math.floor(now().getTime() / 1000)) {
  const sig = String(headers['x-webhook-signature'] ?? '').trim().replace(/^sha256=/i, '').toLowerCase();
  const ts = String(headers['x-webhook-timestamp'] ?? '').trim();
  if (!sig || !/^\d+$/.test(ts) || Math.abs(nowS - Number(ts)) > REPLAY_S) return false;
  const mac = (msg) => createHmac('sha256', secret).update(msg).digest('hex');
  return safeEqual(sig, mac(`${ts}.${raw}`)) || safeEqual(sig, mac(raw));
}

/** The order a payment was for: the link's ?meta= (url_metadata), a session's metadata, or its session. */
function orderIn(data) {
  const meta = data?.metadata ?? {};
  let url = meta.url_metadata ?? {};
  if (typeof url === 'string') {
    try {
      url = JSON.parse(Buffer.from(url, 'base64').toString('utf8'));
    } catch {
      url = {};
    }
  }
  return String(url.order ?? meta.order ?? '');
}

async function webhook(raw, headers) {
  const keys = payKeys();
  // without the signing key nobody can tell a real payment from a forged one: refuse them all
  if (!keys?.secret) return { status: 503, body: { error: 'Set SNIPPE_WEBHOOK_SECRET to accept payments.' } };
  if (!webhookSignatureOk(raw, headers, keys.secret)) return { status: 401, body: { error: 'Bad signature.' } };
  let event = {};
  try {
    event = JSON.parse(raw || '{}');
  } catch {
    return { status: 400, body: { error: 'Invalid JSON.' } };
  }
  const type = String(headers['x-webhook-event'] ?? event.type ?? '');
  if (type !== 'payment.completed') return { status: 200, body: { ok: true } }; // failures and payouts change nothing here
  const data = event.data ?? {};
  const db = await getClient();
  const orderId = orderIn(data);
  const amount = Number(data.amount?.value ?? data.amount ?? 0);
  // every payment once, so a retried webhook is a no-op and unmatched ones reach the admin
  const reference = String(data.reference ?? event.id ?? '');
  if (reference) {
    await db.execute({
      sql: 'INSERT OR IGNORE INTO payments_in (reference, order_id, amount, phone, created_ms) VALUES (?, ?, ?, ?, ?)',
      args: [reference, orderId || null, amount, data.customer?.phone ? String(data.customer.phone).replace(/\d(?=\d{3})/g, '•') : null, now().getTime()],
    });
  }
  const row = (await db.execute({
    sql: 'SELECT * FROM orders WHERE id = ? OR (reference IS NOT NULL AND reference = ?) LIMIT 1',
    args: [orderId, String(data.session_reference ?? '')],
  })).rows[0];
  if (!row) return { status: 200, body: { ok: true, matched: false } }; // not one of ours: don't make Snippe retry
  // with an API key, ask Snippe about the checkout itself; otherwise the signed message is the proof
  const status = keys.key && row.reference ? await refresh(db, row, true) : await settle(db, row, data, reference || null);
  if (status === 'paid' && reference) {
    await db.execute({ sql: 'UPDATE orders SET payment_ref = COALESCE(payment_ref, ?) WHERE id = ?', args: [reference, row.id] });
  }
  return { status: 200, body: { ok: true, status } };
}

/* ---------------------------------------------------------------- admin */
export async function salesSummary(db, dayStartMs) {
  const row = (await db.execute({
    sql: `SELECT COUNT(*) AS orders,
                 COALESCE(SUM(CASE WHEN status = 'paid' THEN 1 END), 0) AS paid,
                 COALESCE(SUM(CASE WHEN status = 'paid' THEN price END), 0) AS revenue,
                 COALESCE(SUM(CASE WHEN status = 'paid' AND paid_ms >= ? THEN price END), 0) AS today
          FROM orders`,
    args: [dayStartMs],
  })).rows[0] ?? {};
  return { orders: Number(row.orders ?? 0), paid: Number(row.paid ?? 0), revenue: Number(row.revenue ?? 0), today: Number(row.today ?? 0) };
}

/** Payments Snippe reported that no order claimed (a link opened without the game, say). */
export async function unmatchedPayments(db) {
  return (await db.execute(`SELECT p.reference, p.amount, p.phone, p.created_ms FROM payments_in p
                            LEFT JOIN orders o ON o.payment_ref = p.reference AND o.status = 'paid'
                            WHERE o.id IS NULL ORDER BY p.created_ms DESC LIMIT 20`)).rows.map((r) => ({
    reference: String(r.reference), amount: Number(r.amount), phone: r.phone == null ? '' : String(r.phone), at: Number(r.created_ms),
  }));
}

export async function recentOrders(db) {
  return (await db.execute(`SELECT o.id, o.pack, o.price, o.hearts, o.seeds, o.status, o.created_ms, o.paid_ms, p.name
                            FROM orders o LEFT JOIN players p ON p.id = o.player_id
                            ORDER BY o.created_ms DESC LIMIT 40`)).rows.map((r) => ({
    id: String(r.id), name: r.name == null ? '?' : String(r.name), pack: String(r.pack), price: Number(r.price),
    hearts: Number(r.hearts), seeds: Number(r.seeds), status: String(r.status), at: Number(r.created_ms),
  }));
}

/** `ctx` carries the raw body and headers (for the webhook) and the site's origin. */
export async function handlePayRequest(method, body, query, ctx = {}) {
  try {
    if (method === 'GET') return await shop();
    if (method !== 'POST') return { status: 405, body: { error: 'Method not allowed.' } };
    const headers = ctx.headers ?? {};
    if (headers['x-webhook-event'] || headers['x-webhook-signature']) return await webhook(ctx.raw ?? JSON.stringify(body ?? {}), headers);
    switch (body?.action) {
      case 'wallet': return await wallet(body);
      case 'buy': return await buy(body, ctx);
      case 'order': return await order(body);
      case 'use': return await use(body);
      default: return bad('Unknown action.');
    }
  } catch (err) {
    return fail(err);
  }
}
