/**
 * Obstacle pattern generator — pure data, no three.js, so it can be unit-tested
 * for fairness. A chunk is described as a list of ops the Game turns into meshes:
 *
 *   ['obs', kind, lane, wz, opts]        obstacle centred at journey-distance wz
 *   ['line', lane, from, to, step, y, rampUp]   straight line of seeds
 *   ['arc', lane, centerWz]              seeds following a jump arc
 *   ['totem', allyId|null, lane, wz]     ally totem
 *   ['box', lane, wz, y]                 Zawadi prize box (y > 0 sits on a truck roof)
 */

export const GRAVITY = 58;
export const JUMP_V = 16;
export const TRUCK_LEN = 7;

/**
 * Collision profiles. `hard` obstacles can only be dodged by switching lanes,
 * `jump` ones can be hopped and `slide` ones ducked under.
 */
export const KINDS = {
  log: { y0: 0, y1: 0.85, len: 0.9, pass: 'jump' },
  croc: { y0: 0, y1: 0.75, len: 2.6, pass: 'jump' },
  gate: { y0: 1.12, y1: 3.4, len: 0.4, pass: 'slide' },
  boulder: { y0: 0, y1: 2.7, len: 2.0, pass: 'hard' },
  mound: { y0: 0, y1: 2.9, len: 1.5, pass: 'hard' },
  cart: { y0: 0, y1: 2.5, len: 2.4, pass: 'hard' },
  gorilla: { y0: 0, y1: 2.3, len: 1.8, pass: 'hard' },
  rockfall: { y0: 0, y1: 2.5, len: 1.9, pass: 'hard' },
  truck: { y0: 0, y1: 2.7, len: TRUCK_LEN, top: 2.7, pass: 'hard' },
  ramp: { y0: 0, y1: 0, len: 5, ramp: 2.7, pass: 'ramp' },
  rhino: { y0: 0, y1: 1.9, len: 2.4, pass: 'hard', charger: true },
  buffalo: { y0: 0, y1: 1.8, len: 2.2, pass: 'hard', charger: true },
  wildebeest: { y0: 0, y1: 1.7, len: 1.8, pass: 'hard', charger: true },
  lion: { y0: 0, y1: 1.55, len: 2.1, pass: 'hard', charger: true },
  water: { y0: 0, y1: 0.42, len: 6, pass: 'jump', water: true },
  crossing: { y0: 0, y1: 3.2, len: 1.8, pass: 'hard', crosser: true },
  canoe: { y0: 0, y1: 1.6, len: 3.0, pass: 'hard' },
};

const L = [0, 1, 2];

