/**
 * Installing the game to the home screen.
 *
 * Chrome, Edge and Samsung Internet on Android (and desktop) offer a native prompt
 * (`beforeinstallprompt`), which we hold on to and show when the player taps Install.
 *
 * iPhone and iPad have no prompt: Apple only lets a page be added from the browser's Share
 * sheet. So we work out which iOS browser this is and where its Share button lives, and the
 * Install button walks the player through it (with an arrow pointing at the button):
 *   - Safari up to iOS 18: Share in the bottom toolbar (top right on iPad)
 *   - Safari 26+: Share sits behind the ••• button, bottom right
 *   - Chrome, Edge and Firefox on iOS 16.4+: their own Share button in the address bar
 *   - older iOS outside Safari, and in-app browsers (WhatsApp, Instagram, Facebook): open the
 *     game in Safari first (we offer to copy the link)
 * Once the game runs from the home screen the button goes away.
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

/** What kind of device and browser this is, from the user agent (pure, so it can be tested). */
export function detectDevice(ua = navigator.userAgent || '', touchPoints = navigator.maxTouchPoints || 0) {
  // iPadOS 13+ asks for the desktop site and calls itself a Mac; touch gives it away
  const ipad = /iPad/i.test(ua) || (/Macintosh/i.test(ua) && touchPoints > 1);
  const ios = ipad || /iPhone|iPod/i.test(ua);
  const os = ua.match(/OS (\d+)[_.](\d+)/i);
  const iosVersion = ios && os ? Number(os[1]) + Number(os[2]) / 100 : 0;
  const inApp = /FBAN|FBAV|Instagram|WhatsApp|Line\/|Snapchat|TikTok|musical_ly|; wv\)/i.test(ua);
  let browser = 'other';
  if (/CriOS/i.test(ua)) browser = 'chrome';
  else if (/EdgiOS|EdgA|Edg\//i.test(ua)) browser = 'edge';
  else if (/FxiOS|Firefox/i.test(ua)) browser = 'firefox';
  else if (/SamsungBrowser/i.test(ua)) browser = 'samsung';
  else if (/Chrome\//i.test(ua)) browser = 'chrome';
  else if (/Safari\//i.test(ua) && /Version\//i.test(ua)) browser = 'safari';
  // Safari's own version (iOS 26 reports 18_6 as the OS but Version/26)
  const sv = ua.match(/Version\/(\d+)/);
  const safariVersion = sv ? Number(sv[1]) : 0;
  return {
    platform: ios ? 'ios' : /Android/i.test(ua) ? 'android' : 'desktop',
    ipad,
    iosVersion,
    safariVersion,
    browser,
    inApp,
  };
}

/**
 * How installing works on this device, given whether a native prompt is waiting:
 *   prompt        one tap (Android / desktop Chrome, Edge, Samsung)
 *   ios-safari    Share → Add to Home Screen (Share at the bottom; top right on iPad)
 *   ios-safari26  ••• → Share → Add to Home Screen (Safari 26's compact toolbar)
 *   ios-browser   Chrome / Edge / Firefox on iOS 16.4+: their Share button → Add to Home Screen
 *   ios-open      open it in Safari first (older iOS outside Safari, or an in-app browser)
 *   inapp         Android in-app browser: open in Chrome first
 *   menu          browser menu → Install app
 */
export function installMethod(d, hasPrompt = false) {
  if (hasPrompt) return 'prompt';
  if (d.platform === 'ios') {
    if (d.inApp) return 'ios-open';
    if (d.browser === 'safari') return d.safariVersion >= 26 && !d.ipad ? 'ios-safari26' : 'ios-safari';
    if (d.iosVersion >= 16.4 && ['chrome', 'edge', 'firefox'].includes(d.browser)) return 'ios-browser';
    return 'ios-open';
  }
  if (d.inApp) return 'inapp';
  return 'menu';
}

export const device = detectDevice();

export const install = {
  /** Show the Install button? Everywhere except inside the installed app. */
  get offered() {
    return !standalone();
  },

  /** See installMethod. */
  get how() {
    return installMethod(device, !!deferred);
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
