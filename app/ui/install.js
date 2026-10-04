/**
 * Installing the game to the home screen.
 *
 * Chrome, Edge and Samsung Internet offer a native prompt (`beforeinstallprompt`), which we
 * hold on to and show when the player taps Install. Safari on iPhone and iPad has no prompt,
 * and in-app browsers (WhatsApp, Instagram, Facebook) often can't install at all, so for
 * those the button opens a short how-to instead. Once the game runs from the home screen the
 * button goes away.
 */

let deferred = null;
const listeners = new Set();
const notify = (event) => listeners.forEach((fn) => fn(event));

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); // keep the mini-infobar away; our own button asks at a better moment
  deferred = e;
  notify('ready');
});

window.addEventListener('appinstalled', () => {
  deferred = null;
  notify('installed');
});

/** True when the game is already running as an installed app. */
export function standalone() {
  return (
    matchMedia('(display-mode: standalone)').matches ||
    matchMedia('(display-mode: fullscreen)').matches ||
    navigator.standalone === true
  );
}

const ua = () => navigator.userAgent || '';
const isIOS = () => /iphone|ipad|ipod/i.test(ua()) || (ua().includes('Macintosh') && navigator.maxTouchPoints > 1);
const inAppBrowser = () => /FBAN|FBAV|Instagram|WhatsApp|Line\/|; wv\)/i.test(ua());

export const install = {
  /** Show the Install button? Everywhere except inside the installed app. */
  get offered() {
    return !standalone();
  },

  /** How installing works here: 'prompt' (native), 'ios', 'inapp' or 'menu'. */
  get how() {
    if (deferred) return 'prompt';
    if (inAppBrowser()) return 'inapp';
    if (isIOS()) return 'ios';
    return 'menu';
  },

  /** Shows the native prompt. Resolves 'accepted', 'dismissed' or 'unavailable'. */
  async prompt() {
    if (!deferred) return 'unavailable';
    const e = deferred;
    deferred = null;
    e.prompt();
    const { outcome } = await e.userChoice;
    notify(outcome);
    return outcome;
  },

  /** Calls `fn('ready' | 'installed' | 'accepted' | 'dismissed')`; returns an unsubscribe. */
  on(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
