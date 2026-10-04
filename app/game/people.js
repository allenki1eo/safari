import * as THREE from 'three';
import { blobShadow } from './materials.js';
import {
  Animator, PAT, SkinBuilder, TAU, box, cap, disc, ellipsoid, keyed, limb, ramp, rigMaterial, sampleClip, torus, tube,
} from './rigkit.js';

/**
 * The runners: six East African kids built and animated in code. One skeleton, one
 * set of clips, and per-runner faces, hair, clothes and kit (kitenge, kanga, shuka,
 * Maasai beadwork, a football kit, a bucket hat).
 *
 * Bodies keep lifelike proportions (a head about a seventh of their height), with
 * muscled limbs that bend smoothly at the joints, hands with fingers, broad noses
 * and full lips, coily hair, and clothes layered over the body.
 *
 * Model space: feet on y = 0, facing -z (down the track), the runner's left on -x.
 * Rotations, when facing -z: +x on a limb swings it forward, -x on a shin bends the knee,
 * +x on a forearm bends the elbow, -x on the spine leans forward, and on the left side
 * -z lifts an arm or leg outwards (+z on the right).
 */

const SKELETON = [
  ['root', null, [0, 0, 0]],
  ['hips', 'root', [0, 0.88, 0]],
  ['spine', 'hips', [0, 1.0, 0]],
  ['chest', 'spine', [0, 1.15, 0]],
  ['neck', 'chest', [0, 1.36, 0]],
  ['head', 'neck', [0, 1.45, 0]],
  ['scarf', 'chest', [0.07, 1.3, 0.1]],
  ['upperArmL', 'chest', [-0.175, 1.31, 0]],
  ['foreArmL', 'upperArmL', [-0.185, 1.06, 0]],
  ['handL', 'foreArmL', [-0.195, 0.83, 0]],
  ['upperArmR', 'chest', [0.175, 1.31, 0]],
  ['foreArmR', 'upperArmR', [0.185, 1.06, 0]],
  ['handR', 'foreArmR', [0.195, 0.83, 0]],
  ['thighL', 'hips', [-0.088, 0.86, 0]],
  ['shinL', 'thighL', [-0.09, 0.48, 0]],
  ['footL', 'shinL', [-0.092, 0.08, 0]],
  ['thighR', 'hips', [0.088, 0.86, 0]],
  ['shinR', 'thighR', [0.09, 0.48, 0]],
  ['footR', 'shinR', [0.092, 0.08, 0]],
];

/** How each runner looks. Colours come from content.js; this adds the styling. */
const LOOKS = {
  zuri: {
    hair: 'wrap', sleeves: 'short', legs: 'shorts', shoes: 'sandals', pocket: true,
    wrapPat: { type: PAT.zigzag, color: 0xf4d35e, scale: 13 },
    gear: ['shuka', 'backpack'], shukaPat: { type: PAT.check, color: 0x1b2a6b, scale: 18 },
  },
  juma: {
    hair: 'fade', band: 0x1b998b, sleeves: 'short', legs: 'shorts', shoes: 'boots', socks: true,
    shirtPat: { type: PAT.diagonal, color: 0x1e8f4e, scale: 11 },
    gear: [],
  },
  neema: {
    hair: 'puffs', sleeves: 'short', legs: 'skirt', shoes: 'sandals', girl: true,
    skirtPat: { type: PAT.dots, color: 0xf4d35e, scale: 20 },
    gear: ['collar', 'bracelets', 'headband'],
  },
  baraka: {
    hair: 'hat', sleeves: 'short', legs: 'shorts', shoes: 'boots', vest: 0x5f6b3a, pocket: true,
    gear: ['backpack', 'binoculars'],
  },
  amani: {
    hair: 'braids', sleeves: 'long', legs: 'long', shoes: 'glow', girl: true,
    shirtPat: { type: PAT.zigzag, color: 0x4de1ff, scale: 13 },
    gear: ['necklace'],
  },
  kito: {
    hair: 'hightop', sleeves: 'baggy', legs: 'shorts', shoes: 'gold', baggy: true, scale: 0.93,
    legsPat: { type: PAT.stripesX, color: 0xd7263d, scale: 26 },
    gear: ['chain'],
  },
};

const hex = (c) => new THREE.Color(c);
const darker = (c, k = 0.82) => hex(c).multiplyScalar(k).getHex();
const mix = (a, b, k) => hex(a).lerp(hex(b), k).getHex();

// head geometry is written in head-radius units around the skull centre
const HC = new THREE.Vector3(0, 1.552, 0);
const R = 0.105;
const hp = (x, y, z) => [HC.x + x * R, HC.y + y * R, HC.z + z * R];
const hr = (x, y, z) => [x * R, y * R, z * R];

/** Copies rings, scaling their radii: clothes are the body's rings, a little looser. */
const looser = (rings, k, extra = {}) => rings.map((r) => ({ ...r, rx: r.rx * k, ry: (r.ry ?? r.rx) * k, ...extra }));
/** Sleeves: tight where they meet the shoulder seam, looser down the arm. */
const sleeve = (rings, k, extra) => looser(rings, k, extra).map((r, i) => (i === 0 ? { ...r, rx: rings[0].rx * 1.03, ry: (rings[0].ry ?? rings[0].rx) * 1.03 } : r));

