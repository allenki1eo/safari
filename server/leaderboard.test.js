import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  NAME_MAX,
  TOP_LIMIT,
  handleScoreRequest,
  resetLeaderboardClient,
  validateSubmission,
} from './leaderboard.js';

test('rejects bad names and scores and drops a client rank', () => {
  assert.equal(validateSubmission(null).ok, false);
  assert.equal(validateSubmission({ name: '   ', score: 1 }).ok, false);
  assert.equal(validateSubmission({ name: 'A'.repeat(NAME_MAX + 1), score: 1 }).ok, false);
  assert.equal(validateSubmission({ name: 'Zuri', score: -1 }).ok, false);
  assert.equal(validateSubmission({ name: 'Zuri', score: 1.5 }).ok, false);
  assert.equal(validateSubmission({ name: 'Zuri', score: '12abc' }).ok, false);
  assert.equal(validateSubmission({ name: 'Zuri', score: 10, distance: -5 }).ok, false);
  assert.match(validateSubmission({ name: 'Zuri', score: 10, runner: 'nope' }).error, /Runner/);

  const ok = validateSubmission({
    name: '  Zuri\n',
    score: '1200',
    distance: 80,
    seeds: 4,
    allies: 1,
    chapter: 2,
    runner: 'neema',
    rank: 1,
    id: 99,
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.value.name, 'Zuri');
  assert.equal(ok.value.score, 1200);
  assert.equal(ok.value.runner, 'neema');
  assert.equal(ok.value.rank, undefined);
  assert.equal(ok.value.id, undefined);
  assert.equal(validateSubmission({ name: 'A'.repeat(NAME_MAX), score: 0 }).ok, true);
});

test('the browser module never mentions Turso credentials', () => {
  const client = readFileSync(new URL('../app/ui/leaderboard.js', import.meta.url), 'utf8');
  const api = readFileSync(new URL('../app/ui/ui.js', import.meta.url), 'utf8');
  for (const source of [client, api]) {
    assert.equal(source.includes('TURSO_'), false);
    assert.equal(source.includes('@libsql'), false);
    assert.equal(source.includes('authToken'), false);
  }
});

test('orders scores, caps the board, and computes rank on the server', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'kimbia-lb-'));
  const previousUrl = process.env.TURSO_DATABASE_URL;
  const previousToken = process.env.TURSO_AUTH_TOKEN;
  delete process.env.TURSO_DATABASE_URL;
  delete process.env.TURSO_AUTH_TOKEN;
  resetLeaderboardClient();

  try {
    const missing = await handleScoreRequest('GET');
    assert.equal(missing.status, 503);

    process.env.TURSO_DATABASE_URL = `file:${join(dir, 'scores.db')}`;
    resetLeaderboardClient();

    const empty = await handleScoreRequest('GET');
    assert.equal(empty.status, 200);
    assert.deepEqual(empty.body.top, []);

    const low = await handleScoreRequest('POST', {
      name: 'Juma',
      score: 50,
      distance: 20,
      seeds: 3,
      allies: 0,
      chapter: 0,
      runner: 'juma',
      rank: 1,
    });
    assert.equal(low.status, 201);
    assert.equal(low.body.entry.rank, 1);
    assert.equal(low.body.entry.runner, 'juma');

    const high = await handleScoreRequest('POST', {
      name: 'Neema',
      score: 5000,
      distance: 900,
      seeds: 40,
      allies: 2,
      chapter: 1,
      runner: 'neema',
    });
    assert.equal(high.status, 201);
    assert.equal(high.body.entry.rank, 1);
    assert.equal(high.body.top[0].name, 'Neema');
    assert.equal(high.body.top[0].rank, 1);
    assert.equal(high.body.top[1].name, 'Juma');
    assert.equal(high.body.top[1].rank, 2);

    const tie = await handleScoreRequest('POST', {
      name: 'Amani',
      score: 5000,
      distance: 100,
      runner: 'amani',
    });
    assert.equal(tie.body.entry.rank, 2, 'an earlier equal score stays ahead');

    for (let i = 0; i < TOP_LIMIT; i++) {
      const posted = await handleScoreRequest('POST', { name: `R${i}`, score: i });
      assert.equal(posted.status, 201);
    }

    const board = await handleScoreRequest('GET');
    assert.equal(board.body.top.length, TOP_LIMIT);
    const scores = board.body.top.map((row) => row.score);
    assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
    assert.equal(board.body.top[0].name, 'Neema');

    const buried = await handleScoreRequest('POST', { name: 'Kito', score: 1, runner: 'kito' });
    assert.equal(buried.body.entry.rank > TOP_LIMIT, true);
    assert.equal(buried.body.top.some((row) => row.name === 'Kito'), false);
    assert.equal(typeof buried.body.entry.rank, 'number');
  } finally {
    if (previousUrl == null) delete process.env.TURSO_DATABASE_URL;
    else process.env.TURSO_DATABASE_URL = previousUrl;
    if (previousToken == null) delete process.env.TURSO_AUTH_TOKEN;
    else process.env.TURSO_AUTH_TOKEN = previousToken;
    resetLeaderboardClient();
    rmSync(dir, { recursive: true, force: true });
  }
});
