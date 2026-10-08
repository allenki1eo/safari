import { runPushJob } from '../../server/push.js';

/** Vercel Cron, 18:00 in Dar: nudge players who have not run today. */
export default async function handler(req, res) {
  const result = await runPushJob('evening', req.headers?.authorization);
  res.statusCode = result.status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(result.body));
}
