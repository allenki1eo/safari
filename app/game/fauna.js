import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import {
  Animator, PAT, SkinBuilder, TAU, box, cone, ellipsoid, limb, ramp, rigMaterial, sampleClip, tube,
} from './rigkit.js';

/**
 * Savanna animals, built and animated in code: a parametric skinned quadruped (spine,
 * neck chain, head, ears, tail chain, three-segment legs) that each species dresses
 * with its own shape and coat, plus generated gaits — a four-beat walk, a gallop for
 * hoofed animals, a bounding sprint for cats and hyenas, an elephant's amble — and idles
 * with breathing, tail swishes, ear flicks and grazing.
 *
 * Model space: hooves on y = 0, facing -z. A leg swings forward with +x; to lower the neck,
 * rotate it by -x.
 */

const s = Math.sin;
const c = Math.cos;
const pos = (x) => Math.max(0, x);

/* ============================================================ skeleton */
function quadSkeleton(d) {
  const L = d.len;
  const yC = d.h - d.girth * 0.45; // body centre at the shoulders
  const yP = yC - (d.slope ?? 0); // and at the hips
  const zC = -L * 0.32;
  const zP = L * 0.34;
  const spec = [
    ['root', null, [0, 0, 0]],
    ['pelvis', 'root', [0, yP, zP]],
    ['spine', 'pelvis', [0, (yC + yP) / 2, 0]],
    ['chest', 'spine', [0, yC, zC]],
  ];
  // neck chain from the top front of the chest
  const neck = [];
  const n0 = new THREE.Vector3(0, yC + d.girth * 0.22, zC - L * 0.12);
  const dir = new THREE.Vector3(0, s(d.neckAngle), -c(d.neckAngle));
  let parent = 'chest';
  for (let i = 0; i < d.neckSegs; i++) {
    const p = n0.clone().addScaledVector(dir, (d.neckLen * i) / d.neckSegs);
    spec.push([`neck${i}`, parent, p.toArray()]);
    neck.push(p);
    parent = `neck${i}`;
  }
  const headP = n0.clone().addScaledVector(dir, d.neckLen);
  spec.push(['head', parent, headP.toArray()]);
  spec.push(['earL', 'head', [-d.headW * 0.5, headP.y + d.headH * 0.4, headP.z + 0.02]]);
  spec.push(['earR', 'head', [d.headW * 0.5, headP.y + d.headH * 0.4, headP.z + 0.02]]);
  // tail chain
  const t0 = new THREE.Vector3(0, yP + d.girth * 0.3, zP + L * 0.2);
  const tdir = new THREE.Vector3(0, -s(d.tailAngle ?? 1.2), c(d.tailAngle ?? 1.2));
  parent = 'pelvis';
  for (let i = 0; i < 3; i++) {
    const p = t0.clone().addScaledVector(tdir, (d.tailLen * i) / 3);
    spec.push([`tail${i}`, parent, p.toArray()]);
    parent = `tail${i}`;
  }
  // legs: upper (shoulder/hip), lower (elbow/stifle), foot (fetlock)
  const legs = [];
  for (const [side, sx] of [['L', -1], ['R', 1]]) {
    for (const front of [true, false]) {
      const id = `${front ? 'f' : 'h'}${side}`;
      const top = new THREE.Vector3(sx * d.w * 0.3, (front ? yC : yP) - d.girth * 0.12, front ? zC - 0.02 : zP + 0.02);
      // real joint angles: the front leg's elbow and knee, the hind leg's stifle forward and hock back
      // front carpus angles forward, hind stifle forward and hock back
      const knee = front
        ? new THREE.Vector3(top.x, top.y * 0.58, top.z - 0.045)
        : new THREE.Vector3(top.x, top.y * 0.62, top.z - L * 0.08);
      const fet = front
        ? new THREE.Vector3(top.x, Math.max(0.14, top.y * 0.28), top.z + 0.02)
        : new THREE.Vector3(top.x, Math.max(0.16, top.y * 0.34), top.z + L * 0.085);
      spec.push([`${id}0`, front ? 'chest' : 'pelvis', top.toArray()]);
      spec.push([`${id}1`, `${id}0`, knee.toArray()]);
      spec.push([`${id}2`, `${id}1`, fet.toArray()]);
      legs.push({ id, front, sx, top, knee, fet });
    }
  }
  return { spec, legs, yC, yP, zC, zP, n0, dir, headP, neck, t0, tdir };
}

