/**
 * Day, week and month prizes, from the player's side: collecting what they won, and the
 * labels and countdowns the board and title screen show. The server decides the winners
 * (server/prizes.js); seeds only land in the bank once it has marked a prize collected.
 */
import { PRIZES } from '../data/content.js';
import { darDay, periodEnd, periodOf } from '../data/daily.js';
import { save, persist } from '../data/save.js';
import { lang, t } from '../i18n.js';
import { playerToken } from './leaderboard.js';

export { PRIZES };

/** Collects every prize this runner has won since they last looked. Quiet when there are none. */
export async function collectPrizes() {
  if (!save.name) return [];
  const res = await fetch('/api/scores', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ action: 'prizes', token: playerToken() }),
  });
  if (!res.ok) return [];
  const { prizes = [] } = await res.json().catch(() => ({}));
  if (!prizes.length) return [];
  save.seeds += prizes.reduce((sum, p) => sum + p.amount, 0);
  persist();
  return prizes;
}

/** When the current day, week or month closes. */
export const closesAt = (kind, at = new Date()) => periodEnd(kind, periodOf(kind, darDay(at)));

/** "5h 12m", "2d 4h", "38m 05s" until `ms`. */
export function timeLeft(ms, from = Date.now()) {
  const s = Math.max(0, Math.floor((ms - from) / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d) return `${d}${t('d')} ${h}${t('h')}`;
  if (h) return `${h}${t('h')} ${m}${t('m')}`;
  return `${m}${t('m')} ${String(s % 60).padStart(2, '0')}${t('s')}`;
}

const locale = () => (lang === 'sw' ? 'sw-TZ' : 'en-GB');
const dateOf = (day, opts) => new Date(`${day}T12:00:00Z`).toLocaleDateString(locale(), { timeZone: 'UTC', ...opts });

/** "Monday's board", "the week of 5 Oct", "October's board". */
export function periodName(kind, period) {
  if (kind === 'day') return t("{day}'s board", { day: dateOf(period, { weekday: 'long' }) });
  if (kind === 'week') return t('the week of {date}', { date: dateOf(period, { day: 'numeric', month: 'short' }) });
  return t("{month}'s board", { month: dateOf(`${period}-01`, { month: 'long' }) });
}

export const ordinal = (n) => {
  if (lang === 'sw') return `${t('wa')} ${n}`;
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

export const MEDAL = ['🥇', '🥈', '🥉'];
