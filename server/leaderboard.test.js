import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createClient } from '@libsql/client';
import {
  NAME_MAX,
  TOP_LIMIT,
  handleScoreRequest,
  nameKey,
  resetLeaderboardClient,
  setLeaderboardClock,
  validateSubmission,
} from './leaderboard.js';
import { leaveDecision, runnerName, scoreSavePlan } from '../app/ui/leaderboard.js';

// a distinct device secret per fake player
const tok = (n) => String(n).padStart(2, '0').repeat(32).slice(0, 64).replace(/[^a-f0-9]/g, 'a');
const T = { juma: tok(11), neema: tok(22), amani: tok(33), kito: tok(44), thief: tok(55), hanki: tok(66) };

/** Runs `fn` against a fresh file database, restoring the environment afterwards. */
async function withDb(fn, seed) {
  const dir = mkdtempSync(join(tmpdir(), 'kimbia-lb-'));
  const prevUrl = process.env.TURSO_DATABASE_URL;
  const prevToken = process.env.TURSO_AUTH_TOKEN;
  delete process.env.TURSO_AUTH_TOKEN;
  const url = `file:${join(dir, 'scores.db')}`;
  try {
    if (seed) {
      // simulate the original per-run table before players existed
      const c = createClient({ url });
      await c.executeMultiple(readFileSync(new URL('../migrations/001_scores.sql', import.meta.url), 'utf8'));
      await seed(c);
      c.close();
    }
    process.env.TURSO_DATABASE_URL = url;
    resetLeaderboardClient();
    await fn();
  } finally {
    if (prevUrl == null) delete process.env.TURSO_DATABASE_URL;
    else process.env.TURSO_DATABASE_URL = prevUrl;
    if (prevToken == null) delete process.env.TURSO_AUTH_TOKEN;
    else process.env.TURSO_AUTH_TOKEN = prevToken;
    resetLeaderboardClient();
    setLeaderboardClock();
    rmSync(dir, { recursive: true, force: true });
  }
}

const post = (body) => handleScoreRequest('POST', body);

test('rejects bad names, scores and tokens and drops a client rank', () => {
  const token = T.juma;
  assert.equal(validateSubmission(null).ok, false);
  assert.match(validateSubmission({ name: 'Zuri', score: 1 }).error, /token/);
  assert.match(validateSubmission({ token: 'abc', name: 'Zuri', score: 1 }).error, /token/);
  assert.equal(validateSubmission({ token, name: '   ', score: 1 }).ok, false);
  assert.equal(validateSubmission({ token, name: 'A'.repeat(NAME_MAX + 1), score: 1 }).ok, false);
  assert.equal(validateSubmission({ token, name: 'Zuri', score: -1 }).ok, false);
  assert.equal(validateSubmission({ token, name: 'Zuri', score: 1.5 }).ok, false);
  assert.equal(validateSubmission({ token, name: 'Zuri', score: '12abc' }).ok, false);
  assert.equal(validateSubmission({ token, name: 'Zuri', score: 10, distance: -5 }).ok, false);
  assert.match(validateSubmission({ token, name: 'Zuri', score: 10, runner: 'nope' }).error, /Runner/);

  const ok = validateSubmission({ token, name: '  Zuri\n', score: '1200', distance: 80, chapter: 7, runner: 'neema', rank: 1, id: 99 });
  assert.equal(ok.ok, true);
  assert.equal(ok.value.name, 'Zuri');
  assert.equal(ok.value.score, 1200);
  assert.equal(ok.value.chapter, 7, 'all eight journey regions are valid');
  assert.equal(ok.value.rank, undefined);
  assert.equal(ok.value.id, undefined);
});