/* ============================================================ builder */
function buildQuad(d) {
  const k = quadSkeleton(d);
  d.extraBones?.(k.spec, k);
  const b = new SkinBuilder(k.spec);
  const col = d.color;
  const shade = new THREE.Color(col).multiplyScalar(0.72).getHex();
  const coat = d.coat ?? { type: PAT.hide, color: shade, scale: 5.5 };
  const L = d.len;

  // torso: rings from the chest (front) to the haunches (back), blended over three bones
  const prof = d.profile ?? [[0, 0.55], [0.12, 0.92], [0.3, 1], [0.55, 0.9], [0.78, 0.95], [0.94, 0.72], [1, 0.35]];
  const zF = k.zC - L * 0.2;
  const zB = k.zP + L * 0.18;
  b.add(tube(prof.map(([u, r]) => {
    const z = zF + (zB - zF) * u;
    const y = k.yC + (k.yP - k.yC) * ramp(u, 0.15, 0.85) + (d.hump ? d.hump * Math.exp(-((u - 0.18) ** 2) / 0.02) : 0);
    const wC = 1 - ramp(u, 0.2, 0.5);
    const wP = ramp(u, 0.5, 0.8);
    return {
      p: [0, y, z], rx: (d.w / 2) * r, ry: (d.girth / 2) * r * (d.belly ?? 1),
      c: col, pat: coat,
      w: [['chest', wC], ['spine', Math.max(0.001, 1 - wC - wP)], ['pelvis', wP]],
    };
  }), 16, { up: [0, 1, 0] }), {});
  if (d.underside) {
    b.add(tube(prof.slice(1, -1).map(([u, r]) => {
      const z = zF + (zB - zF) * u;
      const y = k.yC + (k.yP - k.yC) * ramp(u, 0.15, 0.85) - (d.girth / 2) * r * 0.55;
      return { p: [0, y, z], rx: (d.w / 2) * r * 0.62, ry: (d.girth / 2) * r * 0.45, c: d.underside, w: u < 0.5 ? 'chest' : 'pelvis' };
    }), 10), {});
  }

  // neck: rings along the chain, each weighted to its own bone
  const nRings = [];
  const nN = d.neckSegs;
  for (let i = 0; i <= nN; i++) {
    const p = k.n0.clone().addScaledVector(k.dir, (d.neckLen * i) / nN);
    if (i === 0) p.addScaledVector(k.dir, -0.15).y -= d.girth * 0.12;
    const r = d.neckR0 + (d.neckR1 - d.neckR0) * (i / nN);
    nRings.push({ p: p.toArray(), rx: r, ry: r * 1.15, c: col, pat: d.neckCoat ?? coat, w: i === 0 ? 'chest' : i === nN ? 'head' : `neck${i - 1}` });
  }
  b.add(tube(nRings, 10, { up: [0, 0, 1] }), {});

  // legs: tapering rings, shared rings at the joints blend the two segments
  for (const leg of k.legs) {
    const { id, front, top, knee, fet } = leg;
    const r = d.legR * (front ? 1 : 1.08);
    const thick = front ? d.thighF ?? 1.7 : d.thighH ?? 2.1;
    const legCol = d.legColor ?? col;
    const legPat = d.legCoat;
    const rings = [
      { p: [top.x * 0.85, top.y + d.girth * 0.18, top.z], rx: r * thick, ry: r * thick * 1.3, c: col, pat: coat, w: `${id}0` },
      { p: top.toArray(), rx: r * thick * 0.9, ry: r * thick * 1.15, c: col, pat: coat, w: `${id}0` },
      { p: [knee.x, (top.y + knee.y) / 2, (top.z + knee.z) / 2], rx: r * 1.15, ry: r * 1.25, c: legCol, pat: legPat, w: `${id}0` },
      { p: knee.toArray(), rx: r * 1.22, ry: r * 1.05, c: legCol, pat: legPat, w: [[`${id}0`, 0.5], [`${id}1`, 0.5]] },
      { p: [fet.x, (knee.y + fet.y) / 2, (knee.z + fet.z) / 2], rx: r * 0.72, ry: r * 0.75, c: legCol, pat: legPat, w: `${id}1` },
      { p: fet.toArray(), rx: r * 0.75, ry: r * 0.8, c: legCol, pat: legPat, w: [[`${id}1`, 0.5], [`${id}2`, 0.5]] },
      { p: [fet.x, d.paws ? 0.05 : 0.07, fet.z - (d.paws ? 0.04 : 0)], rx: r * (d.paws ? 1.05 : 0.82), ry: r * (d.paws ? 1.2 : 0.85), c: d.hoof ?? legCol, w: `${id}2` },
      { p: [fet.x, 0.0, fet.z - (d.paws ? 0.06 : 0)], rx: r * (d.paws ? 1.0 : 0.9), ry: r * (d.paws ? 1.25 : 0.9), c: d.hoof ?? legCol, w: `${id}2` },
    ];
    b.add(tube(rings, 12, { up: [0, 0, -1] }), {});
  }

  // tail
  const tRings = [];
  for (let i = 0; i <= 3; i++) {
    const p = k.t0.clone().addScaledVector(k.tdir, (d.tailLen * i) / 3);
    tRings.push({ p: p.toArray(), rx: d.tailR * (1 - i * 0.22), c: d.tailColor ?? col, pat: d.tailCoat, w: `tail${Math.min(2, i)}` });
  }
  b.add(tube(tRings, 6, { up: [0, 0, 1] }), {});
  if (d.tuft) {
    const end = k.t0.clone().addScaledVector(k.tdir, d.tailLen);
    const tip = end.clone().addScaledVector(k.tdir, d.tuft * 0.5);
    b.add(tube([
      { p: end.toArray(), rx: d.tailR * 0.9 }, { p: end.clone().addScaledVector(k.tdir, d.tuft * 0.2).toArray(), rx: d.tailR * 1.35 }, { p: tip.toArray(), rx: d.tailR * 0.5 },
    ].map((r) => ({ ...r, c: d.tuftColor ?? 0x1a1410, w: 'tail2' })), 6, { up: [0, 0, 1] }), {});
  }

  d.dress?.(b, k, d);
  const m = b.build({ material: rigMaterial({ smooth: true, standard: true, roughness: 0.72 }) });
  return { mesh: m, builder: b, k };
}