/* =================================================================== body */
function buildBody(def) {
  const look = LOOKS[def.id] ?? LOOKS.zuri;
  const b = new SkinBuilder(SKELETON);
  const skin = def.skin;
  const skinD = darker(skin, 0.78);
  const lip = mix(darker(skin, 0.72), 0x7a2f2a, 0.35);
  const shirt = def.shirt;
  const pants = def.pants;
  const shoes = def.shoes;
  const hair = def.hair ?? 0x120c08;
  const accent = def.accent;
  const baggy = look.baggy ? 1.12 : 1;
  const girl = look.girl ? 1 : 0;

  /* ---- torso: crotch to neck, blended over hips, spine and chest */
  const waist = look.legs === 'skirt' ? 0.98 : 0.93;
  const torsoW = (y) => {
    if (y < 0.95) return [['hips', 1]];
    if (y < 1.05) return [['hips', 1 - ramp(y, 0.95, 1.05)], ['spine', ramp(y, 0.95, 1.05)]];
    if (y < 1.11) return [['spine', 1]];
    return [['spine', 1 - ramp(y, 1.11, 1.2)], ['chest', ramp(y, 1.11, 1.2)]];
  };
  // [y, half width, half depth, z offset] — shoulders, a narrower waist, hips
  const profile = [
    [0.8, 0.07, 0.06, 0.005], [0.84, 0.125 + girl * 0.008, 0.085, 0.01], [0.9, 0.138 + girl * 0.012, 0.094, 0.012],
    [0.96, 0.128 + girl * 0.006, 0.088, 0.008], [1.02, 0.117 - girl * 0.006, 0.08, 0.0], [1.08, 0.12, 0.082, -0.004],
    [1.15, 0.134, 0.09, -0.008], [1.22, 0.147, 0.096, -0.006], [1.28, 0.152, 0.09, 0.0], [1.33, 0.128, 0.074, 0.008],
    [1.37, 0.055, 0.05, 0.01],
  ];
  const torsoRings = [];
  for (const [y, rx, rz, z] of profile) {
    const ring = { p: [0, y, z], rx, ry: rz, w: torsoW(y) };
    if (Math.abs(y - waist) < 0.035 && torsoRings.length) {
      // a crisp hem: the same ring twice, trousers below and shirt above
      torsoRings.push({ ...ring, p: [0, waist, z], c: pants, pat: look.legsPat });
      torsoRings.push({ ...ring, p: [0, waist + 0.001, z], c: shirt, pat: look.shirtPat, rx: rx * baggy, ry: rz * baggy });
      continue;
    }
    const top = y > waist;
    torsoRings.push({ ...ring, rx: rx * (top ? baggy : 1), ry: rz * (top ? baggy : 1), c: top ? shirt : pants, pat: top ? look.shirtPat : look.legsPat });
  }
  b.add(tube(torsoRings, 18, { up: [0, 0, -1] }), {});
  // collar and belt
  b.add(torus([0, 1.335, 0.006], 0.07, 0.012, [Math.PI / 2, 0, 0], [5, 14]), { color: darker(shirt, 0.85), bone: 'chest' });
  if (look.legs !== 'skirt') b.add(torus([0, waist - 0.01, 0.006], 0.13, 0.012, [Math.PI / 2, 0, 0], [4, 18]), { color: darker(pants, 0.7), bone: 'hips' });
  if (look.vest) {
    const vestC = look.vest;
    b.add(tube(looser(torsoRings.filter((r) => r.p[1] > 1.0 && r.p[1] < 1.34), 1.06), 18, { up: [0, 0, -1], caps: false }), {
      color: (v) => (v.z < -0.07 && Math.abs(v.x) < 0.035 ? shirt : vestC),
    });
  }
  if (look.pocket) {
    for (const x of [-0.065, 0.065]) b.add(box([x, 1.19, -0.098], [0.05, 0.05, 0.01]), { color: darker(look.vest ?? shirt, 0.82), bone: 'chest' });
  }

  /* ---- skirt (Neema's kanga) */
  if (look.legs === 'skirt') {
    b.add(tube([[0.99, 0.135], [0.9, 0.165], [0.78, 0.2], [0.66, 0.225]].map(([y, r]) => ({ p: [0, y, 0.01], rx: r, ry: r * 0.82 })), 18, { up: [0, 0, -1], caps: false }), {
      color: def.dress ?? pants, bone: 'hips', pat: look.skirtPat,
    });
  }

  /* ---- neck and head */
  b.add(tube([
    { p: [0, 1.31, 0.01], rx: 0.05, ry: 0.048, w: 'chest' },
    { p: [0, 1.37, 0.008], rx: 0.044, ry: 0.044, w: [['chest', 0.4], ['neck', 0.6]] },
    { p: [0, 1.44, 0.01], rx: 0.042, ry: 0.044, w: 'neck' },
    { p: [0, 1.5, 0.018], rx: 0.045, ry: 0.048, w: 'head' },
  ].map((r) => ({ ...r, c: skin })), 12, { up: [0, 0, -1] }), {});
  buildFace(b, skin, skinD, lip, hair);
  buildHair(b, look, def, hair, accent);

  /* ---- arms: one smooth tube from shoulder to wrist, bending at the elbow */
  for (const [s, side] of [[-1, 'L'], [1, 'R']]) {
    const up = `upperArm${side}`;
    const fo = `foreArm${side}`;
    const ha = `hand${side}`;
    const arm = [
      { p: [s * 0.13, 1.3, 0.005], rx: 0.055, ry: 0.06, w: [['chest', 0.5], [up, 0.5]] },
      { p: [s * 0.172, 1.285, 0], rx: 0.054, ry: 0.056, w: up },
      { p: [s * 0.18, 1.2, -0.004], rx: 0.044, ry: 0.047, w: up },
      { p: [s * 0.185, 1.1, 0], rx: 0.036, ry: 0.037, w: up },
      { p: [s * 0.186, 1.06, 0.002], rx: 0.034, ry: 0.034, w: [[up, 0.5], [fo, 0.5]] },
      { p: [s * 0.19, 0.98, -0.004], rx: 0.036, ry: 0.034, w: fo },
      { p: [s * 0.194, 0.88, 0], rx: 0.026, ry: 0.024, w: fo },
      { p: [s * 0.195, 0.84, 0], rx: 0.025, ry: 0.022, w: [[fo, 0.5], [ha, 0.5]] },
    ];
    b.add(tube(arm.map((r) => ({ ...r, c: skin })), 10, { up: [0, 0, -1] }), {});
    // sleeves are the same rings, looser
    if (look.sleeves === 'long') b.add(tube(sleeve(arm.slice(0, 7), 1.12, { c: shirt, pat: look.shirtPat }), 10, { up: [0, 0, -1], caps: false }), {});
    else if (look.sleeves === 'baggy') b.add(tube(sleeve(arm.slice(0, 4), 1.35, { c: shirt, pat: look.shirtPat }), 10, { up: [0, 0, -1], caps: false }), {});
    else b.add(tube(sleeve(arm.slice(0, 3), 1.18, { c: shirt, pat: look.shirtPat }), 10, { up: [0, 0, -1], caps: false }), {});
    if (look.sleeves === 'long') b.add(torus([s * 0.194, 0.885, 0], 0.03, 0.008, [Math.PI / 2, 0, 0], [4, 10]), { color: darker(shirt, 0.8), bone: fo });
    // hand: palm, four fingers and a thumb, relaxed and slightly curled
    const hx = s * 0.197;
    b.add(ellipsoid([hx, 0.785, -0.004], [0.017, 0.04, 0.034], [8, 6]), { color: skin, bone: ha });
    for (let i = 0; i < 4; i++) {
      const z = -0.024 + i * 0.016;
      const len = [0.042, 0.048, 0.045, 0.036][i];
      b.add(limb([hx, 0.752, z], [hx - s * 0.004, 0.752 - len, z + 0.006], 0.0072, 0.0058, 5), { color: skin, bone: ha });
    }
    b.add(limb([hx - s * 0.006, 0.79, -0.03], [hx - s * 0.012, 0.758, -0.048], 0.008, 0.0065, 5), { color: skin, bone: ha });
    if (def.wristband) b.add(torus([s * 0.194, 0.86, 0], 0.028, 0.009, [Math.PI / 2, 0, 0], [4, 10]), { color: def.wristband, bone: fo });
  }

  /* ---- legs: hip to ankle, with a calf, bending at the knee */
  for (const [s, side] of [[-1, 'L'], [1, 'R']]) {
    const th = `thigh${side}`;
    const sh = `shin${side}`;
    const ft = `foot${side}`;
    const leg = [
      { p: [s * 0.062, 0.9, 0.006], rx: 0.095, ry: 0.092, w: [['hips', 0.6], [th, 0.4]] },
      { p: [s * 0.086, 0.82, 0.004], rx: 0.08 + girl * 0.004, ry: 0.082, w: th },
      { p: [s * 0.09, 0.68, -0.004], rx: 0.068, ry: 0.07, w: th },
      { p: [s * 0.09, 0.53, 0], rx: 0.052, ry: 0.054, w: th },
      { p: [s * 0.09, 0.48, -0.002], rx: 0.049, ry: 0.05, w: [[th, 0.5], [sh, 0.5]] },
      { p: [s * 0.09, 0.37, 0.012], rx: 0.048, ry: 0.054, w: sh },
      { p: [s * 0.091, 0.22, 0.006], rx: 0.034, ry: 0.035, w: sh },
      { p: [s * 0.092, 0.11, 0.002], rx: 0.029, ry: 0.03, w: [[sh, 0.6], [ft, 0.4]] },
    ];
    const bare = look.legs !== 'long';
    b.add(tube(leg.map((r) => ({ ...r, c: bare ? skin : pants, pat: bare ? undefined : look.legsPat })), 12, { up: [0, 0, -1] }), {});
    if (look.legs === 'shorts') b.add(tube(looser(leg.slice(0, 3), 1.16 * baggy, { c: pants, pat: look.legsPat }), 12, { up: [0, 0, -1], caps: false }), {});
    if (look.socks) b.add(tube(looser(leg.slice(5), 1.08, { c: 0xffffff, pat: { type: PAT.stripesY, color: look.band ?? accent, scale: 14 } }), 12, { up: [0, 0, -1], caps: false }), {});
    if (look.shoes === 'boots' && !look.socks) b.add(tube(looser(leg.slice(6), 1.22, { c: darker(shoes, 0.9) }), 12, { up: [0, 0, -1], caps: false }), {});

    // shoe (or bare foot in sandals) along the foot, toe down the track
    const x = s * 0.092;
    const sandal = look.shoes === 'sandals';
    const upper = sandal ? skin : look.shoes === 'glow' ? 0x101828 : shoes;
    b.add(tube([
      { p: [x, 0.062, 0.045], rx: 0.036, ry: 0.04 },
      { p: [x, 0.068, 0.0], rx: 0.044, ry: 0.048 },
      { p: [x, 0.055, -0.06], rx: 0.047, ry: 0.038 },
      { p: [x, 0.04, -0.12], rx: 0.04, ry: 0.028 },
      { p: [x, 0.03, -0.152], rx: 0.022, ry: 0.016 },
    ].map((r) => ({ ...r, c: upper, w: ft })), 10, { up: [0, 1, 0] }), {});
    const sole = sandal ? shoes : look.shoes === 'gold' ? 0xffffff : 0xf2ece0;
    b.add(tube([
      { p: [x, 0.012, 0.05], rx: 0.038, ry: 0.012 },
      { p: [x, 0.012, -0.04], rx: 0.05, ry: 0.013 },
      { p: [x, 0.012, -0.14], rx: 0.036, ry: 0.012 },
    ].map((r) => ({ ...r, c: sole, w: ft })), 10, { up: [0, 1, 0] }), {});
    if (sandal) {
      b.add(torus([x, 0.05, -0.07], 0.045, 0.007, [0, 0, 0], [4, 10]), { color: shoes, bone: ft });
      b.add(torus([x, 0.06, 0.02], 0.042, 0.007, [0, 0, 0], [4, 10]), { color: shoes, bone: ft });
    } else {
      // laces
      for (let i = 0; i < 3; i++) b.add(box([x, 0.088 - i * 0.01, -0.015 - i * 0.03], [0.04, 0.006, 0.01]), { color: look.shoes === 'glow' ? accent : 0xffffff, bone: ft, glow: look.shoes === 'glow' ? 1.3 : 0 });
    }
    if (look.shoes === 'glow') b.add(tube([[0.05], [-0.04], [-0.14]].map(([z], i) => ({ p: [x, 0.026, z], rx: [0.039, 0.051, 0.037][i], ry: 0.006, c: accent, glow: 1.4, w: ft })), 10, { up: [0, 1, 0] }), {});
  }

  /* ---- kit */
  for (const g of look.gear) buildGear(b, g, def, look);

  const mesh = b.build({ material: rigMaterial({ smooth: true, standard: true }) });
  mesh.castShadow = true;
  mesh.frustumCulled = false;
  return { mesh, builder: b, scale: look.scale ?? 1 };
}

