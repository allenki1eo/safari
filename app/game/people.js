import * as THREE from 'three';
import { blobShadow } from './materials.js';
import { outfitId } from '../data/content.js';
import { dress } from './wardrobe.js';
import {
  Animator, PAT, SkinBuilder, TAU, box, cap, disc, ellipsoid, keyed, limb, ramp, rigMaterial, sampleClip, torus, tube,
} from './rigkit.js';

/**
 * The runners: six East African kids built and animated in code. One skeleton, one
 * set of clips. Faces are sculpted from a single head so the nose, lips and brow
 * are part of the surface. Clothes are a separate garment (`wardrobe.js`) chosen
 * before the run.
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

/** Hair and the small things that stay when the clothes change. */
const LOOKS = {
  zuri: { hair: 'wrap', wrapPat: { type: PAT.zigzag, color: 0xf4d35e, scale: 13 } },
  juma: { hair: 'fade', band: 0x1b998b },
  neema: { hair: 'puffs', girl: true, gear: ['bracelets', 'headband'] },
  baraka: { hair: 'hat' },
  amani: { hair: 'braids', girl: true, gear: ['necklace'] },
  kito: { hair: 'hightop', baggy: true, scale: 0.93 },
};

const hex = (c) => new THREE.Color(c);
const darker = (c, k = 0.82) => hex(c).multiplyScalar(k).getHex();
const mix = (a, b, k) => hex(a).lerp(hex(b), k).getHex();

// head geometry is written in head-radius units around the skull centre
const HC = new THREE.Vector3(0, 1.552, 0);
const R = 0.105;
const hp = (x, y, z) => [HC.x + x * R, HC.y + y * R, HC.z + z * R];
const hr = (x, y, z) => [x * R, y * R, z * R];