/** Head helper: a long or round head pointing along `pitch` (radians below horizontal). */
function head(b, k, d, { len, w, h, pitch, color, muzzle, muzzleLen = 0.4, nose, eyes = 0x120c08, glowEyes = false, coat }) {
  const H = k.headP;
  const dir = new THREE.Vector3(0, -s(pitch), -c(pitch));
  const centre = H.clone().addScaledVector(dir, len * 0.35);
  const rot = [-(Math.PI / 2 - pitch), 0, 0];
  // skull and face: an egg along the head direction, then a muzzle
  b.add(ellipsoid(centre.toArray(), [w / 2, len * 0.42, h / 2], [16, 12], { rot }), { color, bone: 'head', pat: coat });
  const mz = H.clone().addScaledVector(dir, len * (0.55 + muzzleLen * 0.3));
  b.add(ellipsoid(mz.toArray(), [w * 0.36, len * muzzleLen * 0.55, h * 0.36], [12, 8], { rot }), { color: muzzle ?? color, bone: 'head' });
  if (nose) {
    const np = H.clone().addScaledVector(dir, len * (0.62 + muzzleLen * 0.55));
    b.add(ellipsoid(np.toArray(), [w * 0.18, w * 0.11, w * 0.13], [8, 6]), { color: nose, bone: 'head' });
    for (const sx of [-1, 1]) {
      b.add(ellipsoid([np.x + sx * w * 0.08, np.y - w * 0.02, np.z - w * 0.04], [w * 0.035, w * 0.025, w * 0.03], [6, 4]), { color: 0x120c08, bone: 'head' });
    }
  }
  // a closed mouth under the muzzle, so the face isn't a smooth egg
  const mouth = mz.clone().addScaledVector(dir, len * muzzleLen * 0.15);
  mouth.y -= h * 0.08;
  b.add(ellipsoid(mouth.toArray(), [w * 0.22, h * 0.035, w * 0.08], [8, 4]), { color: 0x2a1812, bone: 'head' });
  for (const sx of [-1, 1]) {
    // proud of the skull, or the white sits inside the head and never draws
    const e = centre.clone().addScaledVector(dir, len * 0.4);
    e.x += sx * w * 0.3;
    e.y += h * 0.18;
    e.addScaledVector(dir, w * 0.12);
    const p = e.toArray();
    b.add(ellipsoid(p, [w * 0.09, w * 0.075, w * 0.055], [10, 8]), { color: 0xf4efe6, bone: 'head' });
    const iris = e.clone().addScaledVector(dir, w * 0.05);
    b.add(ellipsoid(iris.toArray(), [w * 0.045, w * 0.045, w * 0.03], [8, 6]), { color: glowEyes ? 0xffe14d : eyes, bone: 'head', glow: glowEyes ? 1.5 : 0 });
    const pupil = e.clone().addScaledVector(dir, w * 0.08);
    b.add(ellipsoid(pupil.toArray(), [w * 0.022, w * 0.022, w * 0.015], [6, 4]), { color: 0x0c0806, bone: 'head' });
  }
  return { centre, dir, mz };
}

function ears(b, k, d, { w, h, color, inner, round = false, tilt = 0.25 }) {
  for (const [sx, bone] of [[-1, 'earL'], [1, 'earR']]) {
    const p = b.at(bone);
    if (round) {
      b.add(ellipsoid([p.x, p.y + h * 0.4, p.z], [w * 0.5, h * 0.5, w * 0.22], [7, 5], { rot: [0, 0, sx * tilt] }), { color, bone });
      if (inner) b.add(ellipsoid([p.x, p.y + h * 0.4, p.z - w * 0.1], [w * 0.32, h * 0.32, w * 0.1], [6, 4], { rot: [0, 0, sx * tilt] }), { color: inner, bone });
    } else {
      b.add(cone([p.x + sx * h * 0.25, p.y + h * 0.45, p.z], w * 0.5, h, 5, [0, 0, -sx * (0.5 + tilt)]), { color, bone });
    }
  }
}

