import { handleScoreRequest } from './leaderboard.js';
import { readFileSync } from 'node:fs';
import { handleChallengeRequest } from './challenges.js';
import { handleAccountRequest } from './accounts.js';
import { handlePushRequest, runPushJob } from './push.js';
import { handleAdminRequest } from './admin.js';
import { cleanCode, handleTransferRequest, manifestFor } from './transfers.js';
import { handlePayRequest } from './payments.js';

/** Dev twin of api/transfer.js: GET ?manifest=CODE serves the manifest with the code in it. */
function transferRoute(method, body, query) {
  if (method === 'GET') {
    const code = cleanCode(query?.manifest);
    if (!code) return { status: 400, body: { error: 'Code is not valid.' } };
    const base = JSON.parse(readFileSync(new URL('../static/manifest.webmanifest', import.meta.url), 'utf8'));
    return { status: 200, body: manifestFor(code, base) };
  }
  return handleTransferRequest(method, body);
}

const ROUTES = { '/api/scores': handleScoreRequest, '/api/challenges': handleChallengeRequest, '/api/transfer': transferRoute, '/api/account': handleAccountRequest,
  '/api/push': handlePushRequest,
  '/api/admin': handleAdminRequest,
  '/api/pay': handlePayRequest,
  '/api/cron/morning': () => runPushJob('morning'),
  '/api/cron/evening': () => runPushJob('evening'),
};
// a challenge carries its shadow-runner recording, so it may be bigger than a score
const LIMITS = { '/api/scores': 4096, '/api/challenges': 65536, '/api/transfer': 40960, '/api/account': 40960, '/api/push': 4096, '/api/admin': 4096, '/api/pay': 16384 };

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function readRaw(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) {
      const err = new Error('body too large');
      err.code = 'TOO_BIG';
      throw err;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8').trim();
}

async function scoresMiddleware(req, res, next) {
  const path = (req.url || '').split('?')[0];
  const handle = ROUTES[path];
  if (!handle) return next();
  try {
    const raw = req.method === 'POST' ? await readRaw(req, LIMITS[path]) : '';
    const body = req.method === 'POST' ? (raw ? JSON.parse(raw) : {}) : undefined;
    const query = Object.fromEntries(new URLSearchParams((req.url || '').split('?')[1] || ''));
    // the payment webhook checks its signature against the raw body
    const result = await handle(req.method, body, query, { raw, headers: req.headers, origin: `http://${req.headers.host}` });
    send(res, result.status, result.body);
  } catch (err) {
    if (err?.code === 'TOO_BIG' || err instanceof SyntaxError) {
      send(res, 400, { error: 'Invalid JSON.' });
      return;
    }
    console.error('leaderboard:', err?.message || err);
    send(res, 500, { error: 'The leaderboard is unavailable.' });
  }
}

/** Serves /api/scores and /api/challenges from `vite` and `vite preview` with the same handlers as Vercel. */
export function leaderboardPlugin() {
  const attach = (server) => {
    server.middlewares.use(scoresMiddleware);
  };
  return {
    name: 'kimbia-leaderboard',
    configureServer: attach,
    configurePreviewServer: attach,
  };
}
