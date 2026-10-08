import { handlePushRequest } from '../server/push.js';

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

/** Vercel Node.js function: the public key for notifications, and subscribing to them. */
export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      req.body = parseBody(req.body);
    } catch {
      return send(res, 400, { error: 'Invalid JSON.' });
    }
  }
  const result = await handlePushRequest(req.method, req.body);
  send(res, result.status, result.body);
}

function queryOf(req) {
  const query = { ...(req.query || {}) };
  const raw = req.url || '';
  const q = raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : '';
  for (const [key, value] of new URLSearchParams(q)) query[key] = value;
  return query;
}
