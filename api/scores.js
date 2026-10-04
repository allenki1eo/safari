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
  const result = await handleScoreRequest(req.method, req.body);
  send(res, result.status, result.body);
}