/* =================================================================== body */
function buildBody(def, outfit) {
  const look = LOOKS[def.id] ?? LOOKS.zuri;
  const b = new SkinBuilder(SKELETON);
  const skin = def.skin;
  const skinD = darker(skin, 0.78);
  const lip = mix(darker(skin, 0.72), 0x7a2f2a, 0.35);
  const hair = def.hair ?? 0x120c08;
  const accent = def.accent;
  const baggy = look.baggy ? 1.14 : 1;
  const girl = look.girl ? 1 : 0;

  /* ---- torso: shoulders, a narrower waist, hips. Skin only; clothes sit outside it. */
  const torsoW = (y) => {
    if (y < 0.95) return [['hips', 1]];
    if (y < 1.05) return [['hips', 1 - ramp(y, 0.95, 1.05)], ['spine', ramp(y, 0.95, 1.05)]];
    if (y < 1.11) return [['spine', 1]];
    return [['spine', 1 - ramp(y, 1.11, 1.2)], ['chest', ramp(y, 1.11, 1.2)]];
  };
  const profile = [
    [0.8, 0.072, 0.062, 0.004], [0.84, 0.12 + girl * 0.01, 0.086, 0.008], [0.9, 0.136 + girl * 0.014, 0.096, 0.01],
    [0.96, 0.126 + girl * 0.008, 0.088, 0.006], [1.02, 0.112 - girl * 0.004, 0.078, 0], [1.08, 0.118, 0.08, -0.002],
    [1.14, 0.132, 0.088, -0.006], [1.2, 0.146, 0.094, -0.004], [1.26, 0.15, 0.088, 0], [1.31, 0.12, 0.07, 0.006],
    [1.36, 0.058, 0.05, 0.01],
  ];
  b.add(tube(profile.map(([y, rx, rz, z]) => ({ p: [0, y, z], rx, ry: rz, w: torsoW(y), c: skin })), 22, { up: [0, 0, -1] }), {});

  /* ---- neck and head */
  b.add(tube([
    { p: [0, 1.31, 0.01], rx: 0.052, ry: 0.048, w: 'chest' },
    { p: [0, 1.36, 0.008], rx: 0.044, ry: 0.044, w: [['chest', 0.45], ['neck', 0.55]] },
    { p: [0, 1.42, 0.01], rx: 0.042, ry: 0.044, w: 'neck' },
    { p: [0, 1.48, 0.016], rx: 0.048, ry: 0.05, w: 'head' },
  ].map((r) => ({ ...r, c: skin })), 14, { up: [0, 0, -1] }), {});
  buildFace(b, skin, skinD, lip, hair, look);
  buildHair(b, look, def, hair, accent);

  /* ---- arms, with a biceps, a pinched elbow and a forearm */
  for (const [sx, side] of [[-1, 'L'], [1, 'R']]) {
    const up = `upperArm${side}`;
    const fo = `foreArm${side}`;
    const ha = `hand${side}`;
    const arm = [
      { p: [sx * 0.13, 1.3, 0.004], rx: 0.058, ry: 0.062, w: [['chest', 0.45], [up, 0.55]] },
      { p: [sx * 0.172, 1.27, 0], rx: 0.05, ry: 0.052, w: up },
      { p: [sx * 0.18, 1.18, -0.002], rx: 0.046, ry: 0.048, w: up },
      { p: [sx * 0.184, 1.1, 0], rx: 0.036, ry: 0.036, w: up },
      { p: [sx * 0.186, 1.05, 0.006], rx: 0.03, ry: 0.03, w: [[up, 0.5], [fo, 0.5]] },
      { p: [sx * 0.19, 0.96, -0.004], rx: 0.036, ry: 0.034, w: fo },
      { p: [sx * 0.194, 0.88, 0], rx: 0.026, ry: 0.024, w: fo },
      { p: [sx * 0.196, 0.83, 0], rx: 0.024, ry: 0.022, w: [[fo, 0.4], [ha, 0.6]] },
    ];
    b.add(tube(arm.map((r) => ({ ...r, c: skin })), 12, { up: [0, 0, -1] }), {});
    // elbow point, on the back of the arm
    b.add(ellipsoid([sx * 0.188, 1.05, 0.03], [0.02, 0.016, 0.016], [8, 6]), { color: skinD, bone: fo });
    addHand(b, sx, skin, ha);
    if (def.wristband) b.add(torus([sx * 0.194, 0.86, 0], 0.028, 0.008, [Math.PI / 2, 0, 0], [4, 12]), { color: def.wristband, bone: fo });
  }

  /* ---- legs: thigh, kneecap, calf, and a bare foot the shoe sits over */
  for (const [sx, side] of [[-1, 'L'], [1, 'R']]) {
    const th = `thigh${side}`;
    const sh = `shin${side}`;
    const ft = `foot${side}`;
    const leg = [
      { p: [sx * 0.062, 0.9, 0.006], rx: 0.092, ry: 0.09, w: [['hips', 0.55], [th, 0.45]] },
      { p: [sx * 0.086, 0.8, 0.004], rx: 0.078 + girl * 0.004, ry: 0.08, w: th },
      { p: [sx * 0.09, 0.66, -0.002], rx: 0.064, ry: 0.066, w: th },
      { p: [sx * 0.09, 0.52, 0], rx: 0.05, ry: 0.052, w: th },
      { p: [sx * 0.09, 0.47, -0.004], rx: 0.044, ry: 0.046, w: [[th, 0.5], [sh, 0.5]] },
      { p: [sx * 0.09, 0.36, 0.012], rx: 0.048, ry: 0.052, w: sh },
      { p: [sx * 0.091, 0.22, 0.004], rx: 0.034, ry: 0.034, w: sh },
      { p: [sx * 0.092, 0.1, 0.002], rx: 0.028, ry: 0.028, w: [[sh, 0.5], [ft, 0.5]] },
    ];
    b.add(tube(leg.map((r) => ({ ...r, c: skin })), 14, { up: [0, 0, -1] }), {});
    b.add(ellipsoid([sx * 0.09, 0.5, -0.05], [0.026, 0.02, 0.018], [8, 6]), { color: skin, bone: sh });
    const x = sx * 0.092;
    b.add(tube([
      { p: [x, 0.048, 0.03], rx: 0.034, ry: 0.03 },
      { p: [x, 0.044, -0.02], rx: 0.038, ry: 0.028 },
      { p: [x, 0.034, -0.09], rx: 0.032, ry: 0.02 },
      { p: [x, 0.026, -0.135], rx: 0.018, ry: 0.012 },
    ].map((r) => ({ ...r, c: skin, w: ft })), 12, { up: [0, 1, 0] }), {});
  }

  dress(b, def, { girl, baggy }, outfit);
  for (const g of look.gear ?? []) buildGear(b, g, def, look);

  const mesh = b.build({ material: rigMaterial({ smooth: true, standard: true, roughness: 0.68 }) });
  mesh.castShadow = true;
  mesh.frustumCulled = false;
  return { mesh, builder: b, scale: look.scale ?? 1 };
}

