import { describe, it, expect, beforeEach } from 'vitest';
import { save } from '../app/data/save.js';
import { UPDATES } from '../app/data/updates.js';
import { markUpdateSeen, unseenUpdate } from '../app/ui/updates.js';

describe("what's new", () => {
  beforeEach(() => {
    delete save.seenUpdate;
    save.runs = 0;
  });

  it('starts new players up to date, without a card', () => {
    expect(unseenUpdate()).toBe(null);
    expect(save.seenUpdate).toBe(UPDATES[0].id);
  });

  it('shows returning players the newest entry once', () => {
    save.runs = 12;
    expect(unseenUpdate()?.id).toBe(UPDATES[0].id);
    markUpdateSeen(UPDATES[0].id);
    expect(unseenUpdate()).toBe(null);
  });

  it('keeps every entry unique and filled in', () => {
    expect(new Set(UPDATES.map((u) => u.id)).size).toBe(UPDATES.length);
    for (const u of UPDATES) expect(u.items.length).toBeGreaterThan(0);
  });
});
