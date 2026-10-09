/**
 * Keeping players on the newest version. A phone can keep running an old copy for days (an
 * installed app stays in memory, a tab stays open), so the title screen asks /version.json which
 * build is live and, when it is not this one, offers a one-tap refresh. After an update, the
 * newest entry in UPDATES is shown once as "What's new".
 */
import { UPDATES } from '../data/updates.js';
import { save, persist } from '../data/save.js';

export const BUILD = typeof __BUILD__ !== 'undefined' ? __BUILD__ : 'dev';
const EVERY = 30 * 1000;
let checkedAt = 0;
let pending = null;

/** Resolves true when a newer build than this one is live. Asks at most every 30 seconds. */
export async function updateWaiting() {
  if (BUILD === 'dev') return false;
  if (pending) return pending;
  if (Date.now() - checkedAt < EVERY) return false;
  checkedAt = Date.now();
  pending = fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((v) => !!v?.build && v.build !== BUILD)
    .catch(() => false)
    .finally(() => (pending = null));
  return pending;
}

/** Fetches the new service worker and reloads onto the new build. */
export async function applyUpdate() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration?.();
    await reg?.update();
  } catch {
    /* the reload still brings the new page */
  }
  location.reload();
}

/** The newest "What's new" entry this player has not seen yet (new players start up to date). */
export function unseenUpdate() {
  const latest = UPDATES[0];
  if (!latest) return null;
  if (!save.seenUpdate && !(save.runs > 0)) {
    save.seenUpdate = latest.id;
    persist();
    return null;
  }
  return save.seenUpdate === latest.id ? null : latest;
}

export function markUpdateSeen(id) {
  save.seenUpdate = id;
  persist();
}