test('name keys ignore case and spacing', () => {
  assert.equal(nameKey('Zuri'), nameKey('  ZURI '));
  assert.equal(nameKey('Mama  Neema'), nameKey('mama neema'));
  assert.notEqual(nameKey('Zuri'), nameKey('Zuri2'));
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

test('a finished run is saved from the stored name, or the card asks before anyone can leave', () => {
  assert.deepEqual(scoreSavePlan('  Allen '), { action: 'save', name: 'Allen' });
  assert.deepEqual(scoreSavePlan(''), { action: 'ask' });
  assert.deepEqual(scoreSavePlan('   '), { action: 'ask' });
  assert.equal(runnerName('A'.repeat(NAME_MAX) + 'x'), '');

  assert.deepEqual(
    leaveDecision({ alreadySaved: false, savedName: '', typedName: '' }),
    { action: 'ask' },
  );
  assert.deepEqual(
    leaveDecision({ alreadySaved: false, savedName: '', typedName: '  Zuri ' }),
    { action: 'save', name: 'Zuri' },
  );
  assert.deepEqual(
    leaveDecision({ alreadySaved: false, savedName: 'Juma', typedName: '' }),
    { action: 'save', name: 'Juma' },
  );
  assert.deepEqual(
    leaveDecision({ alreadySaved: true, savedName: 'Juma', typedName: '' }),
    { action: 'leave' },
  );

  const ui = readFileSync(new URL('../app/ui/ui.js', import.meta.url), 'utf8');
  assert.match(ui, /recordFinishedRun\(el, run\)/);
  assert.match(ui, /scoreSavePlan\(save\.name\)/);
  assert.match(ui, /leaveResults\(el, run, act\)/);
  assert.doesNotMatch(ui, /if \(act === 'again'\) \{\s*el\.remove\(\)/);
});

test('answers 503 until storage is configured', async () => {
  const prev = process.env.TURSO_DATABASE_URL;
  delete process.env.TURSO_DATABASE_URL;
  resetLeaderboardClient();
  try {
    assert.equal((await handleScoreRequest('GET')).status, 503);
  } finally {
    if (prev != null) process.env.TURSO_DATABASE_URL = prev;
    resetLeaderboardClient();
  }
});

test('one row per player: only a better run replaces their best', () => withDb(async () => {
  assert.deepEqual((await handleScoreRequest('GET')).body.top, []);

  const first = await post({ token: T.juma, name: 'Juma', score: 50, distance: 20, runner: 'juma', rank: 1 });
  assert.equal(first.status, 200);
  assert.equal(first.body.entry.rank, 1);
  assert.equal(first.body.entry.improved, true);

  const worse = await post({ token: T.juma, name: 'Juma', score: 30, distance: 10 });
  assert.equal(worse.body.entry.improved, false);
  assert.equal(worse.body.entry.score, 50, 'best score is kept');
  assert.equal(worse.body.entry.run, 30);

  const better = await post({ token: T.juma, name: 'Juma', score: 900, distance: 300, chapter: 2 });
  assert.equal(better.body.entry.improved, true);
  assert.equal(better.body.entry.score, 900);
  assert.equal(better.body.entry.chapter, 2);

  const board = (await handleScoreRequest('GET')).body.top;
  assert.equal(board.filter((r) => r.name === 'Juma').length, 1, 'no duplicate rows for one player');
  assert.equal(board[0].score, 900);
}));

test('names are unique and belong to their device', () => withDb(async () => {
  await post({ token: T.neema, name: 'Neema', score: 5000 });

  const steal = await post({ token: T.thief, name: 'neema', score: 999999 });
  assert.equal(steal.status, 409);
  assert.equal(steal.body.code, 'NAME_TAKEN');

  const stealSpaced = await post({ token: T.thief, name: ' NEEMA ', score: 1 });
  assert.equal(stealSpaced.status, 409);

  const top = (await handleScoreRequest('GET')).body.top;
  assert.equal(top.length, 1);
  assert.equal(top[0].score, 5000, 'a thief cannot post under someone else\'s name');

  // the owner can change capitalisation, or rename to a free name and keep their best
  const caps = await post({ token: T.neema, name: 'NEEMA', score: 0 });
  assert.equal(caps.body.entry.name, 'NEEMA');
  const renamed = await post({ token: T.neema, name: 'Neema the Swift', score: 0 });
  assert.equal(renamed.status, 200);
  assert.equal(renamed.body.entry.score, 5000);
  // and the old name is free again
  assert.equal((await post({ token: T.thief, name: 'Neema', score: 10 })).status, 200);

  // a player can't rename onto a name somebody else holds
  assert.equal((await post({ token: T.neema, name: 'neema', score: 0 })).status, 409);
}));

test('ties go to whoever got there first, and the board is capped', () => withDb(async () => {
  await post({ token: T.neema, name: 'Neema', score: 5000 });
  const tie = await post({ token: T.amani, name: 'Amani', score: 5000 });
  assert.equal(tie.body.entry.rank, 2, 'an earlier equal score stays ahead');

  for (let i = 0; i < TOP_LIMIT; i++) {
    const t = (1000 + i).toString(16).padStart(64, 'b');
    assert.equal((await post({ token: t, name: `R${i}`, score: i + 1 })).status, 200);
  }
  const board = (await handleScoreRequest('GET')).body.top;
  assert.equal(board.length, TOP_LIMIT);
  const scores = board.map((r) => r.score);
  assert.deepEqual(scores, [...scores].sort((a, b) => b - a));

  const buried = await post({ token: T.kito, name: 'Kito', score: 1, runner: 'kito' });
  assert.equal(buried.body.entry.rank > TOP_LIMIT, true);
  assert.equal(buried.body.top.some((r) => r.name === 'Kito'), false);

  // a name claimed without a score (e.g. from Settings) stays off the board
  const quiet = await post({ token: T.juma, name: 'Juma', score: 0 });
  assert.equal(quiet.body.entry.rank, null);
}));

test('old per-run rows fold into one player each, claimable by the first device', () => withDb(async () => {
  const top = (await handleScoreRequest('GET')).body.top;
  assert.deepEqual(top.map((r) => [r.name, r.score]), [['Hanki', 3426], ['probe', 1]]);

  // Hanki's device posts under the same name: it claims the folded row and keeps the best
  const claim = await post({ token: T.hanki, name: 'Hanki', score: 1200 });
  assert.equal(claim.status, 200);
  assert.equal(claim.body.entry.score, 3426);
  assert.equal(claim.body.entry.improved, false);
  assert.equal(claim.body.top.filter((r) => r.name === 'Hanki').length, 1);

  // nobody else can take it now
  assert.equal((await post({ token: T.thief, name: 'hanki', score: 9 })).status, 409);

  // re-running the migration on a later cold start doesn't resurrect duplicates
  resetLeaderboardClient();
  const again = (await handleScoreRequest('GET')).body.top;
  assert.equal(again.filter((r) => r.name.toLowerCase() === 'hanki').length, 1);
}, async (c) => {
  await c.execute("INSERT INTO scores (name, score, distance, seeds) VALUES ('Hanki', 200, 46, 4)");
  await c.execute("INSERT INTO scores (name, score, distance, seeds) VALUES ('Hanki', 3426, 432, 132)");
  await c.execute("INSERT INTO scores (name, score, distance, seeds) VALUES ('probe', 1, 1, 0)");
}));

test('today\'s board resets at midnight in Dar and yesterday\'s best is the only ghost', () => withDb(async () => {
  // 23:30 in Dar es Salaam on 4 Oct 2026
  setLeaderboardClock(() => new Date('2026-10-04T20:30:00Z'));
  const juma = await post({ token: T.juma, name: 'Juma', score: 800, distance: 200, duration: 40, runner: 'juma' });
  assert.equal(juma.status, 200);
  assert.equal(juma.body.daily.day, '2026-10-04');
  assert.equal(juma.body.daily.rank, 1);
  assert.equal(juma.body.entry.rank, 1, 'all-time rank is unchanged');

  const worse = await post({ token: T.juma, name: 'Juma', score: 100, distance: 20, duration: 5 });
  assert.equal(worse.body.entry.score, 800);
  const kept = await handleScoreRequest('GET', undefined, { board: 'daily' });
  assert.equal(kept.body.top[0].score, 800);
  assert.equal(kept.body.top[0].distance, 200, 'today\'s ghost keeps the better run');

  await post({ token: T.neema, name: 'Neema', score: 500, distance: 90, duration: 20 });
  const today = await handleScoreRequest('GET', undefined, { board: 'daily' });
  assert.equal(today.body.day, '2026-10-04');
  assert.deepEqual(today.body.top.map((row) => row.name), ['Juma', 'Neema']);
  assert.equal(today.body.yesterday, null, 'no ghost until a previous day has a real run');

  // 00:30 in Dar on 5 Oct — the daily board is empty and Juma is yesterday's ghost
  setLeaderboardClock(() => new Date('2026-10-04T21:30:00Z'));
  const rolled = await handleScoreRequest('GET', undefined, { board: 'daily' });
  assert.equal(rolled.body.day, '2026-10-05');
  assert.deepEqual(rolled.body.top, []);
  assert.deepEqual(rolled.body.yesterday, {
    name: 'Juma', score: 800, distance: 200, duration: 40, runner: 'juma',
  });

  const quiet = await post({ token: T.amani, name: 'Amani', score: 0 });
  assert.equal(quiet.body.daily, null, 'claiming a name does not enter today\'s board');

  const all = await handleScoreRequest('GET');
  assert.deepEqual(all.body.top.map((row) => row.name), ['Juma', 'Neema']);
}));

/* ------------------------------------------------------------ challenges */
import { handleChallengeRequest, OPEN_TTL, TAKEN_TTL } from './challenges.js';
import { GhostRecorder } from '../app/game/ghostTrack.js';

const chPost = (body) => handleChallengeRequest('POST', body);
const chGet = (id) => handleChallengeRequest('GET', undefined, { id });

function track() {
  const r = new GhostRecorder();
  for (let t = 0; t <= 3; t += 1 / 60) r.sample(t, t * 15, Math.sin(t) * 2.5, t > 1 && t < 1.5 ? 1.2 : 0, t > 1 && t < 1.5 ? 'jump' : 'run');
  return r.encode();
}

const host = (over = {}) => ({
  action: 'create', token: T.juma, name: 'Juma', runner: 'juma', score: 5000, distance: 700, duration: 50,
  startRegion: 2, route: 'r1a2b3c', track: track(), stake: 100, ...over,
});

test('a challenge stores the route and the shadow-runner recording', async () => {
  await withDb(async () => {
    const made = await chPost(host());
    assert.equal(made.status, 200);
    assert.match(made.body.id, /^[a-z0-9]{8}$/);
    const got = await chGet(made.body.id);
    assert.equal(got.status, 200);
    assert.equal(got.body.challenge.route, 'r1a2b3c');
    assert.equal(got.body.challenge.name, 'Juma');
    assert.equal(got.body.challenge.stake, 100);
    assert.equal(got.body.challenge.track, host().track);
    assert.equal(got.body.challenge.status, 'open');
    assert.equal(JSON.stringify(got.body).includes('hash'), false);
    assert.equal((await chGet('nope')).status, 400);
    assert.equal((await chPost(host({ route: 'drop table' }))).status, 400);
    assert.equal((await chPost(host({ stake: 999999 }))).status, 400);
    assert.equal((await chPost(host({ track: 'not*a*track' }))).status, 400);
    assert.equal((await chPost(host({ name: '' }))).status, 400);
  });
});

test('the first friend locks the bet, and the higher score takes the pot', async () => {
  await withDb(async () => {
    const { id } = (await chPost(host())).body;
    assert.equal((await chPost({ action: 'accept', token: T.juma, id, name: 'Juma' })).body.code, 'OWN');
    const ok = await chPost({ action: 'accept', token: T.neema, id, name: 'Neema' });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.stake, 100);
    assert.equal((await chPost({ action: 'accept', token: T.kito, id, name: 'Kito' })).body.code, 'TAKEN');
    assert.equal((await chPost({ action: 'finish', token: T.kito, id, score: 9 })).status, 409);
    const fin = await chPost({ action: 'finish', token: T.neema, id, score: 7000 });
    assert.deepEqual(fin.body, { winner: 'rival', pot: 200, hostName: 'Juma', hostScore: 5000 });
    // finishing twice changes nothing
    assert.equal((await chPost({ action: 'finish', token: T.neema, id, score: 1 })).body.winner, 'rival');
    // the host hears they lost, once, and is paid nothing
    const col = await chPost({ action: 'collect', token: T.juma });
    assert.deepEqual(col.body.payouts.map((p) => [p.kind, p.amount, p.rivalName]), [['lost', 0, 'Neema']]);
    assert.equal((await chPost({ action: 'collect', token: T.juma })).body.payouts.length, 0);
  });
});

test('the host collects a win once; a tie goes to the host', async () => {
  await withDb(async () => {
    const { id } = (await chPost(host())).body;
    await chPost({ action: 'accept', token: T.neema, id, name: 'Neema' });
    assert.equal((await chPost({ action: 'finish', token: T.neema, id, score: 5000 })).body.winner, 'host');
    const col = await chPost({ action: 'collect', token: T.juma });
    assert.deepEqual(col.body.payouts.map((p) => [p.kind, p.amount]), [['won', 200]]);
    assert.equal((await chPost({ action: 'collect', token: T.juma })).body.payouts.length, 0);
  });
});

test('untaken bets are refunded and abandoned ones are forfeited', async () => {
  await withDb(async () => {
    const t0 = Date.parse('2026-10-05T08:00:00Z');
    setLeaderboardClock(() => new Date(t0));
    const open = (await chPost(host())).body.id;
    const taken = (await chPost(host({ stake: 50 }))).body.id;
    const free = (await chPost(host({ stake: 0 }))).body.id;
    await chPost({ action: 'accept', token: T.neema, id: taken, name: 'Neema' });
    assert.equal((await chPost({ action: 'accept', token: T.neema, id: free, name: 'Neema' })).body.code, 'NO_BET');
    assert.equal((await chPost({ action: 'collect', token: T.juma })).body.payouts.length, 0);
    setLeaderboardClock(() => new Date(t0 + TAKEN_TTL + 1000));
    let col = (await chPost({ action: 'collect', token: T.juma })).body.payouts;
    assert.deepEqual(col.map((p) => [p.id, p.kind, p.amount]), [[taken, 'forfeit', 100]]);
    setLeaderboardClock(() => new Date(t0 + OPEN_TTL + 1000));
    col = (await chPost({ action: 'collect', token: T.juma })).body.payouts;
    assert.deepEqual(col.map((p) => [p.id, p.kind, p.amount]), [[open, 'refund', 100]]);
    assert.equal((await chGet(open)).body.challenge.status, 'expired');
    assert.equal((await chGet(free)).body.challenge.status, 'open');
  });
});

/* ------------------------------------------------------------ progress codes */
import { handleTransferRequest, cleanCode, manifestFor, TRANSFER_TTL } from './transfers.js';

test('a progress code carries a save to another browser, for a week', async () => {
  await withDb(async () => {
    const t0 = Date.parse('2026-10-05T08:00:00Z');
    setLeaderboardClock(() => new Date(t0));
    const data = { name: 'Allen', seeds: 1234, playerToken: T.juma, missions: [{ id: 'jumps', n: 15 }] };
    const made = await handleTransferRequest('POST', { action: 'create', data });
    assert.equal(made.status, 200);
    assert.match(made.body.code, /^[A-HJ-NP-Z2-9]{8}$/);
    const pretty = `${made.body.code.slice(0, 4).toLowerCase()}-${made.body.code.slice(4)}`;
    const got = await handleTransferRequest('POST', { action: 'claim', code: pretty });
    assert.deepEqual(got.body.data, data);
    setLeaderboardClock(() => new Date(t0 + TRANSFER_TTL + 1000));
    assert.equal((await handleTransferRequest('POST', { action: 'claim', code: made.body.code })).status, 404);
    assert.equal((await handleTransferRequest('POST', { action: 'claim', code: 'nope' })).status, 400);
    assert.equal((await handleTransferRequest('POST', { action: 'create', data: [1] })).status, 400);
    assert.equal((await handleTransferRequest('POST', { action: 'create', data: { big: 'x'.repeat(40000) } })).status, 400);
    assert.equal(cleanCode('ab0d-2345'), null); // 0 is never used
    assert.deepEqual(manifestFor('ABCD2345', { name: 'K', start_url: '/' }), { name: 'K', start_url: '/?restore=ABCD2345' });
  });
});