/** A face with deep brown eyes under a soft brow, a broad nose and full lips. */
function buildFace(b, skin, skinD, lip, hair) {
  const head = 'head';
  // skull, jaw and cheekbones
  b.add(ellipsoid(hp(0, 0.05, 0.02), hr(1, 1.12, 1.06), [18, 14]), { color: skin, bone: head });
  b.add(ellipsoid(hp(0, -0.48, -0.22), hr(0.74, 0.62, 0.78), [14, 10]), { color: skin, bone: head });
  b.add(ellipsoid(hp(0, -0.86, -0.62), hr(0.34, 0.26, 0.34), [10, 7]), { color: skin, bone: head });
  // brow ridge
  b.add(ellipsoid(hp(0, 0.22, -0.84), hr(0.66, 0.16, 0.2), [12, 6]), { color: skin, bone: head });
  for (const s of [-1, 1]) {
    // eye: almond white, iris, pupil highlight, upper lid, then a fine brow
    const ex = s * 0.34;
    b.add(ellipsoid(hp(ex, 0.06, -0.94), hr(0.2, 0.115, 0.08), [10, 6]), { color: 0xf3ece2, bone: head });
    b.add(ellipsoid(hp(ex, 0.055, -1.0), hr(0.085, 0.085, 0.035), [10, 6]), { color: 0x2a140a, bone: head });
    b.add(ellipsoid(hp(ex - s * 0.02, 0.085, -1.03), hr(0.022, 0.022, 0.012), [5, 4]), { color: 0xffffff, bone: head, glow: 0.4 });
    b.add(cap(hp(ex, 0.1, -0.925), hr(0.21, 0.1, 0.1), 0.85, { rot: [-1.25, 0, 0], seg: 10 }), { color: skinD, bone: head });
    b.add(box(hp(ex + s * 0.02, 0.31, -1.0), hr(0.34, 0.05, 0.06), [0.1, 0, s * 0.06]), { color: hair, bone: head });
    // ears
    b.add(ellipsoid(hp(s * 0.98, -0.05, 0.05), hr(0.13, 0.27, 0.2), [8, 6], { rot: [0, s * 0.3, 0] }), { color: skin, bone: head });
    b.add(ellipsoid(hp(s * 0.99, -0.05, 0.02), hr(0.07, 0.17, 0.11), [6, 5], { rot: [0, s * 0.3, 0] }), { color: skinD, bone: head });
  }
  // nose: a bridge, a broad rounded tip and nostril wings
  b.add(ellipsoid(hp(0, -0.12, -0.96), hr(0.11, 0.24, 0.12), [8, 6]), { color: skin, bone: head });
  b.add(ellipsoid(hp(0, -0.33, -1.03), hr(0.17, 0.13, 0.14), [10, 7]), { color: skin, bone: head });
  for (const s of [-1, 1]) {
    b.add(ellipsoid(hp(s * 0.17, -0.37, -0.97), hr(0.1, 0.09, 0.1), [7, 5]), { color: skin, bone: head });
    b.add(ellipsoid(hp(s * 0.085, -0.42, -1.0), hr(0.04, 0.025, 0.03), [5, 4]), { color: 0x1a0e08, bone: head });
  }
  // lips
  b.add(ellipsoid(hp(0, -0.58, -0.92), hr(0.27, 0.075, 0.11), [10, 6]), { color: lip, bone: head });
  b.add(ellipsoid(hp(0, -0.69, -0.9), hr(0.24, 0.085, 0.11), [10, 6]), { color: mix(lip, skin, 0.25), bone: head });
  b.add(box(hp(0, -0.635, -0.98), hr(0.3, 0.018, 0.04)), { color: 0x2a0f0b, bone: head });
}

