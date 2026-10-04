import * as THREE from 'three';
import { blobShadow } from './materials.js';
import {
  Animator, PAT, SkinBuilder, TAU, blend, box, cap, cone, disc, ellipsoid, keyed, limb, ramp, sampleClip, torus, tube,
} from './rigkit.js';

/**
 * The runners: six East African kids built and animated in code. One skeleton, one
 * set of clips, and per-runner faces, hair, clothes and kit (kitenge, kanga, shuka,
 * Maasai beadwork, a football kit, a bucket hat).
 *
 * Model space: feet on y = 0, facing -z (down the track), the runner's left on -x.
 * Rotations, when facing -z: +x on a limb swings it forward, -x on a shin bends the knee,
 * +x on a forearm bends the elbow, -x on the spine leans forward, and on the left side
 * -z lifts an arm or leg outwards (+z on the right).
 */

const SKELETON = [
  ['root', null, [0, 0, 0]],
  ['hips', 'root', [0, 0.85, 0]],
  ['spine', 'hips', [0, 0.98, 0]],
  ['chest', 'spine', [0, 1.13, 0]],
  ['neck', 'chest', [0, 1.3, 0]],
  ['head', 'neck', [0, 1.38, 0]],
  ['scarf', 'chest', [0.07, 1.27, 0.09]],
  ['upperArmL', 'chest', [-0.165, 1.27, 0]],
  ['foreArmL', 'upperArmL', [-0.175, 1.03, 0]],
  ['handL', 'foreArmL', [-0.18, 0.82, 0]],
  ['upperArmR', 'chest', [0.165, 1.27, 0]],
  ['foreArmR', 'upperArmR', [0.175, 1.03, 0]],
  ['handR', 'foreArmR', [0.18, 0.82, 0]],
  ['thighL', 'hips', [-0.085, 0.82, 0]],
  ['shinL', 'thighL', [-0.085, 0.46, 0]],
  ['footL', 'shinL', [-0.085, 0.085, 0]],
  ['thighR', 'hips', [0.085, 0.82, 0]],
  ['shinR', 'thighR', [0.085, 0.46, 0]],
  ['footR', 'shinR', [0.085, 0.085, 0]],
];

/** How each runner looks. Colours come from content.js; this adds the styling. */
const LOOKS = {
  zuri: {
    hair: 'wrap', sleeves: 'short', legs: 'shorts', shoes: 'sandals',
    shirtPat: null, pocket: true, wrapPat: { type: PAT.zigzag, color: 0xf4d35e, scale: 9 },
    gear: ['shuka', 'backpack'], shukaPat: { type: PAT.check, color: 0x1b2a6b, scale: 14 },
  },
  juma: {
    hair: 'fade', band: 0x1b998b, sleeves: 'short', legs: 'shorts', shoes: 'boots', socks: true,
    shirtPat: { type: PAT.diagonal, color: 0x1e8f4e, scale: 9 },
    gear: [],
  },
  neema: {
    hair: 'puffs', sleeves: 'short', legs: 'skirt', shoes: 'sandals',
    skirtPat: { type: PAT.dots, color: 0xf4d35e, scale: 16 },
    gear: ['collar', 'bracelets', 'headband'],
  },
  baraka: {
    hair: 'hat', sleeves: 'short', legs: 'shorts', shoes: 'boots', vest: 0x5f6b3a, pocket: true,
    gear: ['backpack', 'binoculars'],
  },
  amani: {
    hair: 'braids', sleeves: 'long', legs: 'long', shoes: 'glow',
    shirtPat: { type: PAT.zigzag, color: 0x4de1ff, scale: 10 },
    gear: ['necklace'],
  },
  kito: {
    hair: 'hightop', sleeves: 'baggy', legs: 'shorts', shoes: 'gold', baggy: true, scale: 0.93,
    legsPat: { type: PAT.stripesX, color: 0xd7263d, scale: 22 },
    gear: ['chain'],
  },
};

const hex = (c) => new THREE.Color(c);
const darker = (c, k = 0.82) => hex(c).multiplyScalar(k).getHex();

