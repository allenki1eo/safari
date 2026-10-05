/**
 * Getting a runner back (see server/accounts.js). A runner name is owned by a device key kept
 * in this browser; a recovery PIN plus a cloud copy of the save let the player take their
 * runner to any phone or browser, and back again.
 */
import { save, persist, exportSave, importSave, mergeSaves } from '../data/save.js';

async function call(body) {
  const res = await fetch('/api/account', {
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
  if (!res.ok) throw Object.assign(new Error(data.error || 'Could not reach the game server.'), { status: res.status, code: data.code, triesLeft: data.triesLeft });
  return data;
}

function freshKey() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Protects this device's runner with a PIN and backs up the save straight away. */
export async function setRecoveryPin(pin) {
  const data = await call({ action: 'setPin', token: save.playerToken, pin, save: exportSave() });
  save.pinSet = true;
  persist();
  return data;
}

let lastSync = 0;
/** Keeps the cloud copy current (after each run); quiet and throttled. */
export function syncSave() {
  if (!save.pinSet || !save.playerToken || Date.now() - lastSync < 15000) return;
  lastSync = Date.now();
  call({ action: 'sync', token: save.playerToken, save: exportSave() }).catch((err) => {
    if (err.code === 'NO_PIN' || err.code === 'NO_RUNNER') {
      save.pinSet = false;
      persist();
    }
  });
}

/**
 * Runner name + PIN (or an admin recovery code). On success this device gets its own key to
 * the runner and the cloud save is folded into what's here; nothing earned on either side is
 * lost. Returns the server's answer ({ name, best, needsPin }).
 */
export async function recoverRunner(name, pin) {
  const key = freshKey();
  const res = await call({ action: 'recover', token: key, name, pin });
  const merged = mergeSaves(exportSave(), res.save);
  importSave(merged, { playerToken: key, name: res.name, pinSet: !res.needsPin, playerId: null, pinAsked: true });
  return res;
}
