import { describe, it, expect, vi } from 'vitest';

// install.js listens for browser events at load; give it a minimal window
vi.stubGlobal('window', { addEventListener() {} });
vi.stubGlobal('navigator', { userAgent: '', maxTouchPoints: 0 });
vi.stubGlobal('matchMedia', () => ({ matches: false }));
const { detectDevice, installMethod } = await import('../app/ui/install.js');

const UA = {
  iphoneSafari18: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
  iphoneSafari26: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0.6367.88 Mobile/15E148 Safari/604.1',
  iphoneChromeOld: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/109.0 Mobile/15E148 Safari/604.1',
  iphoneInstagram: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0',
  ipadDesktop: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Mobile Safari/537.36',
  androidWhatsApp: 'Mozilla/5.0 (Linux; Android 13; SM-A135F; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0 Mobile Safari/537.36 WhatsApp/2.24',
  macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
};

describe('installing on every phone', () => {
  it('tells iPhone, iPad and Android apart, and which browser', () => {
    expect(detectDevice(UA.iphoneSafari18)).toMatchObject({ platform: 'ios', browser: 'safari', ipad: false });
    expect(detectDevice(UA.iphoneChrome)).toMatchObject({ platform: 'ios', browser: 'chrome', iosVersion: 17.04 });
    expect(detectDevice(UA.ipadDesktop, 5)).toMatchObject({ platform: 'ios', ipad: true, browser: 'safari' });
    expect(detectDevice(UA.macSafari, 0)).toMatchObject({ platform: 'desktop' });
    expect(detectDevice(UA.androidChrome)).toMatchObject({ platform: 'android', browser: 'chrome' });
    expect(detectDevice(UA.androidWhatsApp)).toMatchObject({ platform: 'android', inApp: true });
  });

  it('picks the right way to install', () => {
    const m = (ua, tp = 5, prompt = false) => installMethod(detectDevice(ua, tp), prompt);
    expect(m(UA.androidChrome, 5, true)).toBe('prompt');
    expect(m(UA.iphoneSafari18)).toBe('ios-safari');
    expect(m(UA.iphoneSafari26)).toBe('ios-safari26');
    expect(m(UA.ipadDesktop)).toBe('ios-safari');
    expect(m(UA.iphoneChrome)).toBe('ios-browser');
    expect(m(UA.iphoneChromeOld)).toBe('ios-open'); // before iOS 16.4 only Safari can
    expect(m(UA.iphoneInstagram)).toBe('ios-open');
    expect(m(UA.androidWhatsApp)).toBe('inapp');
    expect(m(UA.androidChrome)).toBe('menu');
  });
});