/** One continuous head: brow, cheeks, nose and lips are pushed out of the same surface. */
function sculptHead() {
  const geo = new THREE.SphereGeometry(1, 40, 32);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const gau = (x, y, z, cx, cy, cz, ax, ay, az) => {
    const dx = (x - cx) / ax;
    const dy = (y - cy) / ay;
    const dz = (z - cz) / az;
    return Math.exp(-(dx * dx + dy * dy + dz * dz));
  };
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    let x = v.x * 0.94;
    let y = v.y * 1.06 - 0.015;
    let z = v.z;
    const front = -z;
    if (y < 0.06) {
      const t = ramp(0.06 - y, 0, 0.95);
      x *= 1 - 0.3 * t;
      z -= 0.045 * t * Math.max(0, front + 0.2);
    }
    for (const sx of [-1, 1]) {
      const cheek = gau(x, y, front, sx * 0.36, -0.02, 0.42, 0.2, 0.16, 0.26);
      z -= 0.05 * cheek;
      x += sx * 0.02 * cheek;
      const socket = gau(x, y, front, sx * 0.3, 0.06, 0.55, 0.15, 0.09, 0.16);
      z += 0.1 * socket;
    }
    z -= 0.08 * gau(x, y, front, 0, 0.32, 0.55, 0.42, 0.08, 0.18);
    z -= 0.2 * gau(x, y, front, 0, 0.02, 0.62, 0.07, 0.22, 0.16);
    z -= 0.2 * gau(x, y, front, 0, -0.28, 0.78, 0.09, 0.1, 0.1);
    for (const sx of [-1, 1]) {
      const wing = gau(x, y, front, sx * 0.1, -0.34, 0.7, 0.07, 0.05, 0.08);
      z -= 0.07 * wing;
      x += sx * 0.03 * wing;
    }
    z -= 0.09 * gau(x, y, front, 0, -0.52, 0.62, 0.16, 0.045, 0.1);
    z -= 0.1 * gau(x, y, front, 0, -0.64, 0.58, 0.15, 0.05, 0.1);
    z += 0.045 * gau(x, y, front, 0, -0.58, 0.62, 0.1, 0.025, 0.08);
    z -= 0.05 * gau(x, y, front, 0, -0.86, 0.4, 0.12, 0.08, 0.16);
    pos.setXYZ(i, HC.x + x * R, HC.y + y * R, HC.z + z * R);
  }
  geo.deleteAttribute('normal');
  geo.computeVertexNormals();
  return geo;
}

function headTone(v, skin, lip) {
  const x = (v.x - HC.x) / R;
  const y = (v.y - HC.y) / R;
  const front = -(v.z - HC.z) / R;
  const band = Math.exp(-(x * x) / 0.028 - ((y + 0.58) ** 2) / 0.006);
  if (front > 0.42 && band > 0.42) return lip;
  return skin;
}

