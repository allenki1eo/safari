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
  hashToken,
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

/* ------------------------------------------------------------ getting a runner back */
import { handleAccountRequest, LOCK_MS } from './accounts.js';

const acc = (body) => handleAccountRequest('POST', body);
const NEW_PHONE = tok(77);
const SECOND_PHONE = tok(88);

test('a runner protected with a PIN comes back on a new phone with their save', async () => {
  await withDb(async () => {
    setLeaderboardClock(() => new Date(Date.parse('2026-10-05T08:00:00Z')));
    await post({ token: T.hanki, name: 'Gee🥀', score: 77533, distance: 4623 });
    assert.equal((await acc({ action: 'status', token: T.hanki })).body.pin, false);
    assert.equal((await acc({ action: 'setPin', token: T.hanki, pin: '12' })).body.code, 'PIN_FORMAT');
    assert.equal((await acc({ action: 'setPin', token: T.juma, pin: '1234' })).body.code, 'NO_RUNNER');
    const set = await acc({ action: 'setPin', token: T.hanki, pin: '2580', save: { seeds: 2506, name: 'Gee🥀', playerToken: T.hanki } });
    assert.equal(set.status, 200);
    assert.equal((await acc({ action: 'sync', token: T.hanki, save: { seeds: 3000, owned: ['zuri', 'neema'] } })).status, 200);

    // the new phone can't post under the name...
    assert.equal((await post({ token: NEW_PHONE, name: 'Gee🥀', score: 46 })).body.code, 'NAME_TAKEN');
    // ...until it recovers it (the name matches case-insensitively)
    assert.equal((await acc({ action: 'recover', token: NEW_PHONE, name: 'gee🥀', pin: '0000' })).body.code, 'WRONG_PIN');
    const got = await acc({ action: 'recover', token: NEW_PHONE, name: 'gee🥀', pin: '2580' });
    assert.equal(got.status, 200);
    assert.equal(got.body.name, 'Gee🥀');
    assert.deepEqual(got.body.save, { seeds: 3000, owned: ['zuri', 'neema'] });
    assert.equal(JSON.stringify(got.body).includes(T.hanki), false); // device keys never leave
    // both phones now post as Gee
    const p1 = await post({ token: NEW_PHONE, name: 'Gee🥀', score: 90000 });
    assert.equal(p1.status, 200);
    assert.equal(p1.body.entry.score, 90000);
    assert.equal((await post({ token: T.hanki, name: 'Gee🥀', score: 10 })).status, 200);
    assert.equal((await handleScoreRequest('GET', undefined, {})).body.top.filter((r) => r.name === 'Gee🥀').length, 1);
  });
});

test('wrong PINs lock recovery for a while', async () => {
  await withDb(async () => {
    const t0 = Date.parse('2026-10-05T08:00:00Z');
    setLeaderboardClock(() => new Date(t0));
    await post({ token: T.neema, name: 'Neema', score: 500 });
    await acc({ action: 'setPin', token: T.neema, pin: '4321' });
    for (let i = 0; i < 5; i++) await acc({ action: 'recover', token: NEW_PHONE, name: 'Neema', pin: String(1000 + i) });
    assert.equal((await acc({ action: 'recover', token: NEW_PHONE, name: 'Neema', pin: '4321' })).body.code, 'LOCKED');
    setLeaderboardClock(() => new Date(t0 + LOCK_MS + 1000));
    assert.equal((await acc({ action: 'recover', token: NEW_PHONE, name: 'Neema', pin: '4321' })).status, 200);
  });
});

