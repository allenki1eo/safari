import { PAT, box, disc, torus, tube } from './rigkit.js';
import { outfitId } from '../data/content.js';

/**
 * Wearable clothes. Each outfit is its own cut — a singlet, a football shirt,
 * a wrap, an open vest, a road cloak — laid over the same body. `sx` is -1
 * on the runner's left. Tubes with up [0,0,-1] run up the body; on that frame
 * angle 0 is the left side and half pi is the chest.
 */

const CREAM = 0xf4efe2;
const KHAKI = 0xe4d2ae;
const CANVAS = 0x5c6840;
const LEATHER = 0x6a4328;
const INDIGO = 0x1b2a6b;

const darker = (c, k = 0.8) => {
  const r = ((c >> 16) & 255) * k;
  const g = ((c >> 8) & 255) * k;
  const b = (c & 255) * k;
  return ((r << 16) | (g << 8) | b) >>> 0;
};

const sideName = (sx) => (sx < 0 ? 'L' : 'R');

function shell(rings, seg = 18) {
  return tube(rings, seg, { up: [0, 0, -1], caps: false });
}

function limbRings(sx, girl) {
  const th = `thigh${sideName(sx)}`;
  const sh = `shin${sideName(sx)}`;
  const ft = `foot${sideName(sx)}`;
  return [
    { p: [sx * 0.062, 0.9, 0.006], rx: 0.095, ry: 0.092, w: [['hips', 0.6], [th, 0.4]] },
    { p: [sx * 0.086, 0.82, 0.004], rx: 0.08 + girl * 0.004, ry: 0.082, w: th },
    { p: [sx * 0.09, 0.72, -0.002], rx: 0.07, ry: 0.072, w: th },
    { p: [sx * 0.09, 0.62, 0], rx: 0.058, ry: 0.058, w: th },
    { p: [sx * 0.09, 0.52, 0], rx: 0.05, ry: 0.052, w: th },
    { p: [sx * 0.09, 0.46, -0.002], rx: 0.046, ry: 0.048, w: [[th, 0.5], [sh, 0.5]] },
    { p: [sx * 0.091, 0.34, 0.01], rx: 0.046, ry: 0.05, w: sh },
    { p: [sx * 0.092, 0.2, 0.004], rx: 0.032, ry: 0.034, w: sh },
    { p: [sx * 0.092, 0.1, 0.002], rx: 0.028, ry: 0.03, w: [[sh, 0.55], [ft, 0.45]] },
  ];
}

function armRings(sx) {
  const up = `upperArm${sideName(sx)}`;
  const fo = `foreArm${sideName(sx)}`;
  return [
    { p: [sx * 0.14, 1.3, 0.004], rx: 0.058, ry: 0.06, w: [['chest', 0.4], [up, 0.6]] },
    { p: [sx * 0.172, 1.26, 0], rx: 0.05, ry: 0.052, w: up },
    { p: [sx * 0.18, 1.16, -0.002], rx: 0.044, ry: 0.046, w: up },
    { p: [sx * 0.184, 1.08, 0], rx: 0.036, ry: 0.036, w: up },
    { p: [sx * 0.188, 0.98, 0], rx: 0.034, ry: 0.032, w: fo },
    { p: [sx * 0.192, 0.88, 0], rx: 0.026, ry: 0.024, w: fo },
  ];
}

const looser = (rings, k, extra = {}) => rings.map((r) => ({ ...r, rx: r.rx * k, ry: (r.ry ?? r.rx) * k, ...extra }));

function shorts(b, def, girl, baggy, { hem = 0.66, color, pat, stripe }) {
  for (const sx of [-1, 1]) {
    const rings = looser(limbRings(sx, girl).filter((r) => r.p[1] >= hem), 1.2 * baggy, { c: color, pat });
    if (rings.length < 2) continue;
    rings[rings.length - 1] = { ...rings[rings.length - 1], c: darker(color, 0.78), pat: undefined };
    b.add(shell(rings, 14), {});
    if (stripe) {
      const y = (rings[0].p[1] + rings[rings.length - 1].p[1]) / 2;
      b.add(box([sx * 0.15, y, -0.02], [0.012, Math.abs(rings[0].p[1] - rings[rings.length - 1].p[1]) * 0.85, 0.012]), {
        color: stripe, bone: `thigh${sideName(sx)}`,
      });
    }
  }
}