/* ============================================================ species */
const SPECIES = {
  zebra: {
    len: 1.6, h: 1.38, w: 0.66, girth: 0.78, legR: 0.07, slope: 0.02,
    neckLen: 0.75, neckAngle: 0.85, neckSegs: 2, neckR0: 0.2, neckR1: 0.13, headW: 0.24, headH: 0.26,
    tailLen: 0.55, tailR: 0.035, tuft: 0.16, color: 0xf3efe6, hoof: 0x1d1b1a,
    coat: { type: PAT.stripesZ, color: 0x161412, scale: 6.5 },
    neckCoat: { type: PAT.stripesY, color: 0x161412, scale: 7 },
    legCoat: { type: PAT.stripesY, color: 0x161412, scale: 10 },
    gait: 'gallop', walkAmp: 0.38, runAmp: 0.75, graze: true,
    dress(b, k, d) {
      head(b, k, d, { len: 0.58, w: 0.24, h: 0.27, pitch: 1.0, color: 0xf3efe6, muzzle: 0x26221f, muzzleLen: 0.42, coat: { type: PAT.stripesY, color: 0x161412, scale: 14 } });
      ears(b, k, d, { w: 0.08, h: 0.2, color: 0xf3efe6 });
      // the upright striped mane
      const rings = [];
      for (let i = 0; i <= 4; i++) {
        const p = k.n0.clone().addScaledVector(k.dir, (d.neckLen * 1.05 * i) / 4);
        p.z += 0.11;
        p.y += 0.12;
        rings.push({ p: p.toArray(), rx: 0.025, ry: 0.08, c: 0xf3efe6, pat: { type: PAT.stripesY, color: 0x161412, scale: 12 }, w: i === 0 ? 'chest' : i === 4 ? 'head' : `neck${Math.min(d.neckSegs - 1, i - 1)}` });
      }
      b.add(tube(rings, 6, { up: [0, 0.5, 1] }), {});
    },
  },

  wildebeest: {
    len: 1.7, h: 1.45, w: 0.64, girth: 0.86, legR: 0.07, slope: 0.18, hump: 0.08,
    neckLen: 0.55, neckAngle: 0.55, neckSegs: 2, neckR0: 0.26, neckR1: 0.16, headW: 0.26, headH: 0.28,
    tailLen: 0.7, tailR: 0.04, tuft: 0.28, tuftColor: 0x141210, color: 0xa09888, legColor: 0x7a7268, hoof: 0x2a2622,
    coat: { type: PAT.stripesZ, color: 0x4a453e, scale: 9 },
    gait: 'gallop', walkAmp: 0.38, runAmp: 0.78, graze: true,
    dress(b, k, d) {
      const hd = head(b, k, d, { len: 0.62, w: 0.26, h: 0.3, pitch: 1.25, color: 0x8a8278, muzzle: 0x2a2420, muzzleLen: 0.48 });
      ears(b, k, d, { w: 0.08, h: 0.16, color: 0x8a8278, tilt: 0.9 });
      // cow-like horns curving out and up
      for (const sx of [-1, 1]) {
        const base = k.headP.clone();
        base.x += sx * 0.1;
        base.y += 0.08;
        b.add(tube([
          { p: base.toArray(), rx: 0.04 }, { p: [sx * 0.24, base.y + 0.02, base.z + 0.02], rx: 0.032 }, { p: [sx * 0.3, base.y + 0.16, base.z - 0.02], rx: 0.016 },
        ].map((r) => ({ ...r, c: 0xc8bba6, w: 'head' })), 6), {});
      }
      // beard and mane
      for (let i = 0; i < 3; i++) {
        const p = k.n0.clone().addScaledVector(k.dir, d.neckLen * (0.2 + i * 0.3));
        b.add(ellipsoid([0, p.y - 0.2, p.z - 0.05], [0.04, 0.16, 0.08], [5, 4]), { color: 0x1f1c1a, bone: i === 0 ? 'chest' : `neck${Math.min(1, i - 1)}` });
        b.add(ellipsoid([0, p.y + 0.16, p.z + 0.06], [0.03, 0.1, 0.1], [5, 4]), { color: 0x1f1c1a, bone: i === 0 ? 'chest' : `neck${Math.min(1, i - 1)}` });
      }
      void hd;
    },
  },

  buffalo: {
    len: 2.0, h: 1.55, w: 0.95, girth: 1.08, legR: 0.09, slope: 0.08, hump: 0.08,
    neckLen: 0.35, neckAngle: 0.25, neckSegs: 1, neckR0: 0.4, neckR1: 0.3, headW: 0.4, headH: 0.38,
    tailLen: 0.7, tailR: 0.045, tuft: 0.22, color: 0x8a6850, legColor: 0x6e5344, hoof: 0x3a2e26,
    coat: { type: PAT.hide, color: 0xc4a07a, scale: 3.2 },
    gait: 'gallop', walkAmp: 0.32, runAmp: 0.62, graze: true,
    dress(b, k, d) {
      head(b, k, d, { len: 0.6, w: 0.4, h: 0.42, pitch: 1.2, color: 0x7a5a48, muzzle: 0x8a6a54, muzzleLen: 0.42, nose: 0x2a1c16, glowEyes: false });
      ears(b, k, d, { w: 0.14, h: 0.2, color: 0x7a5a48, round: true, tilt: 1.4 });
      // the boss: a heavy horn base, horns sweeping down then up
      const hp = k.headP;
      const horn = 0xd4c4a4;
      b.add(ellipsoid([0, hp.y + 0.14, hp.z - 0.02], [0.24, 0.07, 0.14], [8, 5]), { color: horn, bone: 'head' });
      for (const sx of [-1, 1]) {
        b.add(tube([
          { p: [sx * 0.15, hp.y + 0.14, hp.z - 0.02], rx: 0.075 },
          { p: [sx * 0.38, hp.y + 0.02, hp.z + 0.02], rx: 0.055 },
          { p: [sx * 0.5, hp.y + 0.1, hp.z - 0.02], rx: 0.04 },
          { p: [sx * 0.5, hp.y + 0.3, hp.z - 0.08], rx: 0.012 },
        ].map((r) => ({ ...r, c: horn, w: 'head' })), 6), {});
      }
    },
  },

  hyena: {
    len: 1.25, h: 0.86, w: 0.5, girth: 0.6, legR: 0.055, slope: 0.18, thighH: 1.8,
    neckLen: 0.35, neckAngle: 0.55, neckSegs: 2, neckR0: 0.2, neckR1: 0.15, headW: 0.26, headH: 0.26,
    tailLen: 0.35, tailR: 0.05, tailAngle: 0.9, tuft: 0.12, tuftColor: 0x2a2018, paws: true,
    color: 0xa38d6d, legColor: 0x9a8566, hoof: 0x3a2e24, underside: 0xbfae8e,
    coat: { type: PAT.spots, color: 0x3d2f22, scale: 9 },
    legCoat: { type: PAT.spots, color: 0x3d2f22, scale: 12 },
    gait: 'bound', walkAmp: 0.4, runAmp: 0.85,
    dress(b, k, d) {
      const boss = d.boss;
      head(b, k, d, { len: 0.42, w: 0.27, h: 0.27, pitch: 0.45, color: boss ? 0x6e5d4a : 0x9a8566, muzzle: 0x3a2e24, muzzleLen: 0.42, nose: 0x120c08, glowEyes: true });
      ears(b, k, d, { w: 0.13, h: 0.14, color: 0x5a4636, inner: 0x8a7258, round: true, tilt: 0.4 });
      // the dark ridge of mane along the neck and shoulders
      const rings = [];
      for (let i = 0; i <= 4; i++) {
        const p = k.n0.clone().addScaledVector(k.dir, (d.neckLen * i) / 4);
        p.y += 0.14;
        p.z += 0.08 + (4 - i) * 0.05;
        rings.push({ p: p.toArray(), rx: 0.02, ry: 0.07, c: 0x2a1f16, w: i < 2 ? 'chest' : i === 4 ? 'head' : `neck${i - 2}` });
      }
      b.add(tube(rings, 5, { up: [0, 0.6, 0.8] }), {});
      if (boss) {
        // Fisi: a tattered red bandana and a gold tooth
        const p = k.n0.clone().addScaledVector(k.dir, d.neckLen * 0.55);
        b.add(tube([
          { p: [0, p.y + 0.03, p.z + 0.06], rx: 0.2, ry: 0.22 },
          { p: [0, p.y - 0.02, p.z - 0.04], rx: 0.21, ry: 0.23 },
        ].map((r) => ({ ...r, c: 0xb3261e, w: 'neck0' })), 10, { up: [0, 0, 1] }), {});
        b.add(cone([0, p.y - 0.22, p.z - 0.1], 0.12, 0.26, 4, [Math.PI - 0.3, 0, 0]), { color: 0xb3261e, bone: 'neck0' });
        const hp = k.headP;
        b.add(box([0.04, hp.y - 0.14, hp.z - 0.36], [0.03, 0.05, 0.02]), { color: 0xffd34d, bone: 'head', glow: 0.4 });
      }
    },
  },

  lion: {
    len: 1.75, h: 1.08, w: 0.62, girth: 0.78, legR: 0.08, slope: 0.04, paws: true,
    neckLen: 0.32, neckAngle: 0.5, neckSegs: 1, neckR0: 0.28, neckR1: 0.24, headW: 0.42, headH: 0.42,
    tailLen: 0.95, tailR: 0.04, tailAngle: 1.05, tuft: 0.13, tuftColor: 0x5a2e10,
    color: 0xcf9446, legColor: 0xd29a50, hoof: 0xc58a3e, underside: 0xe7c08a,
    coat: { type: PAT.hide, color: 0x9a6830, scale: 6.5 },
    gait: 'bound', walkAmp: 0.42, runAmp: 0.8,
    dress(b, k, d) {
      head(b, k, d, { len: 0.5, w: 0.42, h: 0.42, pitch: 0.5, color: 0xcf9446, muzzle: 0xe8c48e, muzzleLen: 0.35, nose: 0x5a2e22 });
      ears(b, k, d, { w: 0.13, h: 0.13, color: 0xa86a2a, round: true });
      // a full mane, layered around the head and down the neck
      const hp = k.headP;
      b.add(ellipsoid([0, hp.y + 0.02, hp.z + 0.12], [0.42, 0.44, 0.3], [10, 8]), { color: 0x8a4a18, bone: 'head' });
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU;
        b.add(ellipsoid([s(a) * 0.38, hp.y + c(a) * 0.38, hp.z + 0.16], [0.15, 0.15, 0.2], [6, 5]), { color: i % 2 ? 0x8a4a18 : 0xa45b20, bone: 'head' });
      }
      b.add(ellipsoid([0, k.n0.y - 0.02, k.n0.z + 0.05], [0.33, 0.4, 0.32], [8, 6]), { color: 0x8a4a18, bone: 'neck0' });
    },
  },

  cheetah: {
    len: 1.4, h: 0.86, w: 0.4, girth: 0.46, legR: 0.045, slope: -0.02, paws: true, belly: 0.9,
    neckLen: 0.3, neckAngle: 0.45, neckSegs: 1, neckR0: 0.13, neckR1: 0.11, headW: 0.22, headH: 0.2,
    tailLen: 0.95, tailR: 0.035, tailAngle: 1.0, tuft: 0.05, tuftColor: 0xf6e6c2,
    color: 0xe3b25a, legColor: 0xe6bb6a, hoof: 0xd9a650, underside: 0xf6e6c2,
    coat: { type: PAT.spots, color: 0x1d140c, scale: 16 },
    legCoat: { type: PAT.spots, color: 0x1d140c, scale: 20 },
    tailCoat: { type: PAT.stripesZ, color: 0x1d140c, scale: 9 },
    gait: 'bound', walkAmp: 0.42, runAmp: 1.0, flex: 1.6,
    dress(b, k, d) {
      const hd = head(b, k, d, { len: 0.3, w: 0.22, h: 0.21, pitch: 0.4, color: 0xe3b25a, muzzle: 0xf2dcb0, muzzleLen: 0.32, nose: 0x1d140c });
      ears(b, k, d, { w: 0.08, h: 0.07, color: 0xd9a650, round: true });
      // the black tear marks
      for (const sx of [-1, 1]) {
        const p = hd.centre.clone().addScaledVector(hd.dir, 0.02);
        b.add(box([sx * 0.06, p.y - 0.04, p.z - 0.09], [0.015, 0.09, 0.015], [0.4, 0, sx * 0.2]), { color: 0x1d140c, bone: 'head' });
      }
    },
  },

  giraffe: {
    len: 1.8, h: 2.95, w: 0.72, girth: 1.0, legR: 0.075, slope: 0.45, thighF: 1.6, thighH: 1.8,
    neckLen: 2.15, neckAngle: 1.05, neckSegs: 4, neckR0: 0.22, neckR1: 0.1, headW: 0.22, headH: 0.24,
    tailLen: 0.95, tailR: 0.03, tuft: 0.2, tuftColor: 0x3a2312,
    color: 0xf3e3c0, legColor: 0xf0dcb0, hoof: 0x3a2b20,
    coat: { type: PAT.patches, color: 0xa0521c, scale: 4.5 },
    neckCoat: { type: PAT.patches, color: 0xa0521c, scale: 5.5 },
    gait: 'gallop', walkAmp: 0.32, runAmp: 0.55, neckPump: 0.18, graze: false,
    dress(b, k, d) {
      head(b, k, d, { len: 0.55, w: 0.22, h: 0.25, pitch: 1.05, color: 0xe7c48a, muzzle: 0xd9a65a, muzzleLen: 0.42, coat: { type: PAT.patches, color: 0xa0521c, scale: 9 } });
      ears(b, k, d, { w: 0.07, h: 0.17, color: 0xe7c48a, tilt: 0.7 });
      const hp = k.headP;
      for (const sx of [-1, 1]) {
        b.add(limb([sx * 0.06, hp.y + 0.08, hp.z], [sx * 0.07, hp.y + 0.26, hp.z + 0.02], 0.025, 0.02, 5), { color: 0x7a4a22, bone: 'head' });
        b.add(ellipsoid([sx * 0.07, hp.y + 0.28, hp.z + 0.02], [0.035, 0.035, 0.035], [5, 4]), { color: 0x3a2312, bone: 'head' });
      }
      // a short brown mane down the back of the neck
      const rings = [];
      for (let i = 0; i <= 4; i++) {
        const p = k.n0.clone().addScaledVector(k.dir, (d.neckLen * i) / 4);
        p.z += 0.1 - i * 0.012;
        p.y += 0.03;
        rings.push({ p: p.toArray(), rx: 0.022, ry: 0.06, c: 0x7a4a22, w: i === 0 ? 'chest' : i === 4 ? 'head' : `neck${Math.min(3, i)}` });
      }
      b.add(tube(rings, 5, { up: [0, 0, 1] }), {});
    },
  },

  elephant: {
    len: 2.9, h: 3.0, w: 1.6, girth: 1.85, legR: 0.24, slope: 0.15, thighF: 1.35, thighH: 1.4, belly: 1.05,
    neckLen: 0.35, neckAngle: 0.3, neckSegs: 1, neckR0: 0.62, neckR1: 0.55, headW: 1.0, headH: 1.0,
    tailLen: 0.8, tailR: 0.05, tuft: 0.16, tuftColor: 0x2a2522,
    color: 0x8e8a87, legColor: 0x85817d, hoof: 0xd9d1c5,
    coat: { type: PAT.hide, color: 0x6a6662, scale: 2.8 },
    legCoat: { type: PAT.hide, color: 0x5c5854, scale: 3.4 },
    gait: 'amble', walkAmp: 0.22, runAmp: 0.34,
    extraBones(spec, k) {
      // the trunk is a chain of its own
      const hp = k.headP;
      let parent = 'head';
      for (let i = 0; i < 5; i++) {
        spec.push([`trunk${i}`, parent, [0, hp.y - 0.15 - i * 0.36, hp.z - 0.8 - Math.sin(i * 0.5) * 0.25]]);
        parent = `trunk${i}`;
      }
    },
    dress(b, k, d) {
      const hp = k.headP;
      // the domed head, the trunk (a chain of its own bones) and the tusks
      b.add(ellipsoid([0, hp.y + 0.05, hp.z - 0.35], [0.62, 0.7, 0.6], [12, 9]), { color: 0x8e8a87, bone: 'head' });
      b.add(ellipsoid([0, hp.y + 0.42, hp.z - 0.3], [0.48, 0.32, 0.42], [10, 6]), { color: 0x918d8a, bone: 'head' });
      for (const sx of [-1, 1]) {
        b.add(ellipsoid([sx * 0.38, hp.y + 0.15, hp.z - 0.72], [0.055, 0.06, 0.05], [5, 4]), { color: 0x120c08, bone: 'head' });
        b.add(tube([
          { p: [sx * 0.24, hp.y - 0.32, hp.z - 0.62], rx: 0.07 },
          { p: [sx * 0.3, hp.y - 0.62, hp.z - 0.9], rx: 0.055 },
          { p: [sx * 0.26, hp.y - 0.72, hp.z - 1.25], rx: 0.02 },
        ].map((r) => ({ ...r, c: 0xfff6e0, w: 'head' })), 6), {});
      }
      const trunk = [];
      for (let i = 0; i <= 5; i++) {
        trunk.push({ p: [0, hp.y - 0.15 - i * 0.36, hp.z - 0.8 - Math.sin(i * 0.5) * 0.25], rx: 0.26 - i * 0.033, c: 0x8a8683, w: `trunk${Math.min(4, i)}` });
      }
      b.add(tube(trunk, 9, { up: [0, 0, -1] }), {});
      // ears: big flapping fans with pink insides
      for (const [sx, bone] of [[-1, 'earL'], [1, 'earR']]) {
        const p = b.at(bone);
        b.add(ellipsoid([p.x + sx * 0.35, p.y - 0.25, p.z + 0.15], [0.06, 0.62, 0.52], [8, 7], { rot: [0, sx * 0.4, 0] }), { color: 0x9a8f8a, bone });
        b.add(ellipsoid([p.x + sx * 0.33, p.y - 0.25, p.z + 0.1], [0.04, 0.48, 0.38], [7, 6], { rot: [0, sx * 0.4, 0] }), { color: 0xc49a8f, bone });
      }
      if (d.saddle) {
        // Tembo's ceremonial blanket for the ride
        const yb = k.yC + d.girth * 0.46;
        b.add(box([0, yb, -0.15], [1.7, 0.08, 1.35]), { color: 0xc0392b, bone: 'spine', pat: { type: PAT.check, color: 0x1b2a6b, scale: 6 } });
        for (const sx of [-1, 1]) b.add(box([sx * 0.86, yb - 0.38, -0.15], [0.05, 0.75, 1.35]), { color: 0xc0392b, bone: 'spine', pat: { type: PAT.check, color: 0x1b2a6b, scale: 6 } });
        for (const z of [-0.84, 0.54]) b.add(box([0, yb - 0.3, z], [1.75, 0.6, 0.05]), { color: 0xf4d35e, bone: 'spine' });
      }
    },
  },

  rhino: {
    len: 2.3, h: 1.6, w: 1.05, girth: 1.15, legR: 0.12, slope: 0.02, thighF: 1.5, thighH: 1.6,
    neckLen: 0.3, neckAngle: 0.1, neckSegs: 1, neckR0: 0.45, neckR1: 0.38, headW: 0.5, headH: 0.5,
    tailLen: 0.4, tailR: 0.04, tuft: 0.08, tuftColor: 0x333333,
    color: 0x86807a, legColor: 0x7e7872, hoof: 0x55504a,
    coat: { type: PAT.hide, color: 0x5a554e, scale: 2.4 },
    gait: 'gallop', walkAmp: 0.28, runAmp: 0.55,
    dress(b, k, d) {
      const hd = head(b, k, d, { len: 0.85, w: 0.5, h: 0.48, pitch: 0.75, color: 0x86807a, muzzle: 0x7d7771, muzzleLen: 0.4, eyes: 0x1a1410 });
      ears(b, k, d, { w: 0.12, h: 0.2, color: 0x7d7771, tilt: 0.3 });
      const tip = hd.mz.clone();
      b.add(cone([0, tip.y + 0.32, tip.z - 0.02], 0.13, 0.62, 6, [-0.35, 0, 0]), { color: 0xe6dccb, bone: 'head' });
      b.add(cone([0, tip.y + 0.3, tip.z + 0.3], 0.09, 0.34, 6, [-0.2, 0, 0]), { color: 0xe6dccb, bone: 'head' });
    },
  },

  hippo: {
    len: 2.15, h: 1.28, w: 1.28, girth: 1.18, legR: 0.17, slope: 0.05, thighF: 1.35, thighH: 1.45,
    neckLen: 0.2, neckAngle: 0.18, neckSegs: 1, neckR0: 0.42, neckR1: 0.5, headW: 0.9, headH: 0.55,
    tailLen: 0.28, tailR: 0.07, tuft: 0.08, tuftColor: 0x5a4850,
    color: 0x8a7380, legColor: 0x7a6570, hoof: 0x645058,
    coat: { type: PAT.hide, color: 0x5c4a52, scale: 3.2 },
    gait: 'amble', walkAmp: 0.16, runAmp: 0.26, graze: false,
    profile: [[0, 0.72], [0.14, 1], [0.38, 1.08], [0.62, 1.02], [0.84, 0.88], [1, 0.42]],
    dress(b, k, d) {
      const hp = k.headP;
      const hide = { type: PAT.hide, color: 0x5c4a52, scale: 4 };
      // a barrel head and a broad snout; the nostrils sit on top, the way a hippo breathes
      b.add(ellipsoid([0, hp.y + 0.04, hp.z - 0.12], [0.5, 0.4, 0.44], [16, 12]), { color: 0x8a7380, bone: 'head', pat: hide });
      b.add(ellipsoid([0, hp.y - 0.06, hp.z - 0.52], [0.44, 0.3, 0.4], [14, 10]), { color: 0x9a8490, bone: 'head', pat: hide });
      b.add(ellipsoid([0, hp.y - 0.2, hp.z - 0.7], [0.3, 0.035, 0.1], [10, 4]), { color: 0x4a3038, bone: 'head' });
      for (const sx of [-1, 1]) {
        b.add(ellipsoid([sx * 0.24, hp.y + 0.24, hp.z - 0.32], [0.075, 0.055, 0.05], [8, 6]), { color: 0xf4efe6, bone: 'head' });
        b.add(ellipsoid([sx * 0.24, hp.y + 0.24, hp.z - 0.36], [0.038, 0.038, 0.02], [6, 5]), { color: 0x3a2418, bone: 'head' });
        b.add(ellipsoid([sx * 0.24, hp.y + 0.24, hp.z - 0.38], [0.016, 0.016, 0.01], [5, 4]), { color: 0x0c0806, bone: 'head' });
        b.add(ellipsoid([sx * 0.1, hp.y + 0.16, hp.z - 0.86], [0.055, 0.04, 0.045], [8, 5]), { color: 0x241612, bone: 'head' });
        b.add(ellipsoid([sx * 0.46, hp.y + 0.28, hp.z - 0.02], [0.07, 0.11, 0.045], [8, 6], { rot: [0.1, 0, sx * 0.5] }), { color: 0x7a6570, bone: sx < 0 ? 'earL' : 'earR' });
      }
      void d;
    },
  },
};

