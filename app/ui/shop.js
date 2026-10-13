/**
 * The shop, from the player's side: hearts and seed packs paid through a Snippe payment link
 * (server/payments.js). Buying sends the player to Snippe's checkout; it brings them back with
 * ?paid=<order>, and the game asks the server until the order is paid.
 *
 * Hearts are kept on the server (save.hearts is only a cache for the HUD). Bought seeds land in
 * the bank and are remembered in save.paidSeeds, so they never go into a friend-challenge bet.
 */
import { SHOP_PACKS } from '../data/content.js';
import { save, persist } from '../data/save.js';
import { playerToken } from './leaderboard.js';

async function call(body) {
  const res = await fetch('/api/pay', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ token: playerToken(), ...body }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'The shop is unavailable.'), { status: res.status, code: data.code });
  return data;
}

let shopOpen = null;
/** Whether the shop is open (its Snippe keys are set). Cached for the visit. */
export async function shopReady() {
  if (shopOpen == null) {
    try {
      const res = await fetch('/api/pay', { headers: { accept: 'application/json' } });
      shopOpen = res.ok && !!(await res.json()).ready;
    } catch {
      return false;
    }
  }
  return shopOpen;
}
export const shopReadyNow = () => !!shopOpen;

/** Bought seeds into the bank, kept apart from what can be bet. */
function bankSeeds(n) {
  if (!(n > 0)) return;
  save.seeds += n;
  save.paidSeeds = (save.paidSeeds ?? 0) + n;
  persist();
}

function cacheHearts(n) {
  if (Number.isFinite(n) && n !== save.hearts) {
    save.hearts = n;
    persist();
  }
}

/** Hearts, and any bought seeds still to bank. Resolves { hearts, seeds }. */
export async function syncWallet() {
  const data = await call({ action: 'wallet' });
  cacheHearts(data.hearts);
  bankSeeds(data.seeds);
  if (data.ready != null) shopOpen = !!data.ready;
  return data;
}

/** Opens a checkout for a pack and returns its Snippe URL. */
export async function startCheckout(packId) {
  const { url, order } = await call({ action: 'buy', pack: packId });
  save.lastOrder = order;
  persist();
  return url;
}

/** How an order stands; once paid, its hearts are cached and its seeds banked. */
export async function checkOrder(order) {
  const data = await call({ action: 'order', order });
  cacheHearts(data.hearts);
  bankSeeds(data.seeds);
  return data;
}

/** Spends one heart on a revive. Resolves true when the server took it. */
export async function useHeart() {
  try {
    const data = await call({ action: 'use' });
    cacheHearts(data.hearts);
    return true;
  } catch (err) {
    if (err.code === 'NO_HEARTS') cacheHearts(0);
    return false;
  }
}

/** Seeds that may go into a friend-challenge bet: everything but what was bought. */
export function bettableSeeds() {
  const paid = Math.min(save.paidSeeds ?? 0, save.seeds);
  if (paid !== (save.paidSeeds ?? 0)) {
    // spending in the shops uses bought seeds as well; what remains bought can't exceed the bank
    save.paidSeeds = paid;
    persist();
  }
  return Math.max(0, save.seeds - paid);
}

export const packById = (id) => SHOP_PACKS.find((p) => p.id === id);
export const tsh = (n) => `TSh ${Number(n).toLocaleString('en-US')}`;