/* =================================================================== body */
function buildBody(def) {
  const look = LOOKS[def.id] ?? LOOKS.zuri;
  const b = new SkinBuilder(SKELETON);
  const skin = def.skin;
  const skinD = darker(skin, 0.8);
  const shirt = def.shirt;
  const pants = def.pants;
  const shoes = def.shoes;
  const hair = def.hair ?? 0x120c08;
  const accent = def.accent;
  const baggy = look.baggy ? 1.1 : 1;

  /* ---- torso: one tube from the crotch to the neck, blended over hips, spine and chest */
  const waist = look.legs === 'skirt' ? 0.94 : 0.9;
  const torsoW = (y) => {
    if (y < 0.93) return [['hips', 1]];
    if (y < 1.03) return [['hips', 1 - ramp(y, 0.93, 1.03)], ['spine', ramp(y, 0.93, 1.03)]];
    if (y < 1.1) return [['spine', 1]];
    return [['spine', 1 - ramp(y, 1.1, 1.18)], ['chest', ramp(y, 1.1, 1.18)]];
  };
  const profile = [
    [0.74, 0.07], [0.76, 0.115], [0.82, 0.135], [0.88, 0.138], [0.95, 0.124],
    [1.02, 0.12], [1.1, 0.13], [1.18, 0.145], [1.25, 0.142], [1.3, 0.1], [1.33, 0.055],
  ];
  const vestC = look.vest;
  b.add(
    tube(profile.map(([y, r]) => {
      const top = y >= waist;
      const k = top ? baggy : 1;
      return {
        p: [0, y, 0.005], rx: r * k, ry: r * 0.72 * k, w: torsoW(y),
        c: top ? shirt : pants,
        pat: top ? look.shirtPat : look.legsPat,
      };
    }), 14, { up: [0, 0, -1] }),
    {},
  );
  if (vestC) {
    // a safari vest over the shirt, open at the front
    b.add(tube([[1.0, 0.128], [1.1, 0.138], [1.2, 0.152], [1.27, 0.148]].map(([y, r]) => ({ p: [0, y, 0.01], rx: r, ry: r * 0.75, w: torsoW(y) })), 14, { up: [0, 0, -1], caps: false }), {
      color: (v) => (v.z < -0.06 && Math.abs(v.x) < 0.035 ? shirt : vestC),
    });
  }
  if (look.pocket) {
    for (const x of [-0.065, 0.065]) b.add(box([x, 1.17, -0.105], [0.05, 0.05, 0.012]), { color: darker(vestC ?? shirt, 0.85), bone: 'chest' });
  }

  /* ---- skirt (Neema's kanga) */
  if (look.legs === 'skirt') {
    b.add(tube([[0.95, 0.13], [0.86, 0.165], [0.74, 0.2], [0.64, 0.225]].map(([y, r]) => ({ p: [0, y, 0], rx: r, ry: r * 0.8 })), 14, { up: [0, 0, -1], caps: false }), {
      color: def.dress ?? pants, bone: 'hips', pat: look.skirtPat,
    });
  }

  /* ---- neck and head */
  b.add(limb([0, 1.28, 0.005], [0, 1.43, 0.0], 0.05, 0.047, 8), { color: skin, bone: 'neck' });
  const H = [0, 1.54, 0];
  b.add(ellipsoid(H, [0.145, 0.165, 0.155], [14, 10]), { color: skin, bone: 'head' });
  b.add(ellipsoid([0, 1.47, -0.03], [0.118, 0.088, 0.12], [12, 7]), { color: skin, bone: 'head' });
  for (const s of [-1, 1]) {
    b.add(ellipsoid([s * 0.145, 1.53, 0.01], [0.028, 0.045, 0.03], [7, 5]), { color: skinD, bone: 'head' });
    // eyes: white, deep brown iris, a glint
    b.add(ellipsoid([s * 0.052, 1.555, -0.133], [0.031, 0.034, 0.015], [8, 6]), { color: 0xf8f3ea, bone: 'head' });
    b.add(ellipsoid([s * 0.052, 1.552, -0.145], [0.019, 0.022, 0.008], [8, 6]), { color: 0x241208, bone: 'head' });
    b.add(ellipsoid([s * 0.045, 1.562, -0.152], [0.006, 0.006, 0.004], [4, 3]), { color: 0xffffff, bone: 'head' });
    b.add(box([s * 0.056, 1.6, -0.14], [0.052, 0.013, 0.014], [0, 0, -s * 0.12]), { color: hair, bone: 'head' });
  }
  b.add(ellipsoid([0, 1.5, -0.152], [0.032, 0.024, 0.022], [8, 5]), { color: skinD, bone: 'head' });
  b.add(ellipsoid([0, 1.455, -0.135], [0.034, 0.011, 0.012], [8, 4]), { color: 0x5a1f1a, bone: 'head' });
  b.add(ellipsoid([0, 1.448, -0.131], [0.024, 0.007, 0.01], [6, 3]), { color: 0x7a2f28, bone: 'head' });
  buildHair(b, look, def, hair, accent);

  /* ---- arms */
  for (const [s, side] of [[-1, 'L'], [1, 'R']]) {
    const up = `upperArm${side}`;
    const fo = `foreArm${side}`;
    const ha = `hand${side}`;
    b.add(ellipsoid([s * 0.155, 1.265, 0], [0.06 * baggy, 0.058, 0.058], [8, 6]), { color: shirt, bone: up });
    b.add(limb([s * 0.165, 1.27, 0], [s * 0.175, 1.03, 0], 0.044, 0.037), { color: look.sleeves === 'long' ? shirt : skin, bone: up });
    if (look.sleeves === 'short' || look.sleeves === 'baggy') {
      const r = look.sleeves === 'baggy' ? 0.068 : 0.054;
      b.add(limb([s * 0.165, 1.29, 0], [s * 0.172, look.sleeves === 'baggy' ? 1.08 : 1.14, 0], r, r * 0.95, 8), { color: shirt, bone: up, pat: look.shirtPat });
    }
    b.add(ellipsoid([s * 0.175, 1.03, 0], [0.037, 0.037, 0.037], [6, 5]), { color: look.sleeves === 'long' ? shirt : skin, bone: fo });
    b.add(limb([s * 0.175, 1.03, 0], [s * 0.18, 0.82, 0], 0.036, 0.031), { color: look.sleeves === 'long' ? shirt : skin, bone: fo });
    b.add(ellipsoid([s * 0.181, 0.765, -0.005], [0.031, 0.052, 0.034], [7, 5]), { color: skin, bone: ha });
    b.add(ellipsoid([s * 0.172, 0.79, -0.03], [0.014, 0.024, 0.014], [5, 4], { rot: [0.4, 0, 0] }), { color: skin, bone: ha });
    if (def.wristband) b.add(disc([s * 0.18, 0.86, 0], 0.036, 0.036, 0.03, 8), { color: def.wristband, bone: fo });
  }

  /* ---- legs */
  for (const [s, side] of [[-1, 'L'], [1, 'R']]) {
    const th = `thigh${side}`;
    const sh = `shin${side}`;
    const ft = `foot${side}`;
    const x = s * 0.085;
    const longLegs = look.legs === 'long';
    b.add(limb([x, 0.84, 0], [x, 0.46, 0], 0.068, 0.05), { color: longLegs ? pants : skin, bone: th });
    if (look.legs === 'shorts') {
      b.add(limb([x, 0.86, 0], [x, 0.62, 0], 0.08 * baggy, 0.074 * baggy, 9), { color: pants, bone: th, pat: look.legsPat });
    }
    b.add(ellipsoid([x, 0.46, -0.004], [0.05, 0.05, 0.05], [7, 5]), { color: longLegs ? pants : skin, bone: sh });
    b.add(limb([x, 0.46, 0], [x, 0.1, 0.01], 0.049, 0.037), { color: longLegs ? pants : skin, bone: sh });
    if (look.socks) b.add(limb([x, 0.37, 0], [x, 0.1, 0.01], 0.053, 0.042, 8), { color: 0xffffff, bone: sh, pat: { type: PAT.stripesY, color: look.band ?? accent, scale: 11 } });
    if (look.shoes === 'boots' && !look.socks) b.add(limb([x, 0.2, 0.005], [x, 0.08, 0.01], 0.05, 0.047, 8), { color: darker(shoes, 0.9), bone: sh });
    // shoes point down the track (-z)
    const shoe = look.shoes === 'glow' ? 0x101828 : shoes;
    b.add(ellipsoid([x, 0.05, -0.04], [0.052, 0.046, 0.105], [9, 6]), { color: look.shoes === 'sandals' ? skin : shoe, bone: ft });
    b.add(box([x, 0.012, -0.04], [0.1, 0.024, 0.22]), { color: look.shoes === 'sandals' ? shoes : 0xf2ece0, bone: ft });
    if (look.shoes === 'sandals') b.add(box([x, 0.05, -0.07], [0.1, 0.018, 0.03]), { color: shoes, bone: ft });
    if (look.shoes === 'glow') b.add(box([x, 0.03, -0.04], [0.104, 0.012, 0.222]), { color: accent, bone: ft, glow: 1.4 });
    if (look.shoes === 'gold') b.add(box([x, 0.07, -0.1], [0.06, 0.02, 0.05]), { color: 0xffffff, bone: ft });
  }

  /* ---- kit */
  for (const g of look.gear) buildGear(b, g, def, look);

  const mesh = b.build();
  mesh.castShadow = true;
  mesh.frustumCulled = false;
  return { mesh, builder: b, scale: look.scale ?? 1 };
}