/* ============================================================== gaits */
function legPose(ph, amp, lift, front) {
  const swing = s(ph);
  const rec = pos(c(ph)); // the leg is travelling forward, off the ground
  return [
    [amp * swing + (front ? 0.05 : -0.05), 0, 0],
    [-lift * rec * (front ? 1 : 0.8), 0, 0],
    [lift * 0.7 * rec - 0.15 * pos(-c(ph)), 0, 0],
  ];
}

function gaitPose(d, k, t, kind) {
  const p = t * TAU;
  const pose = {};
  let phases;
  let amp;
  let lift;
  let bob;
  let flex = 0;
  if (kind === 'walk') {
    phases = { hL: 0, fL: 0.25, hR: 0.5, fR: 0.75 };
    amp = d.walkAmp;
    lift = 0.7;
    bob = 0.015;
  } else if (d.gait === 'bound') {
    phases = { hL: 0, hR: 0.08, fL: 0.5, fR: 0.58 };
    amp = d.runAmp;
    lift = 1.3;
    bob = 0.06;
    flex = 0.18 * (d.flex ?? 1);
  } else if (d.gait === 'amble') {
    phases = { hL: 0, fL: 0.2, hR: 0.5, fR: 0.7 };
    amp = d.runAmp;
    lift = 0.6;
    bob = 0.04;
  } else {
    phases = { hL: 0, hR: 0.12, fL: 0.5, fR: 0.6 };
    amp = d.runAmp;
    lift = 1.15;
    bob = 0.05;
    flex = 0.06;
  }
  for (const leg of k.legs) {
    const ph = p + TAU * phases[`${leg.front ? 'f' : 'h'}${leg.id[1]}`];
    const [u, l, f] = legPose(ph, amp, lift, leg.front);
    pose[`${leg.id}0`] = u;
    pose[`${leg.id}1`] = l;
    pose[`${leg.id}2`] = f;
  }
  const beat = kind === 'walk' || d.gait === 'amble' ? p * 2 : p;
  pose['root@'] = [0, bob * Math.abs(s(beat)) - bob * 0.5, 0];
  pose.chest = [flex * s(p + 0.6), 0, 0];
  pose.pelvis = [-flex * s(p), 0, 0];
  const pump = (d.neckPump ?? 0.06) * s(beat);
  for (let i = 0; i < d.neckSegs; i++) pose[`neck${i}`] = [pump / d.neckSegs, 0, 0];
  pose.head = [-pump * 0.6, 0, 0];
  pose.tail0 = [kind === 'walk' ? 0 : 0.5, 0.25 * s(p * 0.5), 0];
  pose.tail1 = [0.1, 0.2 * s(p * 0.5 - 0.6), 0];
  pose.tail2 = [0.1, 0.2 * s(p * 0.5 - 1.2), 0];
  pose.earL = [kind === 'walk' ? 0 : -0.3, 0, 0];
  pose.earR = [kind === 'walk' ? 0 : -0.3, 0, 0];
  for (let i = 0; i < 5; i++) pose[`trunk${i}`] = [0.12 * s(p + i * 0.6) + (kind === 'walk' ? 0 : 0.08), 0, 0.05 * s(p * 0.5 + i)];
  if (d.gait === 'amble') {
    pose.earL = [0, 0.25 * s(p * 2), 0];
    pose.earR = [0, -0.25 * s(p * 2), 0];
  }
  return pose;
}

