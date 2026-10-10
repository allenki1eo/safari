import { describe, it, expect, beforeEach } from 'vitest';
import { save } from '../app/data/save.js';
import { challengeKey, isChallengeDone, rememberChallengeDone, withoutChallenge } from '../app/ui/challenges.js';

describe('challenges you are finished with', () => {
  beforeEach(() => {
    save.challengesDone = [];
  });

  it('keys a challenge by its server id, or by an older link\'s numbers', () => {
    expect(challengeKey('ab12cd34', { name: 'Juma', score: 5000 })).toBe('ch:ab12cd34');
    expect(challengeKey(null, { name: 'Juma', score: 5000, route: 'r1a' })).toBe('ln:Juma|5000|r1a');
    expect(challengeKey(null, { name: 'Juma', score: 5000, day: '2026-10-05' })).toBe('ln:Juma|5000|2026-10-05');
    expect(challengeKey(null, null)).toBeNull();
  });

  it('remembers a played or declined challenge once, and keeps the list short', () => {
    expect(isChallengeDone('ch:ab12cd34')).toBe(false);
    rememberChallengeDone('ch:ab12cd34');
    rememberChallengeDone('ch:ab12cd34');
    expect(save.challengesDone).toEqual(['ch:ab12cd34']);
    expect(isChallengeDone('ch:ab12cd34')).toBe(true);
    expect(isChallengeDone(null)).toBe(false);
    for (let i = 0; i < 80; i++) rememberChallengeDone(`ch:${String(i).padStart(8, '0')}`);
    expect(save.challengesDone).toHaveLength(60);
    expect(isChallengeDone('ch:00000079')).toBe(true);
  });

  it('takes the challenge out of the address so a reload does not bring it back', () => {
    expect(withoutChallenge('?ch=ab12cd34&c=5000&m=700&s=50&n=Juma&from=2&r=zuri&rt=r1a')).toBe('');
    expect(withoutChallenge('?c=5000&n=Juma&day=2026-10-05&invite=abc')).toBe('?invite=abc');
    expect(withoutChallenge('')).toBe('');
  });
});