test('a runner who never set a PIN gets back in with a one-time admin code', async () => {
  await withDb(async () => {
    const prev = process.env.KIMBIA_ADMIN_KEY;
    try {
      await post({ token: T.amani, name: 'Ritha', score: 45346 });
      assert.equal((await acc({ action: 'recover', token: NEW_PHONE, name: 'Ritha', pin: '1234' })).body.code, 'NO_PIN');
      delete process.env.KIMBIA_ADMIN_KEY;
      assert.equal((await acc({ action: 'adminCode', adminKey: 'x', name: 'Ritha' })).status, 503);
      process.env.KIMBIA_ADMIN_KEY = 'super-secret-admin-key';
      assert.equal((await acc({ action: 'adminCode', adminKey: 'nope', name: 'Ritha' })).status, 403);
      const issued = await acc({ action: 'adminCode', adminKey: 'super-secret-admin-key', name: 'ritha' });
      assert.match(issued.body.code, /^[A-HJ-NP-Z2-9]{8}$/);
      const code = `${issued.body.code.slice(0, 4)}-${issued.body.code.slice(4).toLowerCase()}`;
      const got = await acc({ action: 'recover', token: NEW_PHONE, name: 'Ritha', pin: code });
      assert.equal(got.status, 200);
      assert.equal(got.body.needsPin, true);
      // the code is spent
      assert.equal((await acc({ action: 'recover', token: SECOND_PHONE, name: 'Ritha', pin: code })).status, 409);
      assert.equal((await post({ token: NEW_PHONE, name: 'Ritha', score: 50000 })).status, 200);
      // and the recovered phone can now set its own PIN
      assert.equal((await acc({ action: 'setPin', token: NEW_PHONE, pin: '9999' })).status, 200);
    } finally {
      if (prev == null) delete process.env.KIMBIA_ADMIN_KEY;
      else process.env.KIMBIA_ADMIN_KEY = prev;
    }
  });
});

test('day, week and month prizes go to the top runners once, on any of their devices', async () => {
  await withDb(async () => {
    const at = (iso) => setLeaderboardClock(() => new Date(iso));
    const run = (token, name, score, extra = {}) =>
      post({ token, name, score, distance: Math.round(score / 10), duration: 120, runner: 'zuri', ...extra });

    // Monday 5 Oct, midday in Dar
    at('2026-10-05T09:00:00Z');
    await run(T.juma, 'Juma', 9000);
    await run(T.neema, 'Neema', 7000);
    await run(T.amani, 'Amani', 5000);
    await run(T.thief, 'Thief', 99_000, { distance: 500_000, duration: 10 }); // impossible pace

    const live = await handleScoreRequest('GET', undefined, { board: 'day' });
    assert.equal(live.status, 200);
    assert.deepEqual(live.body.top.map((r) => r.name), ['Juma', 'Neema', 'Amani'], 'an impossible run is left off');
    assert.equal(live.body.top[0].prize, 1000);
    assert.equal(live.body.endsAt, Date.parse('2026-10-05T21:00:00Z'));

    // Tuesday: Neema has the best run of the week, Kito joins
    at('2026-10-06T09:00:00Z');
    await run(T.neema, 'Neema', 12_000);
    await run(T.kito, 'Kito', 3000);
    const week = await handleScoreRequest('GET', undefined, { board: 'week' });
    assert.equal(week.body.period, '2026-10-05');
    assert.deepEqual(week.body.top.map((r) => [r.name, r.score]), [['Neema', 12_000], ['Juma', 9000], ['Amani', 5000], ['Kito', 3000]]);
    assert.equal(week.body.champion, null);

    // Monday's prizes are ready on Tuesday; each is collected only once
    const juma = await post({ action: 'prizes', token: T.juma });
    assert.deepEqual(juma.body.prizes, [{ kind: 'day', period: '2026-10-05', rank: 1, score: 9000, amount: 1000 }]);
    assert.deepEqual((await post({ action: 'prizes', token: T.juma })).body.prizes, []);
    assert.deepEqual((await post({ action: 'prizes', token: T.thief })).body.prizes, []);
    const today = await handleScoreRequest('GET', undefined, { board: 'day' });
    assert.equal(today.body.champion.name, 'Juma', "yesterday's winner wears the crown");

    // the next Monday: the week has closed. Neema collects on a second device.
    at('2026-10-12T09:00:00Z');
    const db = createClient({ url: process.env.TURSO_DATABASE_URL });
    const neemaId = (await db.execute({ sql: 'SELECT id FROM players WHERE name = ?', args: ['Neema'] })).rows[0].id;
    await db.execute({ sql: 'INSERT INTO player_keys (token_hash, player_id, created_ms) VALUES (?, ?, 0)', args: [hashToken(T.hanki), neemaId] });
    db.close();
    const neema = await post({ action: 'prizes', token: T.hanki });
    assert.deepEqual(
      neema.body.prizes.map((p) => [p.kind, p.rank, p.amount]),
      [['week', 1, 6000], ['day', 1, 1000], ['day', 2, 600]],
      'the week win comes first, then the days (Tuesday is paid even though nobody visited since)',
    );
    const kito = await post({ action: 'prizes', token: T.kito });
    assert.deepEqual(kito.body.prizes.map((p) => [p.kind, p.rank, p.amount]), [['week', 4, 400], ['day', 2, 600]]);
  });
});