function idlePose(d, t, graze) {
  const p = t * TAU;
  const pose = {};
  pose.chest = [0.012 * s(p * 2), 0, 0];
  pose['root@'] = [0, 0.004 * s(p * 2), 0];
  const look = graze ? 0 : 0.18 * s(p);
  for (let i = 0; i < d.neckSegs; i++) {
    pose[`neck${i}`] = graze ? [-(d.grazeDrop ?? 0.95) / d.neckSegs - (i === 0 ? 0.25 : 0), 0, 0] : [0, look / d.neckSegs, 0];
  }
  pose.head = graze ? [-0.25 + 0.08 * s(p * 4), 0, 0] : [0.04 * s(p * 0.5), look * 0.6, 0];
  // a tail swish and an ear flick every so often
  const flick = Math.pow(pos(s(p * 3)), 8);
  pose.tail0 = [0.05, 0.35 * s(p * 2), 0];
  pose.tail1 = [0.05, 0.3 * s(p * 2 - 0.7), 0];
  pose.tail2 = [0.05, 0.3 * s(p * 2 - 1.4), 0];
  pose.earL = [-0.3 * flick, 0, -0.1 * flick];
  pose.earR = [0, 0.2 * s(p), 0];
  for (let i = 0; i < 5; i++) pose[`trunk${i}`] = [0.1 + 0.12 * s(p + i * 0.7), 0, 0.12 * s(p * 0.5 + i * 0.4)];
  if (d.gait === 'amble') {
    pose.earL = [0, 0.3 * s(p * 2), 0];
    pose.earR = [0, -0.3 * s(p * 2 + 0.4), 0];
  }
  return pose;
}

