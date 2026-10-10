import { RUNNERS } from '../data/content.js';
import { save, persist } from '../data/save.js';

export const NAME_MAX = 16;

const EMOJI = Object.fromEntries(RUNNERS.map((runner) => [runner.id, runner.emoji]));

/** Same cleaning rules as the server: trim, collapse spaces, 1–16 characters. */
export function runnerName(raw) {
  if (typeof raw !== 'string') return '';
  const name = raw.normalize('NFKC').replace(/[\u0000-\u001F\u007F]/g, '').trim().replace(/\s+/g, ' ');
  const length = [...name].length;
  if (length < 1 || length > NAME_MAX) return '';
  return name;
}

/** A name already on the device is posted immediately. Otherwise the card must ask. */
export function scoreSavePlan(savedName) {
  const name = runnerName(savedName);
  if (name) return { action: 'save', name };
  return { action: 'ask' };
}

/**
 * Run again / Home must not throw away an unsaved finish.
 * Returns ask (stay and prompt), save (post this name, then leave), or leave.
 */
export function leaveDecision({ alreadySaved, savedName, typedName }) {
  if (alreadySaved) return { action: 'leave' };
  const name = runnerName(typedName) || runnerName(savedName);
  if (!name) return { action: 'ask' };
  return { action: 'save', name };
}

const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

const fmt = (n) => Math.floor(Number(n) || 0).toLocaleString();

async function readJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

/** Rows per page on the full leaderboard screen (server/leaderboard.js BOARD_PAGE). */
export const BOARD_PAGE = 50;

/**
 * A board. With `page` ({ from, me }) it comes a page at a time with the total number of runners
 * and, when `me` is a player id, that runner's own row wherever they stand.
 */
export async function fetchBoard(board, page = null) {
  const params = new URLSearchParams();
  if (board && board !== 'all') params.set('board', board);
  if (page) {
    params.set('from', String(page.from ?? 0));
    if (page.me != null) params.set('me', String(page.me));
  }
  const query = String(params) ? `?${params}` : ''; // (not params.size: older Android browsers lack it)
  const res = await fetch(`/api/scores${query}`, { headers: { accept: 'application/json' } });
  const data = await readJson(res);
  if (!res.ok) throw Object.assign(new Error(data.error || 'Could not load the board'), { status: res.status });
  return data;
}

/**
 * This device's secret player key. The server only keeps a hash of it; holding it is
 * what makes a runner name yours, so nobody else can post under it.
 */
export function playerToken() {
  if (!/^[a-f0-9]{64}$/.test(save.playerToken || '')) {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    save.playerToken = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
    persist();
  }
  return save.playerToken;
}

/**
 * Posts a run (or just claims a name when score is 0). The server keeps one row per
 * player and only replaces it when the run beats their best. Rank is computed server-side.
 * A 409 with code NAME_TAKEN means another player owns that name.
 */
export async function postScore(entry) {
  const res = await fetch('/api/scores', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      token: playerToken(),
      name: entry.name,
      score: entry.score,
      distance: entry.distance,
      seeds: entry.seeds,
      allies: entry.allies,
      chapter: entry.chapter,
      runner: entry.runner,
      duration: entry.duration ?? 0,
      mult: entry.mult ?? undefined,
      side: save.side ?? undefined, // Derby Day
      ref: save.ref ?? undefined, // the friend whose invite brought this runner (read once, when they are created)
    }),
  });
  const data = await readJson(res);
  if (!res.ok) throw Object.assign(new Error(data.error || 'Could not post your score'), { status: res.status, code: data.code, suggestions: data.suggestions ?? [] });
  if (save.ref) {
    delete save.ref; // their runner exists now; the invite has done its job
    persist();
  }
  return data;
}

function medal(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return String(rank);
}

export function rowHtml(row, { youId, youName, crown }) {
  // prefer the server id; fall back to the (unique) name before this device has posted
  const yours = youId != null ? row.id === youId : !!youName && row.name.toLowerCase() === youName.toLowerCase();
  const emoji = EMOJI[row.runner] || '🏃';
  return `
    <div class="lb-row${yours ? ' you' : ''}">
      <div class="lb-rank">${medal(row.rank)}</div>
      <div class="lb-who">
        <b>${emoji} ${esc(row.name)}${crown && row.name === crown ? ' <span class="crown" title="Last champion">👑</span>' : ''}${yours ? ' <span class="you-tag">you</span>' : ''}</b>
        <span>${fmt(row.distance)}m · ${fmt(row.seeds)} seeds · ${fmt(row.allies)} allies</span>
      </div>
      <div class="lb-score">${fmt(row.score)}${row.prize ? `<span class="lb-prize">+${fmt(row.prize)}<i class="seed"></i></span>` : ''}</div>
    </div>`;
}

export function renderRows(top, opts = {}) {
  if (!top?.length) {
    return `<div class="panel lb-empty-card"><div class="e">🌱</div><p>No scores yet. Finish a run and put your name on the board.</p></div>`;
  }
  return `<div class="lb-list">${top.map((row) => rowHtml(row, opts)).join('')}</div>`;
}