/* Hair is coily: a fine pattern of tighter and looser coils breaks up the dark mass. */
function coils(hair) {
  return { type: PAT.spots, color: mix(hair, 0x6a4a30, 0.35), scale: 95 };
}

function buildHair(b, look, def, hair, accent) {
  const head = 'head';
  const pat = coils(hair);
  const base = (theta = 1.3, tilt = 0.45) => b.add(cap(hp(0, 0.12, 0.08), hr(1.07, 1.12, 1.12), theta, { rot: [tilt, 0, 0], seg: 18 }), { color: hair, bone: head, pat });
  switch (look.hair) {
    case 'fade':
      base(1.22, 0.5);
      if (look.band) b.add(torus(hp(0, 0.42, 0.02), 1.03 * R, 0.018, [Math.PI / 2 + 0.3, 0, 0], [5, 18]), { color: look.band, bone: head });
      break;
    case 'puffs':
      base(1.32, 0.42);
      for (const s of [-1, 1]) b.add(ellipsoid(hp(s * 0.72, 1.0, 0.18), hr(0.62, 0.58, 0.62), [12, 9]), { color: hair, bone: head, pat });
      break;
    case 'braids': {
      base(1.36, 0.42);
      b.add(ellipsoid(hp(0, 0.88, 0.62), hr(0.5, 0.42, 0.5), [10, 8]), { color: hair, bone: head, pat });
      // box braids down the back, each tipped with a glowing bead
      for (let i = 0; i < 11; i++) {
        const a = -1.2 + (i / 10) * 2.4;
        const x = Math.sin(a) * 0.95;
        const z = 0.45 + Math.cos(a) * 0.55;
        const start = hp(x, 0.35, z);
        const end = [start[0] * 1.15, 1.29 + Math.abs(a) * 0.035, start[2] + 0.06];
        b.add(tube([
          { p: start, rx: 0.012 }, { p: [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2, start[2] + 0.04], rx: 0.011 }, { p: end, rx: 0.009 },
        ].map((r) => ({ ...r, c: hair, w: head })), 5), {});
        b.add(ellipsoid(end, [0.014, 0.017, 0.014], [6, 5]), { color: accent, bone: head, glow: 1.2 });
      }
      break;
    }
    case 'hightop':
      base(1.2, 0.48);
      b.add(ellipsoid(hp(0, 0.98, 0.06), hr(0.98, 0.88, 1.03), [16, 11]), { color: hair, bone: head, pat });
      b.add(cap(hp(0, 1.3, 0.06), hr(0.86, 0.6, 0.92), 0.72, { seg: 16 }), { color: def.accent, bone: head, pat: { type: PAT.spots, color: darker(def.accent, 0.75), scale: 95 } });
      break;
    case 'wrap':
      // a kitambaa headwrap: a tall rounded wrap with a knot at the back and a front fold
      base(1.25, 0.42);
      b.add(ellipsoid(hp(0, 0.82, 0.18), hr(1.1, 0.92, 1.18), [16, 11]), { color: accent, bone: head, pat: look.wrapPat });
      b.add(ellipsoid(hp(0, 1.32, 0.52), hr(0.85, 0.62, 0.82), [12, 9], { rot: [0.5, 0, 0] }), { color: accent, bone: head, pat: look.wrapPat });
      b.add(ellipsoid(hp(0.15, 0.85, 1.18), hr(0.45, 0.4, 0.36), [10, 7]), { color: darker(accent), bone: head, pat: look.wrapPat });
      b.add(torus(hp(0, 0.5, 0.02), 1.07 * R, 0.016, [Math.PI / 2 + 0.22, 0, 0], [5, 20]), { color: darker(accent, 0.85), bone: head });
      break;
    case 'hat':
      base(1.2, 0.5);
      b.add(disc(hp(0, 1.08, 0.04), 0.88 * R, 1.06 * R, 0.08, 18), { color: accent, bone: head });
      b.add(disc(hp(0, 0.78, 0.04), 1.08 * R, 1.1 * R, 0.026, 18), { color: darker(accent, 0.6), bone: head });
      b.add(disc(hp(0, 0.62, 0.04), 1.1 * R, 1.62 * R, 0.016, 20, [0.06, 0, 0]), { color: accent, bone: head });
      break;
  }
}