function sleeves(b, def, baggy, { to = 1.12, color, pat, cuff = false }) {
  for (const sx of [-1, 1]) {
    const rings = looser(armRings(sx).filter((r) => r.p[1] >= to), 1.16 * baggy, { c: color, pat });
    if (rings.length < 2) continue;
    // sit tight at the shoulder seam, then ease off
    rings[0] = { ...rings[0], rx: armRings(sx)[0].rx * 1.04, ry: armRings(sx)[0].ry * 1.04 };
    b.add(shell(rings, 12), {});
    if (cuff) {
      const last = rings[rings.length - 1];
      b.add(torus(last.p, last.rx, 0.008, [Math.PI / 2, 0, 0], [4, 12]), { color: darker(color, 0.72), bone: last.w });
    }
  }
}

/** Racing flat, football boot, hiking boot, or sandal straps over the bare foot. */
function shoe(b, sx, kind, { upper, sole, lace }) {
  const ft = `foot${sideName(sx)}`;
  const x = sx * 0.092;
  if (kind === 'sandal') {
    b.add(box([x, 0.014, -0.04], [0.078, 0.014, 0.2]), { color: sole, bone: ft });
    b.add(torus([x, 0.05, -0.06], 0.042, 0.0065, [0.2, 0, 0], [5, 12]), { color: upper, bone: ft });
    b.add(torus([x, 0.052, 0.02], 0.034, 0.006, [0.35, 0, 0], [5, 10]), { color: upper, bone: ft });
    b.add(box([x, 0.055, -0.02], [0.012, 0.008, 0.09]), { color: upper, bone: ft });
    return;
  }
  const rise = kind === 'hike' ? 0.1 : kind === 'boot' ? 0.055 : 0.012;
  b.add(tube([
    { p: [x, 0.055 + rise, 0.03], rx: 0.04, ry: kind === 'hike' ? 0.046 : 0.036 },
    { p: [x, 0.06, -0.01], rx: 0.048, ry: 0.042 },
    { p: [x, 0.046, -0.08], rx: 0.044, ry: 0.03 },
    { p: [x, 0.034, -0.145], rx: 0.026, ry: 0.016 },
  ].map((r) => ({ ...r, c: upper, w: ft })), 12, { up: [0, 1, 0] }), {});
  b.add(tube([
    { p: [x, 0.012, 0.045], rx: 0.042, ry: 0.012 },
    { p: [x, 0.011, -0.04], rx: 0.054, ry: 0.014 },
    { p: [x, 0.014, -0.135], rx: 0.036, ry: 0.012 },
  ].map((r) => ({ ...r, c: sole, w: ft })), 12, { up: [0, 1, 0] }), {});
  if (kind === 'flat' || kind === 'boot') {
    b.add(box([x, 0.078, -0.02], [0.03, 0.006, 0.07]), { color: lace, bone: ft });
  }
  if (kind === 'boot') {
    for (const z of [0.02, -0.05, -0.11]) b.add(box([x, 0.004, z], [0.036, 0.008, 0.014]), { color: 0x1a1a1a, bone: ft });
  }
  if (kind === 'hike') {
    b.add(torus([x, 0.15, 0.02], 0.042, 0.009, [Math.PI / 2, 0, 0], [4, 12]), { color: darker(upper, 0.7), bone: ft });
    b.add(box([x, 0.1, -0.02], [0.03, 0.006, 0.06]), { color: 0xd8c7a2, bone: ft });
  }
}

function bothFeet(b, kind, colors) {
  for (const sx of [-1, 1]) shoe(b, sx, kind, colors);
}

/* ------------------------------------------------------------ outfits */

