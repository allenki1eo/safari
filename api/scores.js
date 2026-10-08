import { handleScoreRequest } from '../server/leaderboard.js';

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function parseBody(body) {
  if (body == null || body === '') return {};
  if (typeof body === 'string') return JSON.parse(body);
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(body)) return JSON.parse(body.toString('utf8') || '{}');
  return body;
}

/** Vercel Node.js function. The Turso token stays in this process. */
export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      req.body = parseBody(req.body);
    } catch {
      return send(res, 400, { error: 'Invalid JSON.' });
    }
  }
  const query = queryOf(req);
  const result = await handleScoreRequest(req.method, req.body, query);
  // Boards are the same for everyone: Vercel's CDN answers repeat reads for a few seconds, so a
  // rush of players opening the leaderboard costs one database read, not one each.
  if (req.method === 'GET' && result.status === 200) res.setHeader('Vercel-CDN-Cache-Control', 'max-age=5');
  send(res, result.status, result.body);
}

function queryOf(req) {
  const query = { ...(req.query || {}) };
  const raw = req.url || '';
  const q = raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : '';
  for (const [key, value] of new URLSearchParams(q)) query[key] = value;
  return query;
}