function buildGear(b, kind, def, look) {
  switch (kind) {
    case 'shuka': {
      // a Maasai shuka draped over the left shoulder, its tail streaming from the scarf bone
      const pat = look.shukaPat;
      const sash = tube([
        [-0.14, 1.32, -0.01], [-0.04, 1.22, -0.12], [0.09, 1.05, -0.115], [0.155, 0.96, 0.0], [0.085, 1.06, 0.12], [-0.05, 1.22, 0.115], [-0.14, 1.32, -0.01],
      ].map((p) => ({ p, rx: 0.048, ry: 0.01 })), 6, { up: [0, 0, 1], caps: false });
      b.add(sash, { color: def.scarf, bone: 'chest', pat });
      const s = b.at('scarf');
      b.add(box([s.x, s.y - 0.17, s.z + 0.01], [0.12, 0.34, 0.016]), { color: def.scarf, bone: 'scarf', pat });
      break;
    }
    case 'backpack': {
      const c = def.backpack ?? 0x3f6b3a;
      b.add(tube([[1.0, 0.1], [1.12, 0.12], [1.24, 0.11]].map(([y, r]) => ({ p: [0, y, 0.15], rx: r, ry: r * 0.5, c, w: 'chest' })), 10), {});
      b.add(box([0, 1.255, 0.15], [0.21, 0.04, 0.11]), { color: darker(c, 0.7), bone: 'chest' });
      b.add(box([0, 1.06, 0.205], [0.15, 0.09, 0.03]), { color: darker(c, 0.8), bone: 'chest' });
      for (const x of [-0.075, 0.075]) b.add(box([x, 1.18, -0.093], [0.026, 0.22, 0.01]), { color: darker(c, 0.6), bone: 'chest' });
      break;
    }
    case 'binoculars':
      for (const x of [-0.028, 0.028]) b.add(limb([x, 1.13, -0.11], [x, 1.13, -0.16], 0.022, 0.024, 9), { color: 0x2a2a2a, bone: 'chest' });
      b.add(torus([0, 1.25, -0.02], 0.1, 0.005, [Math.PI / 2 + 0.7, 0, 0], [3, 14]), { color: 0x3a2a1a, bone: 'chest' });
      break;
    case 'collar': {
      // the enkarewa: a flat beaded collar in rings of colour
      b.add(disc([0, 1.325, 0.006], 0.175, 0.19, 0.018, 24), { color: 0xd7263d, bone: 'chest', pat: { type: PAT.rings, color: 0xffffff, scale: 36 } });
      b.add(disc([0, 1.335, 0.006], 0.095, 0.1, 0.022, 18), { color: 0x2e86ab, bone: 'chest' });
      break;
    }
    case 'bracelets':
      for (const [x, bone] of [[-0.194, 'foreArmL'], [0.194, 'foreArmR']]) {
        b.add(torus([x, 0.895, 0], 0.03, 0.008, [Math.PI / 2, 0, 0], [4, 10]), { color: 0xd7263d, bone });
        b.add(torus([x, 0.875, 0], 0.029, 0.008, [Math.PI / 2, 0, 0], [4, 10]), { color: 0xf4d35e, bone });
      }
      break;
    case 'headband':
      b.add(torus(hp(0, 0.45, 0.04), 1.05 * R, 0.016, [Math.PI / 2 + 0.3, 0, 0], [5, 20]), { color: def.accent, bone: 'head', pat: { type: PAT.stripesX, color: 0xffffff, scale: 50 } });
      break;
    case 'necklace':
      b.add(torus([0, 1.3, -0.03], 0.085, 0.009, [Math.PI / 2 + 0.6, 0, 0], [4, 16]), { color: def.accent, bone: 'chest', glow: 1.1 });
      break;
    case 'chain':
      b.add(torus([0, 1.29, -0.035], 0.085, 0.008, [Math.PI / 2 + 0.55, 0, 0], [4, 16]), { color: 0xf4c430, bone: 'chest' });
      break;
  }
}