function dressKit(b, def, girl, baggy) {
  const shirt = def.shirt;
  const k = baggy;
  // singlet: a shell under the arms, plus straps. Shoulders and arms stay bare.
  b.add(shell([
    { p: [0, 0.99, 0], rx: 0.132 * k, ry: 0.09 * k, c: darker(shirt, 0.8), w: 'spine' },
    { p: [0, 1.06, -0.004], rx: 0.122 * k, ry: 0.084 * k, c: shirt, w: 'spine' },
    { p: [0, 1.13, -0.006], rx: 0.136 * k, ry: 0.09 * k, c: shirt, w: 'chest' },
    { p: [0, 1.19, -0.004], rx: 0.14 * k, ry: 0.086 * k, c: shirt, w: 'chest' },
  ], 20), {});
  for (const sx of [-1, 1]) {
    b.add(tube([
      { p: [sx * 0.05, 1.17, -0.09], rx: 0.02, ry: 0.012 },
      { p: [sx * 0.1, 1.28, -0.01], rx: 0.018, ry: 0.011 },
      { p: [sx * 0.09, 1.3, 0.05], rx: 0.018, ry: 0.011 },
      { p: [sx * 0.045, 1.18, 0.095], rx: 0.02, ry: 0.012 },
    ].map((r) => ({ ...r, c: shirt, w: 'chest' })), 8, { caps: false }), {});
  }
  // race bib, sitting on the chest
  b.add(box([0, 1.11, -0.108], [0.092, 0.12, 0.008]), { color: CREAM, bone: 'chest' });
  b.add(box([0, 1.158, -0.114], [0.092, 0.016, 0.006]), { color: def.accent, bone: 'chest' });
  b.add(box([0, 1.1, -0.114], [0.012, 0.05, 0.005]), { color: darker(def.accent, 0.85), bone: 'chest' });
  shorts(b, def, girl, baggy, { hem: 0.7, color: def.pants, stripe: def.accent });
  bothFeet(b, 'flat', { upper: def.shoes, sole: 0xf2ece4, lace: 0xffffff });
}

function dressJersey(b, def, girl, baggy) {
  const shirt = def.shirt;
  const pat = { type: PAT.stripesX, color: def.accent, scale: 18 };
  b.add(shell([
    { p: [0, 1.0, 0.004], rx: 0.148 * baggy, ry: 0.1 * baggy, c: darker(shirt, 0.7), w: 'hips' },
    { p: [0, 1.06, -0.002], rx: 0.128 * baggy, ry: 0.088 * baggy, c: shirt, w: 'spine', pat },
    { p: [0, 1.16, -0.006], rx: 0.142 * baggy, ry: 0.094 * baggy, c: shirt, w: 'chest', pat },
    { p: [0, 1.26, -0.002], rx: 0.15 * baggy, ry: 0.09 * baggy, c: shirt, w: 'chest', pat },
    { p: [0, 1.32, 0.004], rx: 0.09 * baggy, ry: 0.07 * baggy, c: darker(shirt, 0.75), w: 'chest' },
  ], 20), {});
  // ribbed crew collar
  b.add(torus([0, 1.33, 0.006], 0.072, 0.014, [Math.PI / 2, 0, 0], [5, 16]), { color: darker(shirt, 0.7), bone: 'chest' });
  sleeves(b, def, baggy * 1.08, { to: 1.02, color: shirt, pat, cuff: true });
  // crest on the left chest, number block on the back so the kit reads while running
  b.add(disc([-0.055, 1.18, -0.112], 0.028, 0.028, 0.01, 14, [Math.PI / 2, 0, 0]), { color: def.accent, bone: 'chest' });
  b.add(box([0, 1.16, 0.112], [0.08, 0.09, 0.008]), { color: CREAM, bone: 'chest' });
  b.add(box([0, 1.16, 0.118], [0.016, 0.055, 0.005]), { color: def.accent, bone: 'chest' });
  shorts(b, def, girl, baggy, { hem: 0.6, color: def.pants, stripe: CREAM });
  // turned-down socks
  for (const sx of [-1, 1]) {
    const rings = looser(limbRings(sx, girl).filter((r) => r.p[1] <= 0.46 && r.p[1] >= 0.12), 1.12, {
      c: 0xf7f4ef, pat: { type: PAT.stripesY, color: def.accent, scale: 14 },
    });
    b.add(shell(rings, 12), {});
    const top = rings[0];
    b.add(torus(top.p, top.rx * 1.05, 0.01, [Math.PI / 2, 0, 0], [4, 12]), { color: def.accent, bone: top.w });
  }
  bothFeet(b, 'boot', { upper: 0x1c2430, sole: 0xf4f4f4, lace: 0xffffff });
}