test('notifications: subscribe, challenge news, prize news once, evening reminders that back off', async () => {
  const push = await import('./push.js');
  const { handleChallengeRequest } = await import('./challenges.js');
  const prev = { pub: process.env.VAPID_PUBLIC_KEY, priv: process.env.VAPID_PRIVATE_KEY };
  process.env.VAPID_PUBLIC_KEY = 'test-public';
  process.env.VAPID_PRIVATE_KEY = 'test-private';
  const outbox = [];
  push.setPushSender(async (sub, payload) => {
    if (sub.endpoint.includes('gone')) throw Object.assign(new Error('gone'), { statusCode: 410 });
    outbox.push({ to: sub.endpoint, lang: String(sub.lang), ...payload });
  });
  const sub = (name) => ({ endpoint: `https://push.example/${name}`, keys: { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) } });
  try {
    await withDb(async () => {
      const at = (iso) => setLeaderboardClock(() => new Date(iso));
      at('2026-10-05T09:00:00Z');
      assert.equal((await push.handlePushRequest('GET')).body.publicKey, 'test-public');
      await post({ token: T.juma, name: 'Juma', score: 9000, distance: 900, duration: 120 });
      await post({ token: T.neema, name: 'Neema', score: 4000, distance: 400, duration: 120 });
      const ok = await push.handlePushRequest('POST', { action: 'subscribe', token: T.juma, subscription: sub('juma') });
      assert.equal(ok.status, 200);
      await push.handlePushRequest('POST', { action: 'subscribe', token: T.neema, subscription: sub('neema'), lang: 'sw' });
      await push.handlePushRequest('POST', { action: 'subscribe', token: T.neema, subscription: sub('neema-gone') });
      assert.equal((await push.handlePushRequest('POST', { action: 'subscribe', token: T.juma, subscription: { endpoint: 'http://x' } })).status, 400);

      // a friend takes Juma's bet, then loses: Juma hears both
      const made = await handleChallengeRequest('POST', { action: 'create', token: T.juma, name: 'Juma', runner: 'zuri', score: 9000, distance: 900, duration: 120, route: 'rabc', stake: 100 });
      assert.equal(made.status, 200, JSON.stringify(made.body));
      await handleChallengeRequest('POST', { action: 'accept', token: T.amani, id: made.body.id, name: 'Amani' });
      await handleChallengeRequest('POST', { action: 'finish', token: T.amani, id: made.body.id, score: 5000 });
      assert.deepEqual(outbox.map((m) => [m.to, m.title]), [
        ['https://push.example/juma', '🎯 Bet taken!'],
        ['https://push.example/juma', '🏆 Amani couldn’t beat you!'],
      ]);
      outbox.length = 0;

      // the evening of the same day: both ran today, so nobody is nagged
      at('2026-10-05T15:00:00Z');
      assert.equal((await push.eveningJob()).sent, 0);

      // next morning: Juma's prize news, in English; once only
      at('2026-10-06T04:00:00Z');
      const morning = await push.morningJob();
      assert.equal(morning.players, 2);
      const jumaNews = outbox.find((m) => m.to.endsWith('/juma'));
      assert.equal(jumaNews.title, '🏆 You won 1,000 seeds!');
      assert.match(jumaNews.body, /1st on the daily board/);
      const neemaNews = outbox.find((m) => m.to.endsWith('/neema'));
      assert.equal(neemaNews.lang, 'sw');
      assert.match(neemaNews.title, /Umeshinda mbegu 600/);
      outbox.length = 0;
      assert.equal((await push.morningJob()).sent, 0, 'prize news goes out once');

      // that evening Neema runs; Juma does not: only Juma is reminded, with today's leader
      at('2026-10-06T09:00:00Z');
      await post({ token: T.neema, name: 'Neema', score: 15000, distance: 1500, duration: 200 });
      at('2026-10-06T15:00:00Z');
      await push.eveningJob();
      assert.deepEqual(outbox.map((m) => m.to), ['https://push.example/juma']);
      assert.match(outbox[0].body, /Neema leads with 15,000/);
      outbox.length = 0;
      await push.eveningJob();
      assert.equal(outbox.length, 0, 'at most one reminder a day');

      // the dead browser was dropped after its 410
      const db = createClient({ url: process.env.TURSO_DATABASE_URL });
      const left = (await db.execute('SELECT endpoint FROM push_subs ORDER BY endpoint')).rows.map((r) => r.endpoint);
      db.close();
      assert.deepEqual(left, ['https://push.example/juma', 'https://push.example/neema']);
    });
  } finally {
    push.setPushSender(null);
    if (prev.pub == null) delete process.env.VAPID_PUBLIC_KEY; else process.env.VAPID_PUBLIC_KEY = prev.pub;
    if (prev.priv == null) delete process.env.VAPID_PRIVATE_KEY; else process.env.VAPID_PRIVATE_KEY = prev.priv;
  }
});