/* ============================================================== animation */
const s = Math.sin;
const c = Math.cos;
const pos = (x) => Math.max(0, x);

function runPose(t) {
  const p = t * TAU;
  const legL = p;
  const legR = p + Math.PI;
  const leg = (ph) => ({
    thigh: [0.12 + 0.82 * s(ph), 0, 0],
    shin: [-(0.28 + 1.45 * pos(c(ph))), 0, 0],
    foot: [0.25 * pos(c(ph)) - 0.15 * pos(-c(ph)), 0, 0],
  });
  const L = leg(legL);
  const R = leg(legR);
  return {
    'hips@': [0, 0.045 * Math.abs(s(p)) - 0.02, 0],
    hips: [0, 0.14 * s(p), 0.04 * c(p)],
    spine: [-0.14, -0.08 * s(p), 0],
    chest: [-0.06, -0.14 * s(p), 0],
    neck: [0.05, 0, 0],
    head: [0.12, 0.08 * s(p), 0],
    thighL: L.thigh, shinL: L.shin, footL: L.foot,
    thighR: R.thigh, shinR: R.shin, footR: R.foot,
    upperArmL: [0.15 - 0.85 * s(p), 0, -0.14],
    foreArmL: [1.35 - 0.25 * s(p), 0, 0],
    upperArmR: [0.15 + 0.85 * s(p), 0, 0.14],
    foreArmR: [1.35 + 0.25 * s(p), 0, 0],
    scarf: [-(1.0 + 0.22 * s(p * 2)), 0, 0.15 * s(p)],
  };
}

function idlePose(t) {
  const p = t * TAU;
  return {
    'hips@': [0.01 * s(p), -0.004 * c(p * 2), 0],
    hips: [0, 0, 0.025 * s(p)],
    spine: [-0.01, 0, -0.02 * s(p)],
    chest: [-0.015 + 0.025 * s(p * 2), 0, 0],
    head: [-0.03, 0.32 * s(p), 0.03 * s(p)],
    upperArmL: [0.05, 0, -0.09 - 0.02 * s(p * 2)],
    foreArmL: [0.18, 0, 0],
    upperArmR: [0.05, 0, 0.09 + 0.02 * s(p * 2)],
    foreArmR: [0.18, 0, 0],
    thighL: [0, 0, -0.03 - 0.02 * s(p)],
    thighR: [0.06, 0, 0.05 - 0.02 * s(p)],
    shinR: [-0.12, 0, 0],
    scarf: [-0.12 - 0.05 * s(p * 2), 0, 0.05],
  };
}

