import { createClient } from '@libsql/client';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { loadLocalEnv } from '../server/env.js';

loadLocalEnv();

const url = process.env.TURSO_DATABASE_URL?.trim();
const authToken = process.env.TURSO_AUTH_TOKEN?.trim() || undefined;

if (!url) {
  console.error('Set TURSO_DATABASE_URL. For Turso Cloud, also set TURSO_AUTH_TOKEN. See .env.example.');
  process.exit(1);
}
if (!url.startsWith('file:') && !authToken) {
  console.error('TURSO_AUTH_TOKEN is required when TURSO_DATABASE_URL points at Turso Cloud.');
  process.exit(1);
}
if (url.startsWith('file:')) {
  const filePath = url.slice('file:'.length).replace(/^\/\//, '/');
  mkdirSync(dirname(resolve(filePath)), { recursive: true });
}

const sql = ['001_scores.sql', '002_players.sql', '003_daily.sql']
  .map((file) => readFileSync(new URL(`../migrations/${file}`, import.meta.url), 'utf8'))
  .join('\n');
const client = createClient({ url, authToken });
await client.executeMultiple(sql);
console.log('Leaderboard schema is ready.');