test('reminders back off: daily for three days, then every third day, then never', async () => {
  const { remindToday } = await import('./push.js');
  const days = Array.from({ length: 40 }, (_, i) => i).filter(remindToday);
  assert.deepEqual(days, [1, 2, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30]);
});

test('Derby Day: a side sticks, runs pull the rope, nothing counts outside the event', async () => {
  await withDb(async () => {
    const at = (iso) => setLeaderboardClock(() => new Date(iso));
    const run = (token, name, distance, extra = {}) => post({ token, name, score: distance * 10, distance, duration: 300, ...extra });

    at('2026-10-08T12:00:00Z'); // before it opens: no side, no tally
    assert.equal((await run(T.juma, 'Juma', 900, { side: 'green' })).body.derby, null);

    at('2026-10-10T12:00:00Z');
    const juma = await run(T.juma, 'Juma', 1200, { side: 'green' });
    assert.deepEqual(juma.body.derby, { side: 'green', added: 1200 });
    // trying to switch sides keeps the first pick
    assert.deepEqual((await run(T.juma, 'Juma', 800, { side: 'red' })).body.derby, { side: 'green', added: 800 });
    await run(T.neema, 'Neema', 1500, { side: 'red' });
    const fake = await run(T.amani, 'Amani', 5000, { side: 'red', duration: 10 }); // impossible pace: turned away
    assert.equal(fake.status, 422);
    assert.equal(fake.body.code, 'IMPLAUSIBLE');
    assert.equal((await post({ action: 'side', token: T.kito, side: 'red' })).body.pending, true, 'no runner yet: joins with the first run');
    assert.equal((await post({ action: 'side', token: T.neema, side: 'green' })).body.side, 'red');

    const board = await handleScoreRequest('GET', undefined, { board: 'derby' });
    assert.equal(board.body.live, true);
    assert.deepEqual(board.body.sides.green, { distance: 2000, runs: 2, fans: 1, perFan: 2000 });
    assert.deepEqual(board.body.sides.red, { distance: 1500, runs: 1, fans: 1, perFan: 1500 });

    at('2026-10-13T09:00:00Z'); // it has closed: the score is frozen
    assert.equal((await run(T.neema, 'Neema', 9000)).body.derby, null);
    const final = await handleScoreRequest('GET', undefined, { board: 'derby' });
    assert.equal(final.body.live, false);
    assert.equal(final.body.sides.red.distance, 1500);
    assert.equal((await post({ action: 'side', token: T.hanki, side: 'red' })).body.code, 'CLOSED');
  });
});