function wavePose(t) {
  const idle = idlePose(t * 0.6);
  const up = ramp(t, 0, 0.18) * (1 - ramp(t, 0.8, 1));
  const w = s(t * TAU * 3.2) * up;
  return {
    ...idle,
    spine: [-0.02, 0, -0.06 * up],
    head: [0.04 * up, 0.1 * up, -0.12 * up],
    upperArmR: [0.15 * up, 0, 0.09 + 1.75 * up],
    foreArmR: [0.2 * up, 0, (1.15 + 0.4 * w) * up],
    handR: [0, 0, 0.25 * w],
  };
}

const JUMP = keyed([
  [0, {
    'hips@': [0, -0.02, 0], spine: [-0.25, 0, 0], head: [0.15, 0, 0],
    thighL: [0.55, 0, 0], shinL: [-0.5, 0, 0], thighR: [-0.55, 0, 0], shinR: [-0.5, 0, 0], footR: [-0.4, 0, 0],
    upperArmL: [1.3, 0, -0.2], foreArmL: [0.8, 0, 0], upperArmR: [-0.7, 0, 0.3], foreArmR: [0.6, 0, 0],
    scarf: [-1.2, 0, 0],
  }],
  [0.3, {
    'hips@': [0, 0.04, 0], spine: [-0.28, 0, 0], chest: [-0.05, 0, 0], head: [0.25, 0, 0],
    thighL: [1.75, 0, -0.05], shinL: [-2.15, 0, 0], footL: [0.3, 0, 0],
    thighR: [0.75, 0, 0.05], shinR: [-1.7, 0, 0], footR: [0.2, 0, 0],
    upperArmL: [2.4, 0, -0.45], foreArmL: [0.5, 0, 0], upperArmR: [-0.5, 0, 0.95], foreArmR: [0.7, 0, 0],
    scarf: [-1.6, 0, 0.2],
  }],
  [0.62, {
    'hips@': [0, 0.04, 0], spine: [-0.22, 0, 0], head: [0.2, 0, 0],
    thighL: [1.5, 0, -0.05], shinL: [-1.9, 0, 0], thighR: [0.9, 0, 0.05], shinR: [-1.5, 0, 0],
    upperArmL: [1.9, 0, -0.7], foreArmL: [0.4, 0, 0], upperArmR: [-0.2, 0, 1.1], foreArmR: [0.5, 0, 0],
    scarf: [-1.4, 0, -0.1],
  }],
  [1, {
    'hips@': [0, -0.03, 0], spine: [-0.18, 0, 0], head: [0.12, 0, 0],
    thighL: [0.75, 0, -0.08], shinL: [-0.85, 0, 0], thighR: [0.35, 0, 0.08], shinR: [-0.65, 0, 0],
    upperArmL: [0.5, 0, -0.95], foreArmL: [0.5, 0, 0], upperArmR: [0.3, 0, 0.95], foreArmR: [0.5, 0, 0],
    scarf: [-1.0, 0, 0],
  }],
]);

// a baseball slide: drop onto the hip, lean back, lead foot out front
const SLIDE_POSE = {
  'hips@': [0, -0.58, 0], hips: [0.55, 0, 0], spine: [0.3, 0, 0], chest: [0.1, 0, 0], head: [-0.6, 0, 0],
  thighL: [1.0, 0, -0.05], shinL: [-0.1, 0, 0], footL: [-0.3, 0, 0],
  thighR: [-0.15, 0, 0.2], shinR: [-2.3, 0, 0], footR: [0.2, 0, 0],
  upperArmL: [-0.45, 0, -0.8], foreArmL: [0.25, 0, 0], upperArmR: [0.9, 0, 0.45], foreArmR: [0.6, 0, 0],
  scarf: [-1.5, 0, 0],
};
const SLIDE = keyed([
  [0, { ...runPose(0.25) }],
  [0.22, SLIDE_POSE],
  [1, { ...SLIDE_POSE, 'hips@': [0, -0.57, 0], scarf: [-1.7, 0, 0.2] }],
]);

function ridePose(t) {
  const p = t * TAU;
  return {
    'hips@': [0, -0.43 + 0.03 * Math.abs(s(p)), 0.02],
    spine: [0.04 + 0.03 * s(p * 2), 0, 0],
    head: [0, 0.12, 0],
    thighL: [1.35, 0, -0.55], shinL: [-1.3, 0, 0],
    thighR: [1.35, 0, 0.55], shinR: [-1.3, 0, 0],
    upperArmL: [1.15, 0, -0.2], foreArmL: [0.55, 0, 0],
    upperArmR: [0.1, 0, 2.55], foreArmR: [0.2, 0, 0.3 + 0.35 * s(p * 2)],
    scarf: [-0.9 - 0.2 * s(p * 2), 0, 0],
  };
}

function flyPose(t) {
  const p = t * TAU;
  return {
    spine: [0.08, 0, 0.03 * s(p)],
    head: [0.18, 0.12 * s(p), 0],
    upperArmL: [0.1, 0, -2.85], foreArmL: [0, 0, -0.12],
    upperArmR: [0.1, 0, 2.85], foreArmR: [0, 0, 0.12],
    thighL: [0.35 + 0.4 * s(p), 0, -0.06], shinL: [-0.45 - 0.45 * pos(c(p)), 0, 0],
    thighR: [0.35 - 0.4 * s(p), 0, 0.06], shinR: [-0.45 - 0.45 * pos(-c(p)), 0, 0],
    scarf: [-1.3 - 0.25 * s(p * 3), 0, 0.2 * s(p)],
  };
}