function buildHair(b, look, def, hair, accent) {
  const head = 'head';
  switch (look.hair) {
    case 'fade':
      b.add(cap([0, 1.56, 0.012], [0.152, 0.17, 0.162], 1.2, { rot: [0.45, 0, 0], seg: 14 }), { color: hair, bone: head });
      if (look.band) b.add(disc([0, 1.62, 0.005], 0.155, 0.157, 0.032, 14, [0.25, 0, 0]), { color: look.band, bone: head });
      break;
    case 'puffs':
      b.add(cap([0, 1.555, 0.01], [0.154, 0.172, 0.164], 1.3, { rot: [0.4, 0, 0], seg: 14 }), { color: hair, bone: head });
      for (const s of [-1, 1]) b.add(ellipsoid([s * 0.105, 1.69, 0.03], [0.085, 0.08, 0.085], [8, 6]), { color: hair, bone: head });
      break;
    case 'braids': {
      b.add(cap([0, 1.555, 0.01], [0.154, 0.172, 0.164], 1.35, { rot: [0.4, 0, 0], seg: 14 }), { color: hair, bone: head });
      b.add(ellipsoid([0, 1.66, 0.09], [0.07, 0.06, 0.07], [8, 6]), { color: hair, bone: head });
      // box braids down the back, each tipped with a glowing bead
      for (let i = 0; i < 9; i++) {
        const a = -1.1 + (i / 8) * 2.2;
        const x = Math.sin(a) * 0.13;
        const z = 0.07 + Math.cos(a) * 0.08;
        const end = [x * 1.25, 1.27 + Math.abs(a) * 0.04, z + 0.07];
        b.add(limb([x, 1.6, z], end, 0.017, 0.014, 5), { color: hair, bone: head });
        b.add(ellipsoid(end, [0.02, 0.022, 0.02], [5, 4]), { color: accent, bone: head, glow: 1.2 });
      }
      break;
    }
    case 'hightop':
      b.add(cap([0, 1.55, 0.012], [0.152, 0.17, 0.162], 1.15, { rot: [0.4, 0, 0], seg: 14 }), { color: hair, bone: head });
      // a rounded high-top, frosted gold on top
      b.add(ellipsoid([0, 1.665, 0.008], [0.148, 0.15, 0.158], [12, 9]), { color: hair, bone: head });
      b.add(cap([0, 1.7, 0.008], [0.132, 0.115, 0.14], 0.75, { seg: 12 }), { color: def.accent, bone: head });
      break;
    case 'wrap':
      // a kitambaa headwrap: a tall rounded wrap with a knot at the back and a front fold
      b.add(cap([0, 1.555, 0.01], [0.154, 0.172, 0.164], 1.25, { rot: [0.4, 0, 0], seg: 14 }), { color: hair, bone: head });
      b.add(ellipsoid([0, 1.66, 0.025], [0.158, 0.125, 0.168], [12, 8]), { color: accent, bone: head, pat: look.wrapPat });
      b.add(ellipsoid([0, 1.72, 0.07], [0.12, 0.09, 0.12], [10, 7], { rot: [0.5, 0, 0] }), { color: accent, bone: head, pat: look.wrapPat });
      b.add(ellipsoid([0.02, 1.67, 0.17], [0.07, 0.06, 0.06], [8, 6]), { color: darker(accent), bone: head });
      b.add(torus([0, 1.615, -0.002], 0.152, 0.022, [Math.PI / 2 + 0.22, 0, 0], [5, 16]), { color: darker(accent, 0.9), bone: head });
      break;
    case 'hat':
      b.add(cap([0, 1.555, 0.01], [0.152, 0.17, 0.162], 1.2, { rot: [0.45, 0, 0], seg: 14 }), { color: hair, bone: head });
      b.add(disc([0, 1.705, 0.0], 0.13, 0.158, 0.11, 14), { color: accent, bone: head });
      b.add(disc([0, 1.665, 0.0], 0.16, 0.162, 0.035, 14), { color: darker(accent, 0.6), bone: head });
      b.add(disc([0, 1.645, 0.0], 0.16, 0.235, 0.022, 16, [0.05, 0, 0]), { color: accent, bone: head });
      break;
  }
}

