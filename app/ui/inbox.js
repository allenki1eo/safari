/**
 * The in-game inbox, from the player's side: their prizes, bet results and the game's
 * announcements (server/inbox.js), each worded here in the player's language.
 */
import { save, persist } from '../data/save.js';
import { lang, t } from '../i18n.js';
import { playerToken } from './leaderboard.js';
import { ordinal, periodName } from './prizes.js';

const EVERY = 60 * 1000;
let cache = null;
let fetchedAt = 0;

/** This player's messages, newest first. Cached for a minute unless `fresh`. */
export async function fetchInbox(fresh = false) {
  if (!fresh && cache && Date.now() - fetchedAt < EVERY) return cache;
  const res = await fetch('/api/push', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ action: 'inbox', token: playerToken() }),
  });
  if (!res.ok) throw new Error(t('The inbox is unavailable.'));
  cache = (await res.json()).messages ?? [];
  fetchedAt = Date.now();
  return cache;
}

export const unreadCount = (messages) => messages.filter((m) => m.at > (save.inboxSeen ?? 0)).length;

export function markInboxRead(messages) {
  const newest = Math.max(save.inboxSeen ?? 0, ...messages.map((m) => m.at));
  if (newest !== save.inboxSeen) {
    save.inboxSeen = newest;
    persist();
  }
}

const fmt = (n) => Math.floor(Number(n) || 0).toLocaleString();
const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Icon, title and line for one message. */
export function describe(m) {
  const d = m.data ?? {};
  switch (m.kind) {
    case 'prize':
      return {
        icon: d.rank <= 3 ? ['🥇', '🥈', '🥉'][d.rank - 1] : '🎁',
        title: capital(t('{place} on {board}', { place: ordinal(d.rank), board: periodName(d.kind, d.period) })),
        body: t('+{n} seeds — added to your bank.', { n: fmt(d.amount) }),
        tone: 'gold',
      };
    case 'bet-taken':
      return { icon: '🎯', title: t('{name} took your bet', { name: d.name }), body: t("{n} seeds each — they're racing your shadow now.", { n: fmt(d.stake) }) };
    case 'bet-won':
      return { icon: '🏆', title: t("{name} couldn't beat you", { name: d.name }), body: t('You won the {pot}-seed pot.', { pot: fmt(d.pot) }), tone: 'gold' };
    case 'bet-lost':
      return { icon: '😬', title: t('{name} beat your challenge', { name: d.name }), body: t('{score} took the {pot}-seed pot. Run it back?', { score: fmt(d.score), pot: fmt(d.pot) }) };
    case 'broadcast':
      return { icon: '📣', title: String(d.title ?? ''), body: String(d.body ?? ''), tone: 'news' };
    default:
      return { icon: '✉️', title: t('Message'), body: '' };
  }
}

/** "just now", "5 min ago", "3 h ago", "2 d ago" */
export function ago(at, from = Date.now()) {
  const s = Math.max(0, (from - at) / 1000);
  if (s < 60) return t('just now');
  if (s < 3600) return t('{n} min ago', { n: Math.floor(s / 60) });
  if (s < 86400) return t('{n} h ago', { n: Math.floor(s / 3600) });
  if (s < 86400 * 7) return t('{n} d ago', { n: Math.floor(s / 86400) });
  return new Date(at).toLocaleDateString(lang === 'sw' ? 'sw-TZ' : 'en-GB', { day: 'numeric', month: 'short' });
}