const STUMBLE = keyed([
  [0, runPose(0.1)],
  [0.25, {
    'hips@': [0, -0.06, 0], spine: [-0.55, 0, 0.1], head: [0.35, 0, 0],
    thighL: [0.9, 0, 0], shinL: [-0.9, 0, 0], thighR: [-0.4, 0, 0], shinR: [-0.4, 0, 0],
    upperArmL: [0.4, 0, -1.3], foreArmL: [0.6, 0, 0], upperArmR: [0.6, 0, 1.2], foreArmR: [0.5, 0, 0],
    scarf: [-1.4, 0, 0],
  }],
  [1, runPose(0.5)],
]);

const DEATH = keyed([
  [0, runPose(0.2)],
  [0.35, {
    'hips@': [0, -0.25, -0.15], hips: [-0.7, 0, 0], spine: [-0.3, 0, 0], head: [0.3, 0, 0],
    thighL: [0.6, 0, 0], shinL: [-0.9, 0, 0], thighR: [-0.3, 0, 0], shinR: [-0.6, 0, 0],
    upperArmL: [1.6, 0, -0.4], foreArmL: [0.4, 0, 0], upperArmR: [1.7, 0, 0.4], foreArmR: [0.4, 0, 0],
    scarf: [-1.2, 0, 0],
  }],
  [0.7, {
    'hips@': [0, -0.72, -0.35], hips: [-1.5, 0, 0], spine: [-0.05, 0, 0], head: [0.55, 0.3, 0],
    thighL: [0.15, 0, -0.1], shinL: [-0.5, 0, 0], thighR: [0.05, 0, 0.1], shinR: [-0.9, 0, 0],
    upperArmL: [2.7, 0, -0.35], foreArmL: [0.3, 0, 0], upperArmR: [2.5, 0, 0.5], foreArmR: [0.5, 0, 0],
    scarf: [0.3, 0, 0],
  }],
  [1, {
    'hips@': [0, -0.7, -0.35], hips: [-1.48, 0, 0], spine: [-0.03, 0, 0], head: [0.5, 0.35, 0],
    thighL: [0.12, 0, -0.1], shinL: [-0.45, 0, 0], thighR: [0.05, 0, 0.1], shinR: [-0.85, 0, 0],
    upperArmL: [2.75, 0, -0.35], foreArmL: [0.25, 0, 0], upperArmR: [2.5, 0, 0.5], foreArmR: [0.45, 0, 0],
    scarf: [0.4, 0, 0],
  }],
]);

function buildClips(b) {
  return [
    sampleClip('run', 0.68, runPose, b),
    sampleClip('idle', 3.2, idlePose, b),
    sampleClip('wave', 1.9, wavePose, b),
    sampleClip('jump', 0.8, JUMP, b),
    sampleClip('slide', 0.62, SLIDE, b),
    sampleClip('ride', 0.9, ridePose, b),
    sampleClip('fly', 1.4, flyPose, b),
    sampleClip('stumble', 0.5, STUMBLE, b),
    sampleClip('death', 1.1, DEATH, b),
  ];
}

/* ================================================================= runner */

/**
 * A runner with the game's character API: `root`, `shadow`, `update(dt, speed, state)` for
 * states run / jump / slide / ride / fly / idle / dead, and `hit()` for a stumble.
 */
export function makeRunner(def) {
  const root = new THREE.Group();
  const { mesh, builder, scale } = buildBody(def);
  mesh.scale.setScalar(scale);
  root.add(mesh);
  const shadow = blobShadow(0.9, 0.9);
  shadow.userData.keep = true;
  root.add(shadow);

  const anim = new Animator(mesh, buildClips(builder));
  const api = {
    root,
    shadow,
    state: '',
    hitT: 0,
    waveT: 0,
    hit() {
      api.hitT = 0.5;
    },
    update(dt, speed, state) {
      const was = api.state;
      api.state = state;
      switch (state) {
        case 'run':
          if (api.hitT > 0) {
            if (api.hitT === 0.5) anim.play('stumble', { fade: 0.05, once: true, restart: true });
            api.hitT = Math.max(0, api.hitT - dt);
          } else anim.play('run', { fade: was === 'slide' || was === 'jump' ? 0.12 : 0.2, speed: 0.75 + speed * 0.022 });
          break;
        case 'jump':
          if (was !== 'jump') anim.play('jump', { fade: 0.08, once: true, restart: true, speed: 1 });
          break;
        case 'slide':
          if (was !== 'slide') anim.play('slide', { fade: 0.06, once: true, restart: true, speed: 1 });
          break;
        case 'ride':
          anim.play('ride', { fade: 0.25 });
          break;
        case 'fly':
          anim.play('fly', { fade: 0.25 });
          break;
        case 'dead':
          anim.play('death', { fade: 0.06, once: true });
          break;
        default:
          // a wave hello when a runner appears, then a relaxed idle
          if (was !== 'idle') {
            anim.play('wave', { fade: 0.2, once: true, restart: true });
            api.waveT = 1.8;
          } else if ((api.waveT -= dt) <= 0) anim.play('idle', { fade: 0.45 });
      }
      anim.update(dt);
    },
  };
  return api;
}