test('admin dashboard: key required, stats add up, a ban clears the boards, broadcasts are spaced', async () => {
  const { handleAdminRequest } = await import('./admin.js');
  const push = await import('./push.js');
  const prev = { key: process.env.KIMBIA_ADMIN_KEY, pub: process.env.VAPID_PUBLIC_KEY, priv: process.env.VAPID_PRIVATE_KEY };
  process.env.KIMBIA_ADMIN_KEY = 'admin-test-key';
  process.env.VAPID_PUBLIC_KEY = 'test-public';
  process.env.VAPID_PRIVATE_KEY = 'test-private';
  const sent = [];
  push.setPushSender(async (sub, payload) => sent.push(payload));
  const admin = (body) => handleAdminRequest('POST', { adminKey: 'admin-test-key', ...body });
  try {
    await withDb(async () => {
      setLeaderboardClock(() => new Date('2026-10-10T09:00:00Z'));
      assert.equal((await handleAdminRequest('POST', { action: 'overview', adminKey: 'nope' })).status, 403);
      await post({ token: T.juma, name: 'Juma', score: 9000, distance: 900, duration: 120, side: 'green' });
      await post({ token: T.neema, name: 'Neema', score: 4000, distance: 400, duration: 120 });
      await post({ token: T.thief, name: 'Thief', score: 90000, distance: 2000, duration: 120, side: 'red' });
      await push.handlePushRequest('POST', { action: 'subscribe', token: T.juma, subscription: { endpoint: 'https://push.example/j', keys: { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) } } });

      const o = (await admin({ action: 'overview' })).body;
      assert.equal(o.players, 3);
      assert.equal(o.activeToday, 3);
      assert.equal(o.runsAll, 3); // runs carry the database's own clock, so check the total, not today's
      assert.equal(o.notify, 1);
      assert.equal(o.series.length, 14);
      assert.equal(o.series.at(-1).players, 3);
      assert.equal(o.derby.sides.red.distance, 2000);

      const found = (await admin({ action: 'players', q: 'thi' })).body.players;
      assert.deepEqual(found.map((p) => p.name), ['Thief']);
      const thief = found[0];
      assert.equal(thief.side, 'red');

      // ban: off the all-time and day boards; later runs don't pull the derby rope
      await admin({ action: 'ban', id: thief.id, banned: true, reason: 'impossible score' });
      const top = (await handleScoreRequest('GET', undefined, {})).body.top.map((r) => r.name);
      assert.ok(!top.includes('Thief'));
      const day = (await handleScoreRequest('GET', undefined, { board: 'day' })).body.top.map((r) => r.name);
      assert.deepEqual(day, ['Juma', 'Neema']);
      await post({ token: T.thief, name: 'Thief', score: 95000, distance: 2500, duration: 120 });
      assert.equal((await handleScoreRequest('GET', undefined, { board: 'derby' })).body.sides.red.distance, 2000);
      assert.equal((await admin({ action: 'player', id: thief.id })).body.player.banned, 'impossible score');
      await admin({ action: 'ban', id: thief.id, banned: false });
      assert.ok((await handleScoreRequest('GET', undefined, {})).body.top.map((r) => r.name).includes('Thief'));

      // broadcast reaches subscribers, then waits 10 minutes
      const b = await admin({ action: 'broadcast', title: 'Derby tonight!', body: 'Pick your side and run.' });
      assert.deepEqual(b.body, { devices: 1, sent: 1, inbox: true });
      assert.equal(sent[0].title, 'Derby tonight!');
      assert.equal((await admin({ action: 'broadcast', title: 'Again', body: 'Too soon' })).status, 429);
    });
  } finally {
    push.setPushSender(null);
    for (const [k, v] of [['KIMBIA_ADMIN_KEY', prev.key], ['VAPID_PUBLIC_KEY', prev.pub], ['VAPID_PRIVATE_KEY', prev.priv]]) {
      if (v == null) delete process.env[k]; else process.env[k] = v;
    }
  }
});

test('inbox: prizes, bet results and announcements reach the game, with or without notifications', async () => {
  const { handleChallengeRequest } = await import('./challenges.js');
  const { handleAdminRequest } = await import('./admin.js');
  const push = await import('./push.js');
  const prev = { key: process.env.KIMBIA_ADMIN_KEY, pub: process.env.VAPID_PUBLIC_KEY };
  process.env.KIMBIA_ADMIN_KEY = 'admin-test-key';
  delete process.env.VAPID_PUBLIC_KEY; // no notification keys: the inbox still fills
  const inbox = async (token) => (await push.handlePushRequest('POST', { action: 'inbox', token })).body.messages;
  try {
    await withDb(async () => {
      const at = (iso) => setLeaderboardClock(() => new Date(iso));
      at('2026-10-05T09:00:00Z');
      await post({ token: T.juma, name: 'Juma', score: 9000, distance: 900, duration: 120 });
      await post({ token: T.neema, name: 'Neema', score: 4000, distance: 400, duration: 120 });
      // a bet: Neema takes Juma's challenge and loses
      const made = await handleChallengeRequest('POST', { action: 'create', token: T.juma, name: 'Juma', runner: 'zuri', score: 9000, distance: 900, duration: 120, route: 'rabc', stake: 100 });
      await handleChallengeRequest('POST', { action: 'accept', token: T.neema, id: made.body.id, name: 'Neema' });
      await handleChallengeRequest('POST', { action: 'finish', token: T.neema, id: made.body.id, score: 5000 });

      at('2026-10-05T10:00:00Z');
      await handleAdminRequest('POST', { adminKey: 'admin-test-key', action: 'broadcast', title: 'Derby tonight!', body: 'Pick your side.' });

      // next day: Monday's prizes settle (twice, as if two servers raced) — one message each
      at('2026-10-06T09:00:00Z');
      await handleScoreRequest('GET', undefined, { board: 'day' });
      await handleScoreRequest('POST', { action: 'prizes', token: T.neema });

      const j = await inbox(T.juma);
      assert.deepEqual(j.map((m) => m.kind), ['prize', 'broadcast', 'bet-won', 'bet-taken']);
      assert.deepEqual(j[0].data, { kind: 'day', period: '2026-10-05', rank: 1, amount: 1000, score: 9000 });
      assert.equal(j[1].data.title, 'Derby tonight!');
      assert.equal(j[2].data.name, 'Neema');
      const n = await inbox(T.neema);
      assert.deepEqual(n.map((m) => m.kind), ['prize', 'broadcast'], "others' bets stay private");
      // someone who never saved a run still sees announcements
      assert.deepEqual((await inbox(T.kito)).map((m) => m.kind), ['broadcast']);
      // after 30 days a message drops out
      at('2026-11-10T09:00:00Z');
      assert.equal((await inbox(T.juma)).length, 0);
    });
  } finally {
    if (prev.key == null) delete process.env.KIMBIA_ADMIN_KEY; else process.env.KIMBIA_ADMIN_KEY = prev.key;
    if (prev.pub != null) process.env.VAPID_PUBLIC_KEY = prev.pub;
  }
});