function buildFace(b, skin, skinD, lip, hair, look) {
  const head = 'head';
  b.add(sculptHead(), { color: (v) => headTone(v, skin, lip), bone: head });
  // A same-colour sculpt on a dark face disappears. Eyes, nose and lips sit in
  // front of the skull (its front is near local z = -1) and use a different colour.
  // Big enough, and a different colour from the skin, so a phone can read them
  // on a full-body figure as well as in a close-up.
  const lipC = mix(skin, 0xe07868, 0.82);
  const noseC = mix(skin, 0xffe0c4, 0.58);
  const brow = darker(hair, 0.9);
  for (const sx of [-1, 1]) {
    const ex = sx * 0.38;
    b.add(ellipsoid(hp(ex, 0.1, -1.22), hr(0.3, 0.16, 0.1), [12, 8]), { color: 0xf7f4ef, bone: head, glow: 0.22 });
    b.add(ellipsoid(hp(ex, 0.09, -1.3), hr(0.14, 0.13, 0.055), [10, 8]), { color: 0x5a3418, bone: head });
    b.add(ellipsoid(hp(ex, 0.088, -1.34), hr(0.062, 0.062, 0.03), [8, 6]), { color: 0x0c0806, bone: head });
    b.add(ellipsoid(hp(ex - sx * 0.05, 0.13, -1.36), hr(0.028, 0.028, 0.012), [5, 4]), { color: 0xffffff, bone: head, glow: 0.55 });
    b.add(limb(hp(sx * 0.12, 0.32, -1.12), hp(sx * 0.58, 0.2, -1.08), 0.02, 0.01, 6), { color: brow, bone: head });
    if (!['wrap', 'hat', 'puffs'].includes(look.hair)) {
      b.add(ellipsoid(hp(sx * 1.0, -0.08, 0.08), hr(0.1, 0.28, 0.16), [10, 8], { rot: [0.15, sx * 0.45, sx * 0.1] }), { color: skin, bone: head });
      b.add(ellipsoid(hp(sx * 1.02, -0.06, 0.02), hr(0.05, 0.16, 0.08), [8, 6], { rot: [0.15, sx * 0.45, sx * 0.1] }), { color: skinD, bone: head });
    }
  }
  b.add(limb(hp(0, 0.12, -1.08), hp(0, -0.2, -1.42), 0.022, 0.038, 8), { color: noseC, bone: head });
  b.add(ellipsoid(hp(0, -0.28, -1.4), hr(0.2, 0.14, 0.16), [10, 8]), { color: noseC, bone: head });
  for (const sx of [-1, 1]) {
    b.add(ellipsoid(hp(sx * 0.07, -0.36, -1.5), hr(0.05, 0.035, 0.04), [6, 4]), { color: 0x140c09, bone: head });
  }
  b.add(ellipsoid(hp(0, -0.56, -1.28), hr(0.34, 0.07, 0.1), [10, 6]), { color: darker(lipC, 0.72), bone: head });
  b.add(ellipsoid(hp(0, -0.68, -1.26), hr(0.38, 0.1, 0.11), [10, 6]), { color: lipC, bone: head });
}

/** Palm, four fingers with a knuckle, and a thumb. Palms face in toward the body. */
function addHand(b, sx, skin, ha) {
  const hx = sx * 0.2;
  b.add(ellipsoid([hx, 0.79, -0.01], [0.02, 0.028, 0.012], [10, 8]), { color: skin, bone: ha });
  for (let i = 0; i < 4; i++) {
    const z = -0.028 + i * 0.016;
    const len = [0.026, 0.03, 0.028, 0.022][i];
    const x1 = hx - sx * 0.004;
    const y1 = 0.762;
    b.add(limb([hx, y1, z], [x1, y1 - len * 0.55, z - 0.012], 0.007, 0.006, 6), { color: skin, bone: ha });
    b.add(limb([x1, y1 - len * 0.55, z - 0.012], [x1, y1 - len, z - 0.006], 0.006, 0.0045, 6), { color: skin, bone: ha });
  }
  b.add(limb([hx - sx * 0.012, 0.8, -0.03], [hx - sx * 0.028, 0.778, -0.05], 0.008, 0.0065, 6), { color: skin, bone: ha });
  b.add(limb([hx - sx * 0.028, 0.778, -0.05], [hx - sx * 0.02, 0.758, -0.062], 0.0065, 0.005, 6), { color: skin, bone: ha });
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
export function makeRunner(def, outfit = 'kit') {
  const root = new THREE.Group();
  const { mesh, builder, scale } = buildBody(def, outfitId(outfit));
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
