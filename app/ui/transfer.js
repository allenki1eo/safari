/**
 * Moving progress between browsers with a short code (see server/transfers.js).
 *
 * The case that matters most: on iPhone a home-screen app keeps its storage apart from
 * Safari's, so installing would start the game from nothing. When the player opens the install
 * steps we park their save under a code and put that code in the app's start URL (both the
 * page URL and, through /api/transfer, the manifest), so the installed app opens with it and
 * takes the save back. Settings → Move my progress does the same by hand.
 */
import { exportSave, importSave } from '../data/save.js';

async function call(body) {
  const res = await fetch('/api/transfer', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    /* empty */
  }
  if (!res.ok) throw Object.assign(new Error(data.error || 'Could not reach the game server.'), { status: res.status });
  return data;
}

/** "ABCD2345" → "ABCD-2345" for reading aloud or typing. */
export const prettyCode = (code) => `${code.slice(0, 4)}-${code.slice(4)}`;

/** Accepts what people type: lower case, spaces, dashes. */
export function cleanCode(raw) {
  const code = String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[A-HJ-NP-Z2-9]{8}$/.test(code) ? code : null;
}

let parked = null; // one code per page visit is plenty

/** Parks this browser's progress on the server and returns its code. */
export async function createProgressCode() {
  parked ??= call({ action: 'create', data: exportSave() }).then((r) => r.code).catch((err) => {
    parked = null;
    throw err;
  });
  return parked;
}

export async function fetchProgress(code) {
  return (await call({ action: 'claim', code })).data;
}

/** Takes the parked progress into this browser and restarts the game with it. */
export function applyProgress(data, code) {
  if (!importSave(data, { restoredCode: code })) return false;
  const url = new URL(location.href);
  url.searchParams.delete('restore');
  location.replace(url.pathname + url.search + url.hash);
  return true;
}

/**
 * Makes "Add to Home Screen" carry the code: the page URL (used when Safari ignores the
 * manifest) and the manifest's start URL both open the app with ?restore=CODE.
 */
export function carryCodeIntoInstall(code) {
  const url = new URL(location.href);
  url.searchParams.set('restore', code);
  history.replaceState(history.state, '', url.pathname + url.search + url.hash);
  const link = document.querySelector('link[rel="manifest"]');
  if (link) link.href = `/api/transfer?manifest=${code}`;
}

/** A link that opens the game in another browser with this progress. */
export const restoreLink = (code) => `${location.origin}/?restore=${code}`;
