import { describe, it, expect } from 'vitest';
import { clampName, NAME_ATTRS } from '../app/ui/namefield.js';
import { runnerName } from '../app/ui/leaderboard.js';

describe('name field', () => {
  it('keeps names up to 16 characters as typed', () => {
    expect(clampName('Gee🥀')).toBe('Gee🥀');
    expect(clampName('Mwanaisha Kileo')).toBe('Mwanaisha Kileo');
  });

  it('cuts long names at 16 characters without splitting an emoji', () => {
    const long = '🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥'; // 18 emoji
    const cut = clampName(long);
    expect([...cut].length).toBe(16);
    expect(cut).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/); // no half emoji
    expect(runnerName(cut)).toBe(cut); // the server's rules accept it
    // a family emoji is 7 code points: it stays whole, and the cut lands after it
    expect(clampName('Kileo👨‍👩‍👧‍👦Kileo')).toBe('Kileo👨‍👩‍👧‍👦Kile');
    expect(clampName('Kileo Mwamba👨‍👩‍👧‍👦')).toBe('Kileo Mwamba'); // doesn't fit: left out, not broken
  });

  it('turns autocorrect and spellcheck off, and has no maxlength that counts emoji twice', () => {
    expect(NAME_ATTRS).toContain('autocorrect="off"');
    expect(NAME_ATTRS).toContain('spellcheck="false"');
    expect(NAME_ATTRS).not.toContain('maxlength');
  });
});
