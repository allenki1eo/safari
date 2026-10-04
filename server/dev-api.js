import { handleScoreRequest } from './leaderboard.js';

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 4096) {
      const err = new Error('body too large');
      err.code = 'TOO_BIG';
      throw err;
    }
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

async function scoresMiddleware(req, res, next) {
  const path = (req.url || '').split('?')[0];
  if (path !== '/api/scores') return next();
  try {
    const body = req.method === 'POST' ? await readJson(req) : undefined;
    const result = await handleScoreRequest(req.method, body);
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

/** Serves /api/scores from `vite` and `vite preview` with the same handler as Vercel. */
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
