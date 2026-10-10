/**
 * Invite links and the game's TikTok, from the player's side.
 *
 * A friend's link carries their invite code (?ref=…). On a brand-new device it is kept until
 * the runner's name is first saved, which ties the two together on the server
 * (server/referrals.js); seeds for invites land in the bank only once the server marks them
 * collected, the same way prizes do.
 */
import { REFERRAL } from '../data/content.js';
import { save, persist } from '../data/save.js';
import { linkOrigin } from './challenges.js';
import { playerToken } from './leaderboard.js';

const CODE_RE = /^[0-9a-z]{1,10}$/;

/** Keeps an invite code from the address bar when this device has no runner yet. Returns it. */
export function captureInvite(params) {
  const code = String(params.get('ref') ?? '').trim().toLowerCase();
  if (!CODE_RE.test(code)) return null;
  const fresh = save.playerId == null && !save.name;
  if (fresh && code !== save.ref) {
    save.ref = code; // sent with the first saved name, then dropped (leaderboard.js postScore)
    save.invitedBy = { code }; // the welcome card, until their qualifying run
    persist();
  }
  return fresh ? code : null;
}

export const myCode = () => (save.playerId != null ? Number(save.playerId).toString(36) : null);
export const inviteLink = (code = myCode()) => (code ? `${linkOrigin()}/?ref=${code}` : linkOrigin());

/** Who sent this invite ({ name, best, welcome }), or null. */
export async function fetchInviter(code) {
  try {
    const res = await fetch(`/api/scores?ref=${encodeURIComponent(code)}`, { headers: { accept: 'application/json' } });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

/**
 * This runner's invite code, friends and totals, banking any seeds earned since last time.
 * Resolves { ..., collected, welcome } (the seeds just added) or throws when offline.
 */
export async function fetchInvites() {
  const res = await fetch('/api/scores', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ action: 'referrals', token: playerToken() }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Could not load your invites'), { status: res.status });
  const gained = (data.collected ?? 0) + (data.welcome ?? 0);
  if (gained > 0) {
    save.seeds += gained;
    persist();
  }
  return { ...REFERRAL, ...data };
}

/** The game's TikTok handle (cached for the next visit), or null when there is none. */
export async function fetchSocial() {
  try {
    const res = await fetch('/api/scores?board=social', { headers: { accept: 'application/json' } });
    if (!res.ok) return save.tiktok ?? null;
    const { tiktok = null } = await res.json();
    if (tiktok !== (save.tiktok ?? null)) {
      save.tiktok = tiktok;
      persist();
    }
    return tiktok;
  } catch {
    return save.tiktok ?? null;
  }
}

export const tiktokUrl = (handle) => `https://www.tiktok.com/@${encodeURIComponent(handle)}`;

/** The TikTok note, drawn small enough for an icon button (the app's own mark, in white). */
export const TIKTOK_ICON = `<svg class="tt" viewBox="0 0 24 24" aria-hidden="true"><path fill="#25F4EE" d="M9.4 9.6v-.9a6.6 6.6 0 0 0-.9-.1 6.8 6.8 0 0 0-3.9 12.4 6.8 6.8 0 0 1 4.8-11.4Z"/><path fill="#25F4EE" d="M9.6 19.8a3.1 3.1 0 0 0 3.1-3V2.2h2.7a5 5 0 0 1-.1-1h-3.7v14.7a3.1 3.1 0 0 1-4.5 2.7 3.1 3.1 0 0 0 2.5 1.2Zm10.9-12.7v-.9a5 5 0 0 1-2.8-.8 5.1 5.1 0 0 0 2.8 1.7Z"/><path fill="#FE2C55" d="M17.7 5.4a5 5 0 0 1-1.2-3.2h-1a5.1 5.1 0 0 0 2.2 3.2ZM8.5 12.6a3.1 3.1 0 0 0-1.4 5.8 3.1 3.1 0 0 1 2.5-4.9 3 3 0 0 1 .9.1V9.9a6.6 6.6 0 0 0-.9-.1h-.2v2.9a3 3 0 0 0-.9-.1Z"/><path fill="#FE2C55" d="M20.5 7.1v2.8a8.8 8.8 0 0 1-5.1-1.6v7.4a6.8 6.8 0 0 1-10.7 5.5 6.8 6.8 0 0 0 11.7-4.6V9.2a8.8 8.8 0 0 0 5.1 1.6V7.2a5.2 5.2 0 0 1-1-.1Z"/><path fill="#fff" d="M15.4 15.7V8.3a8.8 8.8 0 0 0 5.1 1.6V7.1a5.1 5.1 0 0 1-2.8-1.7 5.1 5.1 0 0 1-2.2-3.2h-2.7v14.6a3.1 3.1 0 0 1-5.6 1.7 3.1 3.1 0 0 1 1.4-5.8 3 3 0 0 1 .9.1V9.9a6.8 6.8 0 0 0-4.8 11.4 6.8 6.8 0 0 0 10.7-5.5Z"/></svg>`;
