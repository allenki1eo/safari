import { RUNNERS } from '../data/content.js';
import { save, persist } from '../data/save.js';

const EMOJI = Object.fromEntries(RUNNERS.map((runner) => [runner.id, runner.emoji]));

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

export async function fetchBoard() {
  const res = await fetch('/api/scores', { headers: { accept: 'application/json' } });
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
    }),
  });
  const data = await readJson(res);
  if (!res.ok) throw Object.assign(new Error(data.error || 'Could not post your score'), { status: res.status, code: data.code });
  return data;
}

function medal(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return String(rank);
}

function rowHtml(row, { youId, youName }) {
  // prefer the server id; fall back to the (unique) name before this device has posted
  const yours = youId != null ? row.id === youId : !!youName && row.name.toLowerCase() === youName.toLowerCase();
  const emoji = EMOJI[row.runner] || '🏃';
  return `
    <div class="lb-row${yours ? ' you' : ''}">
      <div class="lb-rank">${medal(row.rank)}</div>
      <div class="lb-who">
        <b>${emoji} ${esc(row.name)}${yours ? ' <span class="you-tag">you</span>' : ''}</b>
        <span>${fmt(row.distance)}m · ${fmt(row.seeds)} seeds · ${fmt(row.allies)} allies</span>
      </div>
      <div class="lb-score">${fmt(row.score)}</div>
    </div>`;
}

export function renderRows(top, opts = {}) {
  if (!top?.length) {
    return `<div class="panel lb-empty-card"><div class="e">🌱</div><p>No scores yet. Finish a run and put your name on the board.</p></div>`;
  }
  return `<div class="lb-list">${top.map((row) => rowHtml(row, opts)).join('')}</div>`;
}