test('name check: free, yours, taken with free suggestions; saving a taken name suggests too', async () => {
  await withDb(async () => {
    await post({ token: T.juma, name: 'Juma', score: 100, distance: 10, duration: 10 });
    const check = (token, name) => handleScoreRequest('POST', { action: 'check', token, name }).then((r) => r.body);
    assert.deepEqual(await check(T.neema, 'Neema'), { ok: true, name: 'Neema' });
    assert.deepEqual(await check(T.juma, 'juma'), { ok: true, name: 'juma', yours: true });
    const taken = await check(T.neema, ' JUMA ');
    assert.equal(taken.ok, false);
    assert.equal(taken.reason, 'taken');
    assert.ok(taken.suggestions.length >= 2 && taken.suggestions.every((n) => n.toLowerCase().startsWith('juma')));
    for (const n of taken.suggestions) assert.equal((await check(T.neema, n)).ok, true, `${n} is free`);
    assert.equal((await check(T.neema, '   ')).reason, 'invalid');
    assert.equal((await check(T.neema, 'x'.repeat(17))).reason, 'invalid');
    // trying to save it anyway: 409 with suggestions, and one of them saves fine
    const res = await post({ token: T.neema, name: 'Juma', score: 50, distance: 5, duration: 10 });
    assert.equal(res.status, 409);
    assert.equal(res.body.code, 'NAME_TAKEN');
    const ok = await post({ token: T.neema, name: res.body.suggestions[0], score: 50, distance: 5, duration: 10 });
    assert.equal(ok.status, 200);
    // a 16-character name with emoji counts by characters, like the game does
    const emoji = 'Gee🥀🥀🥀🥀🥀🥀🥀🥀🥀🥀🥀🥀🥀';
    assert.equal([...emoji].length, 16);
    assert.equal((await post({ token: T.amani, name: emoji, score: 1, distance: 1, duration: 1 })).status, 200);
  });
});

