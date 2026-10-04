import { RUNNERS } from '../data/content.js';

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

/** Posts a finished run. Rank is assigned by the server; it is not sent. */
export async function postScore(entry) {
  const res = await fetch('/api/scores', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
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
  if (!res.ok) throw Object.assign(new Error(data.error || 'Could not post your score'), { status: res.status });
  return data;
}

function medal(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return String(rank);
}

function rowHtml(row, { youId, youName }) {
  const yours = (youId != null && row.id === youId) || (!!youName && row.name === youName);
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
