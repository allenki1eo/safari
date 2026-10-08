/**
 * Notifications, from the player's side: whether this browser can have them, asking, and
 * keeping the server's copy of the subscription tied to this device's runner.
 *
 * Android (Chrome, Edge, Samsung, Firefox) and desktop browsers can be asked straight away.
 * iPhone and iPad only allow it once the game runs from the home screen (iOS 16.4+), so there
 * the answer is "install first". The browser's own permission prompt can be shown only once
 * if the player says no, so the game asks with its own sheet first, at a moment that makes sense.
 */
import { save, persist } from '../data/save.js';
import { lang } from '../i18n.js';
import { device, standalone } from './install.js';
import { playerToken } from './leaderboard.js';

const hasPush = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/**
 * yes          can ask now
 * on           already on for this browser
 * blocked      the player said no in the browser; only its site settings can undo that
 * ios-install  iPhone/iPad outside the home-screen app
 * no           this browser cannot do it
 */
export function notifyState() {
  if (device.platform === 'ios' && !standalone()) return device.iosVersion >= 16.4 || device.safariVersion >= 16 ? 'ios-install' : 'no';
  if (!hasPush()) return 'no';
  if (Notification.permission === 'denied') return 'blocked';
  if (Notification.permission === 'granted' && save.notify) return 'on';
  return 'yes';
}

let ready = null; // the server's public key, once asked: null until then, '' when not set up
let readyAsk = null;
/** Whether the server can send notifications at all (the owner has added the keys). Cached. */
export async function pushReady() {
  readyAsk ??= api().then((d) => (ready = d.publicKey || '')).catch(() => (readyAsk = null, ''));
  return !!(await readyAsk);
}
/** The cached answer, for code that cannot wait (Settings): false until known. */
export const pushReadyNow = () => !!ready;

async function api(body) {
  const res = await fetch('/api/push', {
    method: body ? 'POST' : 'GET',
    headers: { accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Notifications are unavailable.'), { status: res.status });
  return data;
}

function keyBytes(base64url) {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function register(sub) {
  await api({ action: 'subscribe', token: playerToken(), subscription: sub.toJSON(), lang });
}

/** Asks the browser, subscribes, and tells the server. Resolves 'on', 'blocked' or 'off'. */
export async function enableNotifications() {
  const publicKey = (await pushReady()) ? ready : '';
  if (!publicKey) throw Object.assign(new Error('Notifications are not switched on yet.'), { status: 503 });
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off';
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
  await register(sub);
  save.notify = true;
  persist();
  return 'on';
}

export async function disableNotifications() {
  save.notify = false;
  persist();
  const reg = await navigator.serviceWorker?.getRegistration?.();
  const sub = await reg?.pushManager?.getSubscription();
  if (!sub) return;
  await api({ action: 'unsubscribe', endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}

/**
 * On start: re-send this browser's subscription so it stays tied to the runner (after a name
 * change or recovery, or when the browser rotates it). Quiet on failure.
 */
export async function refreshNotifications() {
  if (!save.notify || !hasPush() || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await register(sub);
    else {
      save.notify = false;
      persist();
    }
  } catch {
    /* next time */
  }
}