test('fair play: runs that could not have happened are turned away; real ones still save', async () => {
  // validation keeps the multiplier only when it is a real one
  assert.equal(validateSubmission({ token: T.juma, name: 'Juma', score: 10, mult: 31 }).ok, false);
  assert.equal(validateSubmission({ token: T.juma, name: 'Juma', score: 10, mult: 0 }).ok, false);
  assert.equal(validateSubmission({ token: T.juma, name: 'Juma', score: 10, mult: 7 }).value.mult, 7);
  assert.equal(validateSubmission({ token: T.juma, name: 'Juma', score: 10 }).value.mult, null);

  const { plausibleRun, scoreCeiling } = await import('./plausible.js');
  // the live board's real runs, as posted (top run: 1.63 M points over 35 km in about 18 minutes)
  for (const r of [
    { score: 1_630_889, distance: 34_973, seeds: 15_686, duration: 1080 },
    { score: 1_247_312, distance: 29_372, seeds: 12_000, duration: 896 },
    { score: 26_540, distance: 649, seeds: 207, duration: 40 },
    { score: 130, distance: 70, seeds: 2, duration: 5 },
  ]) assert.equal(plausibleRun(r).ok, true, JSON.stringify(r));
  assert.equal(plausibleRun({ score: 1000, distance: 5000, duration: 10 }).reason, 'pace');
  assert.equal(plausibleRun({ score: 99_999_999, distance: 1000, duration: 100 }).reason, 'score');
  assert.equal(plausibleRun({ score: 50_000, distance: 1000, duration: 100, mult: 1 }).reason, 'score', 'a ×1 runner cannot score 50 a metre');
  assert.equal(plausibleRun({ score: 50_000, distance: 1000, duration: 100, mult: 3 }).ok, true);
  assert.equal(plausibleRun({ score: 100, distance: 100, duration: 10, seeds: 90_000 }).reason, 'seeds');
  assert.ok(scoreCeiling(1000, 1) < scoreCeiling(1000, 2));

  await withDb(async () => {
    const real = await post({ token: T.juma, name: 'Juma', score: 9000, distance: 900, duration: 60, mult: 2 });
    assert.equal(real.status, 200);
    const fake = await post({ token: T.thief, name: 'Thief', score: 99_999_999, distance: 1000, duration: 100 });
    assert.equal(fake.status, 422);
    assert.equal(fake.body.code, 'IMPLAUSIBLE');
    const top = await handleScoreRequest('GET');
    assert.deepEqual(top.body.top.map((r) => r.name), ['Juma'], 'the fake run never reaches the board');
  });
});

test('fair play: a device can only post a few runs a minute; a busy network gets more room', async () => {
  const { RATE } = await import('./leaderboard.js');
  await withDb(async () => {
    setLeaderboardClock(() => new Date('2026-10-09T09:00:00Z'));
    const ctx = { ip: '41.59.1.1' };
    const send = (token, score) => handleScoreRequest('POST', { token, name: token === T.juma ? 'Juma' : 'Neema', score, distance: 100, duration: 10 }, undefined, ctx);
    for (let i = 0; i < RATE.perDevice; i++) assert.equal((await send(T.juma, 100 + i)).status, 200);
    const blocked = await send(T.juma, 999);
    assert.equal(blocked.status, 429);
    assert.equal(blocked.body.code, 'RATE_LIMITED');
    // another phone on the same carrier address is not held back
    assert.equal((await send(T.neema, 50)).status, 200);
    // a minute later the device may post again
    setLeaderboardClock(() => new Date('2026-10-09T09:01:01Z'));
    assert.equal((await send(T.juma, 1000)).status, 200);
  });
});

test('fair play: prize boards skip impossible runs and count the multiplier up to ×10', async () => {
  await withDb(async () => {
    setLeaderboardClock(() => new Date('2026-10-05T09:00:00Z'));
    // a ×30 veteran's 30,000 counts as 10,000 for prizes; a ×2 runner's 12,000 counts in full
    await post({ token: T.juma, name: 'Juma', score: 30_000, distance: 1000, duration: 60, mult: 30 });
    await post({ token: T.neema, name: 'Neema', score: 12_000, distance: 1000, duration: 60, mult: 2 });
    // saved before the multiplier was recorded: counts as it is
    await post({ token: T.amani, name: 'Amani', score: 11_000, distance: 1000, duration: 60 });
    const day = await handleScoreRequest('GET', undefined, { board: 'day' });
    assert.deepEqual(day.body.top.map((r) => [r.name, r.score]), [['Neema', 12_000], ['Amani', 11_000], ['Juma', 10_000]]);
    // the all-time board still shows the real score
    const all = await handleScoreRequest('GET');
    assert.equal(all.body.top[0].name, 'Juma');
    assert.equal(all.body.top[0].score, 30_000);
  });
});