function dressKanga(b, def, girl, baggy) {
  const field = def.shirt;
  const border = 0xf6efd8;
  const kitenge = { type: PAT.zigzag, color: def.accent, scale: 14 };
  const dots = { type: PAT.dots, color: 0xf4d35e, scale: 22 };
  const k = 1.08 * baggy;
  // chest wrap: a loose cloth with a pindo (border) and an overlap
  b.add(shell([
    { p: [0, 1.02, 0], rx: 0.15 * k, ry: 0.1 * k, c: border, w: 'spine' },
    { p: [0, 1.08, -0.004], rx: 0.146 * k, ry: 0.098 * k, c: field, w: 'spine', pat: kitenge },
    { p: [0, 1.16, -0.006], rx: 0.154 * k, ry: 0.1 * k, c: field, w: 'chest', pat: kitenge },
    { p: [0, 1.24, 0], rx: 0.15 * k, ry: 0.092 * k, c: field, w: 'chest', pat: kitenge },
    { p: [0, 1.29, 0.004], rx: 0.12 * k, ry: 0.08 * k, c: border, w: 'chest' },
  ], 20), {});
  // the overlap edge, running down the left side of the chest, and the tuck
  b.add(tube([
    { p: [-0.02, 1.26, -0.1], rx: 0.018, ry: 0.012 },
    { p: [-0.08, 1.14, -0.11], rx: 0.02, ry: 0.012 },
    { p: [-0.12, 1.04, -0.08], rx: 0.018, ry: 0.012 },
  ].map((r) => ({ ...r, c: border, w: 'chest' })), 8, { caps: false }), {});
  ellipsoidKnot(b, [-0.13, 1.05, -0.02], border, 'chest');
  // kikoi: a flared wrap, not a pair of shorts, with a wide hem border
  const flare = 1 + girl * 0.06;
  b.add(shell([
    { p: [0, 0.98, 0.01], rx: 0.15 * flare, ry: 0.12 * flare, c: INDIGO, w: 'hips', pat: dots },
    { p: [0, 0.88, 0.012], rx: 0.175 * flare, ry: 0.14 * flare, c: INDIGO, w: 'hips', pat: dots },
    { p: [0, 0.76, 0.014], rx: 0.2 * flare, ry: 0.16 * flare, c: INDIGO, w: 'hips', pat: dots },
    { p: [0, 0.66, 0.016], rx: 0.22 * flare, ry: 0.17 * flare, c: border, w: 'hips' },
    { p: [0, 0.6, 0.016], rx: 0.228 * flare, ry: 0.176 * flare, c: def.accent, w: 'hips' },
  ], 22), {});
  ellipsoidKnot(b, [0.16, 0.9, -0.06], border, 'hips');
  bothFeet(b, 'sandal', { upper: def.shoes, sole: darker(def.shoes, 0.7) });
}

function ellipsoidKnot(b, p, color, bone) {
  b.add(box([p[0], p[1], p[2]], [0.045, 0.04, 0.04]), { color, bone });
  b.add(box([p[0] + 0.01, p[1] - 0.03, p[2] - 0.01], [0.03, 0.045, 0.025]), { color: darker(color, 0.85), bone });
}

function dressVest(b, def, girl, baggy) {
  const shirt = KHAKI;
  // shirt underneath, collar and sleeves rolled above the elbow
  b.add(shell([
    { p: [0, 0.98, 0], rx: 0.136 * baggy, ry: 0.092 * baggy, c: darker(shirt, 0.86), w: 'hips' },
    { p: [0, 1.1, -0.004], rx: 0.13 * baggy, ry: 0.088 * baggy, c: shirt, w: 'spine' },
    { p: [0, 1.22, -0.004], rx: 0.144 * baggy, ry: 0.092 * baggy, c: shirt, w: 'chest' },
    { p: [0, 1.3, 0.002], rx: 0.1 * baggy, ry: 0.072 * baggy, c: shirt, w: 'chest' },
  ], 20), {});
  b.add(torus([0, 1.325, 0.01], 0.078, 0.012, [Math.PI / 2 + 0.4, 0, 0], [4, 16]), { color: CREAM, bone: 'chest' });
  sleeves(b, def, baggy, { to: 1.14, color: shirt, cuff: true });
  // open canvas vest: two fronts and a back, so the shirt shows down the middle
  const vestRings = [
    { p: [0, 1.02, 0], rx: 0.155 * baggy, ry: 0.108 * baggy, c: CANVAS, w: 'spine' },
    { p: [0, 1.12, -0.004], rx: 0.15 * baggy, ry: 0.104 * baggy, c: CANVAS, w: 'chest' },
    { p: [0, 1.24, 0], rx: 0.158 * baggy, ry: 0.1 * baggy, c: CANVAS, w: 'chest' },
    { p: [0, 1.31, 0.004], rx: 0.12 * baggy, ry: 0.08 * baggy, c: darker(CANVAS, 0.8), w: 'chest' },
  ];
  b.add(tube(vestRings, 10, { up: [0, 0, -1], caps: false, arc: [0.15, 1.15] }), {});
  b.add(tube(vestRings, 10, { up: [0, 0, -1], caps: false, arc: [2.0, 3.0] }), {});
  b.add(tube(vestRings, 12, { up: [0, 0, -1], caps: false, arc: [3.45, 6.0] }), {});
  for (const sx of [-1, 1]) {
    b.add(box([sx * 0.07, 1.14, -0.112], [0.055, 0.05, 0.012]), { color: darker(CANVAS, 0.75), bone: 'chest' });
    b.add(box([sx * 0.07, 1.17, -0.12], [0.058, 0.012, 0.014]), { color: 0xc4b48a, bone: 'chest' });
  }
  b.add(torus([0, 0.97, 0.004], 0.145 * baggy, 0.012, [Math.PI / 2, 0, 0], [4, 18]), { color: LEATHER, bone: 'hips' });
  shorts(b, def, girl, baggy, { hem: 0.62, color: 0x6a5436 });
  bothFeet(b, 'hike', { upper: 0x4a3424, sole: 0x2a2118, lace: 0xd8c7a2 });
}