function buildGear(b, kind, def, look) {
  switch (kind) {
    case 'shuka': {
      // a Maasai shuka draped over the left shoulder, its tail streaming from the scarf bone
      const pat = look.shukaPat;
      const sash = tube([
        [-0.13, 1.3, -0.02], [-0.03, 1.2, -0.13], [0.09, 1.04, -0.12], [0.15, 0.95, 0.0], [0.08, 1.05, 0.12], [-0.05, 1.2, 0.12], [-0.13, 1.3, -0.02],
      ].map((p) => ({ p, rx: 0.045, ry: 0.012 })), 6, { up: [0, 0, 1], caps: false });
      b.add(sash, { color: def.scarf, bone: 'chest', pat });
      const s = b.at('scarf');
      b.add(box([s.x, s.y - 0.16, s.z + 0.01], [0.11, 0.32, 0.02]), { color: def.scarf, bone: 'scarf', pat });
      break;
    }
    case 'backpack': {
      const c = def.backpack ?? 0x3f6b3a;
      b.add(box([0, 1.12, 0.15], [0.24, 0.27, 0.11]), { color: c, bone: 'chest' });
      b.add(box([0, 1.23, 0.15], [0.25, 0.06, 0.12]), { color: darker(c, 0.7), bone: 'chest' });
      b.add(box([0, 1.06, 0.21], [0.16, 0.1, 0.03]), { color: darker(c, 0.8), bone: 'chest' });
      for (const x of [-0.08, 0.08]) b.add(box([x, 1.18, -0.09], [0.025, 0.2, 0.012]), { color: darker(c, 0.6), bone: 'chest' });
      break;
    }
    case 'binoculars':
      for (const x of [-0.03, 0.03]) b.add(limb([x, 1.12, -0.12], [x, 1.12, -0.17], 0.024, 0.026, 7), { color: 0x2a2a2a, bone: 'chest' });
      break;
    case 'collar': {
      // the enkarewa: a flat beaded collar in rings of colour
      b.add(disc([0, 1.29, 0.0], 0.2, 0.215, 0.022, 18), { color: 0xd7263d, bone: 'chest', pat: { type: PAT.rings, color: 0xffffff, scale: 30 } });
      b.add(disc([0, 1.3, 0.0], 0.115, 0.12, 0.026, 14), { color: 0x2e86ab, bone: 'chest' });
      break;
    }
    case 'bracelets':
      for (const [x, bone] of [[-0.18, 'foreArmL'], [0.18, 'foreArmR']]) {
        b.add(disc([x, 0.88, 0], 0.04, 0.04, 0.022, 9), { color: 0xd7263d, bone });
        b.add(disc([x, 0.855, 0], 0.039, 0.039, 0.02, 9), { color: 0xf4d35e, bone });
      }
      break;
    case 'headband':
      b.add(disc([0, 1.62, 0.005], 0.156, 0.158, 0.03, 16, [0.25, 0, 0]), { color: def.accent, bone: 'head', pat: { type: PAT.stripesX, color: 0xffffff, scale: 40 } });
      break;
    case 'necklace':
      b.add(torus([0, 1.27, -0.035], 0.1, 0.012, [Math.PI / 2 + 0.6, 0, 0], [4, 14]), { color: def.accent, bone: 'chest', glow: 1.1 });
      break;
    case 'chain':
      b.add(torus([0, 1.26, -0.04], 0.1, 0.011, [Math.PI / 2 + 0.55, 0, 0], [4, 14]), { color: 0xf4c430, bone: 'chest' });
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
    upperArmR: [0.2 * up, 0, 0.09 + 2.45 * up],
    foreArmR: [0.35 * up, 0, 0.1 + 0.45 * w],
    handR: [0, 0, 0.2 * w],
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
