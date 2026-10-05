import { readFileSync } from 'node:fs';
import { cleanCode, handleTransferRequest, manifestFor } from '../server/transfers.js';

const BASE_MANIFEST = JSON.parse(readFileSync(new URL('../static/manifest.webmanifest', import.meta.url), 'utf8'));

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.statusCode = status;
  res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function parseBody(body) {
  if (body == null || body === '') return {};
  if (typeof body === 'string') return JSON.parse(body);
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(body)) return JSON.parse(body.toString('utf8') || '{}');
  return body;
}

/**
 * Vercel Node.js function for progress codes. `GET ?manifest=CODE` serves the web app manifest
 * with the code in its start URL, for the app Safari adds to the home screen.
 */
export default async function handler(req, res) {
  if (req.method === 'GET') {
    const q = new URLSearchParams((req.url || '').split('?')[1] || '');
    const code = cleanCode(q.get('manifest'));
    if (!code) return send(res, 400, { error: 'Code is not valid.' });
    return send(res, 200, manifestFor(code, BASE_MANIFEST), 'application/manifest+json; charset=utf-8');
  }
  if (req.method === 'POST') {
    try {
      req.body = parseBody(req.body);
    } catch {
      return send(res, 400, { error: 'Invalid JSON.' });
    }
  }
  const result = await handleTransferRequest(req.method, req.body);
  send(res, result.status, result.body);
}