test('fair play: friend bets turn away runs that could not have happened, and pay nothing for them', async () => {
  await withDb(async () => {
    // an impossible run cannot open a bet
    const bad = await chPost(host({ score: 99_999_999, distance: 1000, duration: 100 }));
    assert.equal(bad.status, 422);
    assert.equal(bad.body.code, 'IMPLAUSIBLE');
    assert.equal((await chPost(host({ score: 50_000, distance: 1000, duration: 100, mult: 1 }))).status, 422);
    assert.equal((await chPost(host({ score: 50_000, distance: 1000, duration: 100, mult: 3 }))).status, 200, 'a ×3 runner can');
    assert.equal((await chPost(host({ mult: 31 }))).status, 400);

    const { id } = (await chPost(host())).body;
    await chPost({ action: 'accept', token: T.neema, id, name: 'Neema' });
    // a rival's impossible answer does not settle the bet
    const fake = await chPost({ action: 'finish', token: T.neema, id, score: 99_999_999, distance: 1000, duration: 100 });
    assert.equal(fake.status, 422);
    assert.equal(fake.body.code, 'IMPLAUSIBLE');
    const tooFast = await chPost({ action: 'finish', token: T.neema, id, score: 6000, distance: 5000, duration: 10 });
    assert.equal(tooFast.status, 422);
    assert.equal((await chPost({ action: 'finish', token: T.neema, id, score: 6000, distance: 'far' })).status, 400);
    assert.equal((await chGet(id)).body.challenge.status, 'taken');
    assert.equal((await chPost({ action: 'collect', token: T.neema })).body.payouts.length, 0, 'no coins for a fake run');
    // a real run still settles it
    const fin = await chPost({ action: 'finish', token: T.neema, id, score: 7000, distance: 800, duration: 60, seeds: 60, mult: 2 });
    assert.deepEqual(fin.body, { winner: 'rival', pot: 200, hostName: 'Juma', hostScore: 5000 });
  });
});

test('fair play: the "Today #n" rank on the share card matches the day board', async () => {
  await withDb(async () => {
    setLeaderboardClock(() => new Date('2026-10-05T09:00:00Z'));
    const neema = await post({ token: T.neema, name: 'Neema', score: 12_000, distance: 1000, duration: 60, mult: 2 });
    assert.equal(neema.body.daily.rank, 1);
    const amani = await post({ token: T.amani, name: 'Amani', score: 11_000, distance: 1000, duration: 60 });
    assert.equal(amani.body.daily.rank, 2);
    // a ×30 veteran's 30,000 counts as 10,000 for the day, so it is third, not first
    const juma = await post({ token: T.juma, name: 'Juma', score: 30_000, distance: 1000, duration: 60, mult: 30 });
    assert.equal(juma.body.daily.rank, 3);
    const day = await handleScoreRequest('GET', undefined, { board: 'day' });
    assert.deepEqual(day.body.top.map((r) => r.name), ['Neema', 'Amani', 'Juma']);
    const kito = await post({ token: T.kito, name: 'Kito', score: 10_500, distance: 1000, duration: 60, mult: 2 });
    assert.equal(kito.body.daily.rank, 3, 'Kito\'s 10,500 beats Juma\'s capped 10,000');
    const day2 = await handleScoreRequest('GET', undefined, { board: 'day' });
    assert.equal(day2.body.top.findIndex((r) => r.name === 'Kito') + 1, 3);
  });
});

test('boards page past the top 20, count every runner and find you wherever you are', async () => {
  await withDb(async () => {
    setLeaderboardClock(() => new Date('2026-10-09T09:00:00Z'));
    const tokens = Array.from({ length: 120 }, (_, i) => tok(1000 + i));
    for (const [i, token] of tokens.entries()) {
      const res = await post({ token, name: `Runner${i}`, score: 1000 + i * 10, distance: 200, duration: 60 });
      assert.equal(res.status, 200);
    }
    const lowest = (await post({ token: tokens[0], name: 'Runner0', score: 1, distance: 1, duration: 1 })).body.entry.id;
    for (const board of ['all', 'day', 'week', 'month']) {
      const get = (q) => handleScoreRequest('GET', undefined, board === 'all' ? q : { board, ...q }).then((r) => r.body);
      // old clients still get the top 20
      assert.equal((await get({})).top.length, 20, board);
      const p1 = await get({ from: '0', me: String(lowest) });
      assert.equal(p1.total, 120, board);
      assert.equal(p1.top.length, 50);
      assert.equal(p1.more, true);
      assert.deepEqual([p1.top[0].rank, p1.top[0].name], [1, 'Runner119']);
      assert.deepEqual([p1.you.rank, p1.you.name], [120, 'Runner0'], `${board}: the last runner sees their own place`);
      const p3 = await get({ from: '100' });
      assert.equal(p3.top.length, 20);
      assert.equal(p3.more, false);
      assert.deepEqual([p3.top[0].rank, p3.top.at(-1).rank, p3.top.at(-1).name], [101, 120, 'Runner0']);
      assert.equal(p3.you, null);
      if (board !== 'all') assert.deepEqual([p1.top[0].prize > 0, p3.top[0].prize], [true, 0]);
      // nonsense paging falls back to the start
      assert.equal((await get({ from: '-5', me: 'x' })).from, 0);
    }
  });
});
