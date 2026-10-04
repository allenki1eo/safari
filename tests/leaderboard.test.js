import { describe, it, expect } from 'vitest';
import handler, { plausible, cleanName } from '../api/leaderboard.js';

describe('leaderboard API', () => {
  it('cleans names', () => {
    expect(cleanName('  Zuri ')).toBe('Zuri');
    expect(cleanName('<script>')).toBe('script');
    expect(cleanName('a')).toBeNull();
    expect(cleanName('Allen Kileo the Great Runner')).toHaveLength(16);
  });

  it('accepts real runs and rejects impossible ones', () => {
    expect(plausible({ score: 12000, distance: 2500, seeds: 300, duration: 110 })).toBe(true);
    expect(plausible({ score: 12000, distance: 2500, seeds: 300, duration: 5 })).toBe(false); // too fast
    expect(plausible({ score: 9e9, distance: 2500, seeds: 300, duration: 110 })).toBe(false);
    expect(plausible({ score: 100, distance: 100, seeds: 9999, duration: 10 })).toBe(false);
    expect(plausible({ score: NaN, distance: 1, seeds: 0, duration: 10 })).toBe(false);
  });

  it('answers 503 when Supabase is not configured', async () => {
    let code = 0;
    const res = { setHeader() {}, status(c) { code = c; return this; }, json() { return this; } };
    await handler({ method: 'GET', query: {} }, res);
    expect(code).toBe(503);
  });
});