function dressJourney(b, def, girl, baggy) {
  const tunic = 0xc4a574;
  const shuka = def.scarf ?? def.accent;
  const pat = { type: PAT.check, color: INDIGO, scale: 16 };
  // a hip-length tunic, not a tucked jersey
  b.add(shell([
    { p: [0, 0.86, 0.004], rx: 0.15 * baggy, ry: 0.1 * baggy, c: darker(tunic, 0.82), w: 'hips' },
    { p: [0, 0.96, 0], rx: 0.142 * baggy, ry: 0.096 * baggy, c: tunic, w: 'hips' },
    { p: [0, 1.08, -0.004], rx: 0.13 * baggy, ry: 0.088 * baggy, c: tunic, w: 'spine' },
    { p: [0, 1.2, -0.004], rx: 0.144 * baggy, ry: 0.092 * baggy, c: tunic, w: 'chest' },
    { p: [0, 1.3, 0.002], rx: 0.09 * baggy, ry: 0.068 * baggy, c: darker(tunic, 0.8), w: 'chest' },
  ], 20), {});
  sleeves(b, def, baggy, { to: 1.16, color: tunic });
  // shuka over the left shoulder, with a back panel that swings on the scarf bone
  b.add(tube([
    [-0.12, 1.32, 0.02], [-0.02, 1.2, -0.12], [0.1, 1.05, -0.1], [0.14, 0.96, 0.02], [0.06, 1.08, 0.12], [-0.1, 1.24, 0.1],
  ].map((p) => ({ p, rx: 0.05, ry: 0.012, c: shuka, pat, w: 'chest' })), 8, { up: [0, 0, 1], caps: false }), {});
  b.add(box([0.02, 1.08, 0.12], [0.3, 0.42, 0.016]), { color: shuka, bone: 'chest', pat });
  b.add(box([0.06, 0.78, 0.08], [0.24, 0.36, 0.014]), { color: shuka, bone: 'scarf', pat });
  b.add(box([0.1, 0.62, 0.04], [0.16, 0.16, 0.012]), { color: darker(shuka, 0.85), bone: 'scarf', pat });
  // a small road satchel on the left hip, and a beaded belt
  b.add(box([-0.16, 0.95, -0.02], [0.07, 0.09, 0.05]), { color: LEATHER, bone: 'hips' });
  b.add(box([-0.16, 1.0, -0.02], [0.074, 0.012, 0.052]), { color: darker(LEATHER, 0.7), bone: 'hips' });
  b.add(torus([0, 1.12, -0.09], 0.06, 0.006, [Math.PI / 2 + 0.5, 0, 0.4], [4, 10]), { color: LEATHER, bone: 'chest' });
  b.add(torus([0, 0.96, 0.006], 0.14, 0.01, [Math.PI / 2, 0, 0], [4, 16]), {
    color: def.accent, bone: 'hips', pat: { type: PAT.stripesX, color: CREAM, scale: 40 },
  });
  shorts(b, def, girl, 1, { hem: 0.7, color: 0x5b4632 });
  bothFeet(b, 'sandal', { upper: 0x8a5a32, sole: 0x3a2a1c });
}

const DRESS = {
  kit: dressKit,
  jersey: dressJersey,
  kanga: dressKanga,
  vest: dressVest,
  journey: dressJourney,
};

export function dress(b, def, { girl = 0, baggy = 1 } = {}, id) {
  (DRESS[outfitId(id)] ?? dressKit)(b, def, girl, baggy);
}
