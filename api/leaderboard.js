/**
 * KIMBIA! leaderboard — a Vercel serverless function in front of Supabase.
 *
 *   GET  /api/leaderboard?period=week|all   → { entries: [...] }
 *   POST /api/leaderboard  { name, score, distance, seeds, runner, duration }
 *                                           → { ok, rank, period: 'week' }
 *
 * Env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (server-only, recommended so inserts can't bypass
 * the checks below). SUPABASE_ANON_KEY works too; VITE_-prefixed names are accepted.
 * Table: safari_leaderboard(id, player_name, score, distance, coins, character_id, created_at).
 * Without configuration it answers 503 and the game shows "coming soon".
 */

const URL_ = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const TABLE = 'safari_leaderboard';
const RUNNERS = new Set(['zuri', 'juma', 'neema', 'baraka', 'amani', 'kito']);

// best-effort per-instance rate limit: one submission per IP every 10s
const recent = new Map();

function weekStart() {
  const d = new Date();
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString();
}

function headers(extra = {}) {
  return { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', ...extra };
}

export function cleanName(raw) {
  const s = String(raw ?? '').normalize('NFKC').replace(/[^\p{L}\p{N} _.\-']/gu, '').trim().slice(0, 16);
  return s.length >= 2 ? s : null;
}

/** Rejects scores the game physically can't produce. */
export function plausible({ score, distance, seeds, duration }) {
  if (![score, distance, seeds, duration].every((n) => Number.isFinite(n) && n >= 0)) return false;
  if (distance > 60000 || seeds > distance * 1.5 + 50) return false;
  if (duration < 3 || distance / duration > 75) return false; // top speed is ~63 m/s with Duma
  // points: ≤ 30× multiplier, ×2 lion, plus seeds/combos/near-miss bonuses
  const ceiling = distance * 60 + seeds * 300 + 400000;
  return score <= ceiling;
}

async function top(period) {
  const q = new URLSearchParams({ select: 'player_name,score,distance,character_id,created_at', order: 'score.desc', limit: '200' });
  if (period === 'week') q.append('created_at', `gte.${weekStart()}`);
  const r = await fetch(`${URL_}/rest/v1/${TABLE}?${q}`, { headers: headers() });
  if (!r.ok) throw new Error(`supabase ${r.status}`);
  const rows = await r.json();
  // one row per player — their best
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const k = row.player_name.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ name: row.player_name, score: row.score, distance: row.distance, runner: row.character_id });
    if (out.length >= 50) break;
  }
  return out;
}

async function rankFor(score) {
  const q = new URLSearchParams({ select: 'id', score: `gt.${score}`, created_at: `gte.${weekStart()}` });
  const r = await fetch(`${URL_}/rest/v1/${TABLE}?${q}`, { headers: headers({ Prefer: 'count=exact', Range: '0-0' }) });
  const total = Number((r.headers.get('content-range') || '').split('/')[1]);
  return Number.isFinite(total) ? total + 1 : null;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!URL_ || !KEY) return res.status(503).json({ error: 'leaderboard not configured' });

  try {
    if (req.method === 'GET') {
      const period = req.query?.period === 'all' ? 'all' : 'week';
      res.setHeader('Cache-Control', 's-maxage=20, stale-while-revalidate=60');
      return res.status(200).json({ period, entries: await top(period) });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
      const name = cleanName(body.name);
      const score = Math.floor(Number(body.score));
      const distance = Math.floor(Number(body.distance));
      const seeds = Math.floor(Number(body.seeds));
      const duration = Number(body.duration);
      const runner = RUNNERS.has(body.runner) ? body.runner : 'zuri';
      if (!name) return res.status(400).json({ error: 'name must be 2–16 letters or numbers' });
      if (!plausible({ score, distance, seeds, duration })) return res.status(422).json({ error: 'score rejected' });

      const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'anon';
      const now = Date.now();
      if (now - (recent.get(ip) ?? 0) < 10000) return res.status(429).json({ error: 'slow down' });
      recent.set(ip, now);
      if (recent.size > 5000) recent.clear();

      const ins = await fetch(`${URL_}/rest/v1/${TABLE}`, {
        method: 'POST',
        headers: headers({ Prefer: 'return=minimal' }),
        body: JSON.stringify({ player_name: name, score, distance, coins: seeds, character_id: runner }),
      });
      if (!ins.ok) return res.status(502).json({ error: 'could not save score' });
      return res.status(200).json({ ok: true, period: 'week', rank: await rankFor(score) });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    return res.status(502).json({ error: 'leaderboard unavailable' });
  }
}