/** Builds one chunk. `rng` defaults to Math.random but tests inject a seeded one. */
export function makeChunk({ z, D, speed, region, wantTotem = false, wantBox = false, rng = Math.random }) {
  const rand = (a, b) => a + rng() * (b - a);
  const randi = (n) => Math.floor(rng() * n);
  const pick = (a) => a[randi(a.length)];
  const shuffle = (a) => {
    const b = [...a];
    for (let i = b.length - 1; i > 0; i--) {
      const j = randi(i + 1);
      [b[i], b[j]] = [b[j], b[i]];
    }
    return b;
  };
  const ops = [];
  const obs = (kind, lane, wz, opts) => ops.push(['obs', kind, lane, wz, opts ?? {}]);
  const line = (lane, from, to, step = 2, y = 0, rampUp = false) => ops.push(['line', lane, from, to, step, y, rampUp]);
  const arc = (lane, c) => ops.push(['arc', lane, c]);
  const totem = (lane, wz) => ops.push(['totem', null, lane, wz]);
  const prize = (lane, wz, y = 0) => wantBox && ops.push(['box', lane, wz, y]);
  const block = () => pick(region.blocks);
  /** lead distance so a charger moving at v arrives around the chunk position */
  const lead = (v) => (z - D) * (v / Math.max(speed, 1));

  const pats = [
    ['single', 3], ['double', D > 300 ? 3 : 1], ['logs', 2], ['gates', 2], ['mix', D > 400 ? 3 : 1],
    ['trucks', region.trucks ? (D > 250 ? 3.5 : 0.5) : 0], ['oncoming', region.trucks && D > 900 ? 2 : 0],
    ['snake', 1.2], ['zigzag', D > 500 ? 2 : 0], ['logrun', D > 350 ? 1.4 : 0],
    // Daily route moments: a river you have to jump, a lion that can clip you,
    // and a wildebeest close enough to fill the screen. Same weights everywhere,
    // so the day's seed — not the region — decides when they show up.
    ['river', 1.7], ['lion', 1.15], ['beast', 1.25],
  ];
  for (const [name, w] of Object.entries(region.specials ?? {})) pats.push([name, D > 150 ? w : w * 0.3]);
  const total = pats.reduce((s, p) => s + p[1], 0);
  let r = rng() * total;
  let pat = 'single';
  for (const [name, w] of pats) {
    if ((r -= w) <= 0) {
      pat = name;
      break;
    }
  }

  switch (pat) {
    case 'single': {
      const l = randi(3);
      obs(block(), l, z + 2);
      const free = L.filter((x) => x !== l);
      line(pick(free), z - 6, z + 10);
      if (wantTotem) totem(free[0], z + 2);
      prize(free[1], z + 2);
      return { len: 6, ops, pat };
    }
    case 'double': {
      const free = randi(3);
      L.filter((l) => l !== free).forEach((l) => obs(block(), l, z + 2));
      line(free, z - 8, z + 12);
      prize(free, z + 14);
      return { len: 6, ops, pat };
    }
    case 'logs': {
      L.forEach((l) => obs('log', l, z + 2));
      arc(randi(3), z + 2);
      prize(randi(3), z + 9);
      return { len: 4, ops, pat };
    }
    case 'gates': {
      L.forEach((l) => obs('gate', l, z + 2));
      line(randi(3), z - 3, z + 6, 1.5, 0.6);
      prize(randi(3), z + 9);
      return { len: 4, ops, pat };
    }
    case 'mix': {
      const kinds = shuffle(['log', 'gate', block()]);
      kinds.forEach((k, l) => obs(k, l, z + 2));
      arc(kinds.indexOf('log'), z + 2);
      return { len: 4, ops, pat };
    }
    case 'trucks': {
      const lanes = shuffle(L).slice(0, 1 + randi(2));
      let longest = 0;
      lanes.forEach((l, i) => {
        const n = 1 + randi(3);
        let zz = z + i * rand(0, 8);
        if (i === 0) {
          obs('ramp', l, zz + KINDS.ramp.len / 2);
          line(l, zz + 0.5, zz + 4.5, 1.2, 0, true);
          zz += KINDS.ramp.len;
        }
        for (let k = 0; k < n; k++) obs('truck', l, zz + TRUCK_LEN / 2 + k * TRUCK_LEN);
        line(l, zz + 1, zz + n * TRUCK_LEN - 1, 1.8, KINDS.truck.top + 0.6);
        longest = Math.max(longest, zz + n * TRUCK_LEN - z);
      });
      const free = L.filter((l) => !lanes.includes(l));
      if (free.length && rng() < 0.5) obs('log', free[0], z + longest * 0.5);
      if (free.length && wantTotem) totem(free[0], z + longest * 0.75);
      // the best prizes wait for those who climb: a box on the far end of the first convoy
      prize(lanes[0], z + KINDS.ramp.len + TRUCK_LEN * 0.6, KINDS.truck.top);
      return { len: longest, ops, pat };
    }
    case 'oncoming': {
      const l = randi(3);
      const v = rand(7, 11);
      obs('truck', l, z + lead(v) + TRUCK_LEN, { moving: v });
      line(pick(L.filter((x) => x !== l)), z - 4, z + 14);
      return { len: 10, ops, pat };
    }
    case 'rhino':
    case 'buffalo': {
      const l = randi(3);
      const v = rand(6, 9);
      obs(pat, l, z + lead(v) + 2, { moving: v });
      obs('log', pick(L.filter((x) => x !== l)), z + 2);
      return { len: 8, ops, pat };
    }
    case 'stampede': {
      // two lanes of charging wildebeest, staggered; one lane stays open for seeds
      const free = randi(3);
      L.filter((l) => l !== free).forEach((l, i) => {
        const v = rand(6, 8.5);
        obs('wildebeest', l, z + lead(v) + 2 + i * 6, { moving: v });
        if (rng() < 0.6) obs('wildebeest', l, z + lead(v) + 9 + i * 6, { moving: v });
      });
      line(free, z - 6, z + 16);
      return { len: 18, ops, pat };
    }
    case 'rockfall': {
      const lanes = shuffle(L).slice(0, 1 + (D > 600 ? randi(2) : 0));
      lanes.forEach((l, i) => obs('rockfall', l, z + 2 + i * 9));
      const free = L.filter((l) => !lanes.includes(l));
      line(free.length ? pick(free) : 1, z - 4, z + 14);
      return { len: 12, ops, pat };
    }
    case 'croc': {
      const l = randi(3);
      obs('croc', l, z + 2);
      if (rng() < 0.6) obs('croc', (l + 1 + randi(2)) % 3, z + 12);
      arc(l, z + 2);
      return { len: 14, ops, pat };
    }
    case 'market': {
      // a spice-market street: carts zig-zag, nets hang across the gaps
      let l = randi(3);
      for (let k = 0; k < 3; k++) {
        obs('cart', l, z + k * 11);
        const others = L.filter((x) => x !== l);
        if (rng() < 0.5) obs('gate', others[randi(2)], z + k * 11);
        line(others[0], z + k * 11 - 4, z + k * 11 + 4, 2, 0.6);
        l = pick(others);
      }
      return { len: 26, ops, pat };
    }
    case 'crossing': {
      // an elephant ambles across the trail — read its pace and slip past
      const fromLeft = rng() < 0.5;
      obs('crossing', 1, z + 6, { cross: { dir: fromLeft ? 1 : -1, v: rand(1.8, 2.6) } });
      line(randi(3), z - 4, z + 14);
      return { len: 14, ops, pat };
    }
    case 'river': {
      // water across every lane — the only way through is a jump
      L.forEach((l) => obs('water', l, z + 4));
      arc(randi(3), z + 4);
      return { len: 12, ops, pat };
    }
    case 'lion': {
      const l = randi(3);
      const v = rand(7, 10);
      obs('lion', l, z + lead(v) + 2, { moving: v });
      line(pick(L.filter((x) => x !== l)), z - 6, z + 12);
      return { len: 10, ops, pat };
    }
    case 'beast': {
      // one charging wildebeest, sometimes a second right behind it
      const l = randi(3);
      const v = rand(6.5, 9);
      obs('wildebeest', l, z + lead(v) + 2, { moving: v });
      if (rng() < 0.45) obs('wildebeest', l, z + lead(v) + 8, { moving: v });
      line(pick(L.filter((x) => x !== l)), z - 4, z + 14);
      return { len: 12, ops, pat };
    }
    case 'snake': {
      let l = randi(3);
      for (let k = 0; k < 4; k++) {
        line(l, z + k * 8, z + k * 8 + 6);
        l = Math.max(0, Math.min(2, l + pick([-1, 1])));
      }
      if (wantTotem) totem(l, z + 34);
      return { len: 34, ops, pat };
    }
    case 'zigzag': {
      let l = randi(3);
      for (let k = 0; k < 3; k++) {
        obs(block(), l, z + k * 14);
        const nl = L.filter((x) => x !== l);
        line(pick(nl), z + k * 14 - 5, z + k * 14 + 3);
        l = pick(nl);
      }
      return { len: 30, ops, pat };
    }
    case 'logrun': {
      const l = randi(3);
      for (let k = 0; k < 3; k++) {
        obs('log', l, z + k * 12);
        arc(l, z + k * 12);
      }
      obs('gate', pick(L.filter((x) => x !== l)), z + 12);
      return { len: 26, ops, pat };
    }
  }
  return { len: 8, ops, pat };
}

/** Gentle scripted opening for first-time players. Returns null when finished. */
export function tutorialChunk(i, z) {
  const ops = [];
  switch (i) {
    case 0: ops.push(['line', 1, z, z + 16, 2, 0, false]); return { len: 16, ops };
    case 1: ops.push(['obs', 'boulder', 1, z + 8, {}], ['line', 0, z, z + 14, 2, 0, false], ['line', 2, z, z + 14, 2, 0, false]); return { len: 16, ops };
    case 2: L.forEach((l) => ops.push(['obs', 'log', l, z + 10, {}])); ops.push(['arc', 1, z + 10]); return { len: 16, ops };
    case 3: L.forEach((l) => ops.push(['obs', 'gate', l, z + 10, {}])); ops.push(['line', 1, z + 6, z + 14, 1.6, 0.6, false]); return { len: 16, ops };
    case 4: ops.push(['totem', 'tembo', 1, z + 10], ['line', 0, z, z + 20, 2, 0, false]); return { len: 20, ops };
    default: return null;
  }
}
