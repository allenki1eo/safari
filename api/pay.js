import { handlePayRequest } from '../server/payments.js';

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

/** The request body exactly as sent: Snippe's webhook signature covers these bytes. */
async function rawBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 16384) throw Object.assign(new Error('too big'), { code: 'TOO_BIG' });
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/** Vercel Node.js function: buying hearts with mobile money, and Snippe's payment webhook. */
export default async function handler(req, res) {
  let raw = '';
  let body;
  if (req.method === 'POST') {
    try {
      raw = await rawBody(req);
      // if the platform already read the stream, fall back to its parsed copy
      if (!raw && req.body != null) raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      body = raw ? JSON.parse(raw) : {};
    } catch {
      return send(res, 400, { error: 'Invalid JSON.' });
    }
  }
  const origin = `https://${req.headers['x-forwarded-host'] || req.headers.host}`;
  const result = await handlePayRequest(req.method, body, {}, { raw, headers: req.headers, origin });
  send(res, result.status, result.body);
}