/* ============================================================== animal */
const cache = new Map();

/** Builds (and caches the clips of) one species variant. */
function build(kind, opts) {
  const key = `${kind}|${opts.boss ? 'boss' : ''}|${opts.saddle ? 'saddle' : ''}`;
  let entry = cache.get(key);
  if (!entry) {
    // the first of each variant is built and its clips baked; the rest share its geometry
    const d = { ...SPECIES[kind], ...opts };
    const { mesh: m, builder, k } = buildQuad(d);
    const opt = { moving: ['root'] };
    const clips = [
      sampleClip('walk', d.gait === 'amble' ? 1.6 : 1.1, (t) => gaitPose(d, k, t, 'walk'), builder, opt),
      sampleClip('run', d.gait === 'bound' ? 0.42 : d.gait === 'amble' ? 0.9 : 0.56, (t) => gaitPose(d, k, t, 'run'), builder, opt),
      sampleClip('idle', 4, (t) => idlePose(d, t, false), builder, opt),
    ];
    if (d.graze) clips.push(sampleClip('graze', 4, (t) => idlePose(d, t, true), builder, opt));
    entry = { template: m, clips, d };
    cache.set(key, entry);
  }
  return { mesh: cloneSkinned(entry.template), clips: entry.clips, d: entry.d };
}

/**
 * A savanna animal with the game's animal API: `root` (facing -z) and
 * `update(dt, rate, mode)` for modes run / walk / idle.
 */
export function makeAnimal(kind, opts = {}) {
  const { mesh: m, clips, d } = build(kind, opts);
  m.castShadow = false;
  const root = new THREE.Group();
  root.add(m);
  const anim = new Animator(m, clips);
  anim.mixer.setTime(Math.random() * 4);
  let mode = '';
  let idleClip = 'idle';
  let idleT = 0;
  return {
    root,
    update(dt, rate = 1, next = 'run') {
      if (next === 'idle') {
        if (mode !== 'idle' || (idleT -= dt) <= 0) {
          idleClip = d.graze && Math.random() < 0.55 ? 'graze' : 'idle';
          idleT = 4 + Math.random() * 6;
        }
        anim.play(idleClip, { fade: 0.6, speed: 1 });
      } else {
        anim.play(next === 'walk' ? 'walk' : 'run', { fade: 0.3, speed: Math.max(0.35, rate) * (next === 'walk' ? 1 : 0.9) });
      }
      mode = next;
      anim.update(dt);
    },
  };
}

