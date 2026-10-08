import { runPushJob } from '../../server/push.js';

/** Vercel Cron, 07:00 in Dar: tell winners about the prizes settled overnight. */
export default async function handler(req, res) {
  const result = await runPushJob('morning', req.headers?.authorization);
  res.statusCode = result.status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(result.body));
}
