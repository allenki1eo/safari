import * as THREE from 'three';
import { G, mat, basic, mesh, taper, blobShadow, emojiTexture, bakeRigid } from './materials.js';

const { Group } = THREE;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

/* ==========================================================================
 * RUNNER — stylised humanoid built facing +z, then flipped to face the track.
 * ========================================================================== */
export function makeRunner(def) {
  const root = new Group();
  const inner = new Group();
  inner.rotation.y = Math.PI;
  root.add(inner);

  const skin = mat(def.skin);
  const shirt = mat(def.shirt);
  const pants = mat(def.pants);
  const shoes = mat(def.shoes);
  const hair = mat(def.hair);
  const accent = mat(def.accent);

  const hips = new Group();
  hips.position.y = 0.92;
  inner.add(hips);
  hips.add(mesh(G.box, pants, 0.36, 0.2, 0.22));

  const torso = new Group();
  hips.add(torso);
  torso.add(mesh(taper(1.25, 6), shirt, 0.2, 0.56, 0.14, 0, 0.34, 0));
  // belt
  torso.add(mesh(G.box, mat(0x3b2412), 0.38, 0.06, 0.24, 0, 0.08, 0));

  if (def.dress) {
    hips.add(mesh(G.cone, mat(def.dress), 0.34, 0.5, 0.26, 0, -0.12, 0)).rotation.x = Math.PI;
  }

  // Shuka / scarf — a draped cloth across the chest + flowing tail behind.
  const scarfTail = new Group();
  if (def.scarf) {
    const scarf = mat(def.scarf);
    const sash = mesh(G.box, scarf, 0.1, 0.66, 0.27, 0, 0.36, 0);
    sash.rotation.z = 0.7;
    torso.add(sash);
    torso.add(mesh(G.box, scarf, 0.46, 0.09, 0.27, 0, 0.6, 0));
    scarfTail.position.set(0.1, 0.62, -0.13);
    torso.add(scarfTail);
    const t1 = mesh(G.box, scarf, 0.16, 0.36, 0.03, 0, -0.18, 0);
    scarfTail.add(t1);
    if (def.scarfPattern) {
      const p = mat(def.scarfPattern);
      for (let i = 0; i < 3; i++) scarfTail.add(mesh(G.box, p, 0.17, 0.035, 0.035, 0, -0.06 - i * 0.12, 0));
      torso.add(mesh(G.box, p, 0.47, 0.025, 0.28, 0, 0.6, 0));
    }
  }

  if (def.backpack) {
    torso.add(mesh(G.box, mat(def.backpack), 0.3, 0.36, 0.14, 0, 0.36, -0.17));
    torso.add(mesh(G.box, mat(0x2a1a0c), 0.32, 0.06, 0.16, 0, 0.47, -0.17));
  }

  // Head
  const head = new Group();
  head.position.y = 0.66;
  torso.add(head);
  head.add(mesh(G.cyl, skin, 0.07, 0.1, 0.07, 0, 0.0, 0));
  head.add(mesh(G.sphere, skin, 0.165, 0.18, 0.165, 0, 0.17, 0));
  // eyes
  const eye = mat(0x1a0f08);
  head.add(mesh(G.sphere, eye, 0.025, 0.032, 0.02, -0.06, 0.19, 0.15));
  head.add(mesh(G.sphere, eye, 0.025, 0.032, 0.02, 0.06, 0.19, 0.15));
  head.add(mesh(G.sphere, mat(0xffffff), 0.009, 0.009, 0.01, -0.054, 0.2, 0.168));
  head.add(mesh(G.sphere, mat(0xffffff), 0.009, 0.009, 0.01, 0.066, 0.2, 0.168));
  // smile
  head.add(mesh(G.box, mat(0x6b2a1a), 0.07, 0.014, 0.02, 0, 0.1, 0.155));
  // ears
  head.add(mesh(G.sphere, skin, 0.035, 0.05, 0.03, -0.165, 0.17, 0));
  head.add(mesh(G.sphere, skin, 0.035, 0.05, 0.03, 0.165, 0.17, 0));

  switch (def.head) {
    case 'wrap': {
      head.add(mesh(G.sphere, hair, 0.175, 0.15, 0.175, 0, 0.24, -0.01));
      const wrapM = mat(def.accent);
      head.add(mesh(G.cyl, wrapM, 0.18, 0.09, 0.18, 0, 0.28, -0.01));
      head.add(mesh(G.sphere, wrapM, 0.12, 0.1, 0.1, 0.06, 0.36, -0.03));
      break;
    }
    case 'cap': {
      head.add(mesh(G.sphere, hair, 0.172, 0.14, 0.172, 0, 0.23, -0.01));
      head.add(mesh(G.sphere, accent, 0.178, 0.12, 0.178, 0, 0.27, 0));
      head.add(mesh(G.box, accent, 0.26, 0.025, 0.16, 0, 0.26, 0.17));
      break;
    }
    case 'hat': {
      head.add(mesh(G.sphere, hair, 0.17, 0.12, 0.17, 0, 0.23, -0.01));
      head.add(mesh(G.cyl, accent, 0.34, 0.025, 0.34, 0, 0.29, 0));
      head.add(mesh(taper(0.85), accent, 0.17, 0.15, 0.17, 0, 0.36, 0));
      head.add(mesh(G.cyl, mat(0x5a3416), 0.172, 0.035, 0.172, 0, 0.32, 0));
      break;
    }
    case 'braids': {
      head.add(mesh(G.sphere, hair, 0.178, 0.16, 0.178, 0, 0.23, -0.02));
      for (let i = -2; i <= 2; i++) {
        const b = mesh(G.cyl, hair, 0.025, 0.28, 0.025, i * 0.06, 0.08, -0.15);
        b.rotation.x = -0.25;
        head.add(b);
        head.add(mesh(G.sphere, accent, 0.03, 0.03, 0.03, i * 0.06, -0.06, -0.19));
      }
      break;
    }
    case 'beads': {
      head.add(mesh(G.sphere, hair, 0.168, 0.13, 0.168, 0, 0.23, -0.01));
      head.add(mesh(G.cyl, accent, 0.172, 0.03, 0.172, 0, 0.27, 0));
      const beadCols = [0xd7263d, 0x1b998b, 0xf4d35e, 0x2e86ab];
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        head.add(mesh(G.sphere, mat(beadCols[i % 4]), 0.018, 0.018, 0.018, Math.sin(a) * 0.175, 0.27, Math.cos(a) * 0.175));
      }
      break;
    }
    case 'mohawk': {
      head.add(mesh(G.sphere, hair, 0.168, 0.12, 0.168, 0, 0.22, -0.01));
      for (let i = 0; i < 5; i++) head.add(mesh(G.cone4, accent, 0.04, 0.12, 0.05, 0, 0.36 - Math.abs(i - 2) * 0.02, 0.1 - i * 0.07));
      break;
    }
  }

  if (def.necklace) {
    const cols = [0xd7263d, 0xffffff, 0x1b998b, 0xf4d35e, 0x2e86ab];
    for (let i = 0; i < 14; i++) {
      const a = (i / 13) * Math.PI - Math.PI / 2;
      torso.add(mesh(G.box, mat(cols[i % cols.length]), 0.05, 0.05, 0.03, Math.sin(a) * 0.17, 0.55 - Math.cos(a) * 0.08, 0.14 + Math.cos(a) * 0.02));
    }
  }

  // Arms
  const arms = [];
  for (const side of [-1, 1]) {
    const shoulder = new Group();
    shoulder.position.set(side * 0.27, 0.58, 0);
    torso.add(shoulder);
    shoulder.add(mesh(G.sphere, shirt, 0.08, 0.08, 0.08));
    shoulder.add(mesh(G.box, def.sleeves ? shirt : skin, 0.1, 0.3, 0.1, 0, -0.15, 0));
    const elbow = new Group();
    elbow.position.y = -0.3;
    shoulder.add(elbow);
    elbow.add(mesh(G.box, skin, 0.09, 0.27, 0.09, 0, -0.13, 0));
    elbow.add(mesh(G.sphere, skin, 0.06, 0.06, 0.06, 0, -0.29, 0));
    if (def.wristband) elbow.add(mesh(G.box, mat(def.wristband), 0.1, 0.05, 0.1, 0, -0.22, 0));
    arms.push({ shoulder, elbow, side });
  }

  // Legs
  const legs = [];
  for (const side of [-1, 1]) {
    const hip = new Group();
    hip.position.set(side * 0.1, -0.02, 0);
    hips.add(hip);
    hip.add(mesh(G.box, def.shorts ? pants : pants, 0.15, 0.44, 0.16, 0, -0.22, 0));
    const knee = new Group();
    knee.position.y = -0.44;
    hip.add(knee);
    knee.add(mesh(G.box, def.shorts ? skin : pants, 0.12, 0.42, 0.13, 0, -0.21, 0));
    if (def.socks) knee.add(mesh(G.box, mat(def.socks), 0.13, 0.14, 0.14, 0, -0.36, 0));
    knee.add(mesh(G.box, shoes, 0.14, 0.09, 0.26, 0, -0.44, 0.05));
    knee.add(mesh(G.box, mat(0xf5f0e6), 0.145, 0.03, 0.27, 0, -0.475, 0.05));
    legs.push({ hip, knee, side });
  }

  const shadow = blobShadow(0.9, 0.9);
  shadow.userData.keep = true;
  root.add(shadow);
  bakeRigid(root);

  const api = {
    root,
    shadow,
    pose: 'run',
    t: 0,
    update(dt, speed, state) {
      api.t += dt * (6 + speed * 0.32);
      const t = api.t;
      const s = Math.sin(t);
      const c = Math.cos(t);
      scarfTail.rotation.x = -0.9 - Math.sin(t * 2) * 0.25;
      scarfTail.rotation.z = Math.sin(t * 1.3) * 0.2;
      inner.rotation.z = 0;
      if (state === 'run') {
        hips.position.y = 0.92 + Math.abs(c) * 0.07;
        torso.rotation.set(0.2, s * 0.12, 0);
        head.rotation.set(-0.1, -s * 0.1, 0);
        legs[0].hip.rotation.set(-s * 0.95, 0, 0);
        legs[1].hip.rotation.set(s * 0.95, 0, 0);
        legs[0].knee.rotation.x = Math.max(0, Math.sin(t + 1.5)) * 1.4 + 0.1;
        legs[1].knee.rotation.x = Math.max(0, Math.sin(t + 1.5 + Math.PI)) * 1.4 + 0.1;
        arms[0].shoulder.rotation.set(s * 0.9, 0, -0.1);
        arms[1].shoulder.rotation.set(-s * 0.9, 0, 0.1);
        arms[0].elbow.rotation.x = -1.3;
        arms[1].elbow.rotation.x = -1.3;
      } else if (state === 'jump') {
        hips.position.y = 0.95;
        torso.rotation.set(0.35, 0, 0);
        head.rotation.set(-0.3, 0, 0);
        legs[0].hip.rotation.set(-1.1, 0, 0);
        legs[1].hip.rotation.set(-0.2, 0, 0);
        legs[0].knee.rotation.x = 1.6;
        legs[1].knee.rotation.x = 1.0;
        arms[0].shoulder.rotation.set(-2.6, 0, -0.4);
        arms[1].shoulder.rotation.set(0.9, 0, 0.5);
        arms[0].elbow.rotation.x = -0.4;
        arms[1].elbow.rotation.x = -0.9;
      } else if (state === 'slide') {
        hips.position.y = 0.32;
        torso.rotation.set(-1.15, 0, 0);
        head.rotation.set(0.9, 0, 0);
        legs[0].hip.rotation.set(-1.45, 0, 0.05);
        legs[1].hip.rotation.set(-1.2, 0, -0.05);
        legs[0].knee.rotation.x = 0.15;
        legs[1].knee.rotation.x = 0.6;
        arms[0].shoulder.rotation.set(-0.6, 0, -0.9);
        arms[1].shoulder.rotation.set(-0.6, 0, 0.9);
        arms[0].elbow.rotation.x = -0.3;
        arms[1].elbow.rotation.x = -0.3;
      } else if (state === 'ride') {
        hips.position.y = 0.5;
        torso.rotation.set(0.15 + Math.abs(c) * 0.06, 0, 0);
        head.rotation.set(-0.15, 0, 0);
        legs[0].hip.rotation.set(-1.45, 0, -0.55);
        legs[1].hip.rotation.set(-1.45, 0, 0.55);
        legs[0].knee.rotation.x = 1.5;
        legs[1].knee.rotation.x = 1.5;
        arms[0].shoulder.rotation.set(-2.7 + s * 0.3, 0, -0.3);
        arms[1].shoulder.rotation.set(-0.9, 0, 0.3);
        arms[0].elbow.rotation.x = -0.3;
        arms[1].elbow.rotation.x = -1.4;
      } else if (state === 'fly') {
        hips.position.y = 0.92;
        torso.rotation.set(0.5, 0, 0);
        head.rotation.set(-0.5, 0, 0);
        legs[0].hip.rotation.set(0.3 + s * 0.3, 0, 0);
        legs[1].hip.rotation.set(0.3 - s * 0.3, 0, 0);
        legs[0].knee.rotation.x = 0.6;
        legs[1].knee.rotation.x = 0.6;
        arms[0].shoulder.rotation.set(-3.0, 0, -0.25);
        arms[1].shoulder.rotation.set(-3.0, 0, 0.25);
        arms[0].elbow.rotation.x = 0;
        arms[1].elbow.rotation.x = 0;
      } else if (state === 'idle') {
        const b = Math.sin(t * 0.25);
        hips.position.y = 0.92 + b * 0.01;
        torso.rotation.set(0.02, Math.sin(t * 0.1) * 0.1, 0);
        head.rotation.set(0, Math.sin(t * 0.13) * 0.35, 0);
        legs[0].hip.rotation.set(0, 0, -0.04);
        legs[1].hip.rotation.set(0, 0, 0.04);
        legs[0].knee.rotation.x = 0;
        legs[1].knee.rotation.x = 0;
        arms[0].shoulder.rotation.set(0.05, 0, -0.12 - b * 0.03);
        arms[1].shoulder.rotation.set(-0.3, 0, 0.5);
        arms[0].elbow.rotation.x = -0.1;
        arms[1].elbow.rotation.x = -1.6;
      } else if (state === 'dead') {
        hips.position.y = 0.2;
        torso.rotation.set(-1.4, 0, 0);
        head.rotation.set(0.4, 0.4, 0);
        legs[0].hip.rotation.set(-1.4, 0, -0.3);
        legs[1].hip.rotation.set(-1.2, 0, 0.3);
        legs[0].knee.rotation.x = 0.3;
        legs[1].knee.rotation.x = 0.5;
        arms[0].shoulder.rotation.set(-1.0, 0, -1.4);
        arms[1].shoulder.rotation.set(-1.0, 0, 1.4);
        arms[0].elbow.rotation.x = -0.2;
        arms[1].elbow.rotation.x = -0.2;
      }
    },
  };
  return api;
}

/* ==========================================================================
 * QUADRUPEDS — one parametric builder for every savanna animal.
 * Built facing -z (towards the horizon).
 * ========================================================================== */
function quad(s) {
  const g = new Group();
  const body = new Group();
  g.add(body);
  const bodyY = s.legLen + s.bodyH * 0.45;
  body.position.y = bodyY;
  const col = mat(s.color);
  const legCol = mat(s.legColor ?? s.color);
  const L = s.bodyLen;
  const W = s.bodyW;
  const H = s.bodyH;

  body.add(mesh(G.ico1, col, W / 2, H / 2, L / 2));
  if (s.belly) body.add(mesh(G.ico1, mat(s.belly), W * 0.42, H * 0.35, L * 0.4, 0, -H * 0.18, 0));

  // legs
  const legs = [];
  const legT = s.legT;
  const backLen = s.backLegLen ?? s.legLen;
  for (const [x, z, front] of [
    [-1, -1, true],
    [1, -1, true],
    [-1, 1, false],
    [1, 1, false],
  ]) {
    const len = (front ? s.legLen : backLen) + H * 0.25;
    const pivot = new Group();
    pivot.position.set(x * (W / 2 - legT * 0.9), -H * 0.2 + (front ? 0 : backLen - s.legLen), z * (L / 2 - legT * 1.4));
    body.add(pivot);
    const upper = mesh(taper(0.7), legCol, legT, len, legT, 0, -len / 2, 0);
    pivot.add(upper);
    if (s.hoof) pivot.add(mesh(G.cyl6, mat(s.hoof), legT * 0.75, 0.12, legT * 0.85, 0, -len + 0.06, 0));
    legs.push({ pivot, front, x });
  }
  if (s.backLegLen) body.rotation.x = Math.atan2(s.legLen - s.backLegLen, L) * 0.9;

  // neck + head
  const neck = new Group();
  neck.position.set(0, H * (s.neckY ?? 0.15), -L / 2 + (s.neckInset ?? 0.25));
  neck.rotation.x = s.neckAngle;
  body.add(neck);
  if (s.neckLen > 0) neck.add(mesh(taper(0.65), col, s.neckW, s.neckLen, s.neckW * 1.1, 0, s.neckLen / 2, 0));
  const head = new Group();
  head.position.y = s.neckLen;
  head.rotation.x = -s.neckAngle + (s.headTilt ?? 0);
  neck.add(head);
  const hs = s.headSize;
  head.add(mesh(G.ico1, mat(s.headColor ?? s.color), hs * 0.55, hs * 0.5, hs * 0.65, 0, 0, -hs * 0.2));
  head.add(mesh(G.ico1, mat(s.muzzle ?? s.color), hs * 0.36, hs * 0.32, hs * 0.5, 0, -hs * 0.14, -hs * 0.7));
  head.add(mesh(G.sphere, mat(0x111111), hs * 0.07, hs * 0.08, hs * 0.07, -hs * 0.42, hs * 0.12, -hs * 0.45));
  head.add(mesh(G.sphere, mat(0x111111), hs * 0.07, hs * 0.08, hs * 0.07, hs * 0.42, hs * 0.12, -hs * 0.45));
  head.add(mesh(G.sphere, mat(0x1a1a1a), hs * 0.12, hs * 0.08, hs * 0.06, 0, -hs * 0.05, -hs * 1.18));
  if (s.ears !== false) {
    const earM = mat(s.earColor ?? s.color);
    for (const x of [-1, 1]) {
      const ear = mesh(s.roundEars ? G.sphere : G.cone4, earM, hs * 0.16, hs * 0.3, hs * 0.08, x * hs * 0.38, hs * 0.48, hs * 0.05);
      ear.rotation.z = -x * 0.4;
      head.add(ear);
    }
  }

  // tail
  const tail = new Group();
  tail.position.set(0, H * 0.25, L / 2 - 0.05);
  body.add(tail);
  if (s.tailLen) {
    const tm = mesh(G.cyl, mat(s.tailColor ?? s.color), 0.04, s.tailLen, 0.04, 0, -s.tailLen / 2, 0);
    tail.add(tm);
    if (s.tailTuft) tail.add(mesh(G.ico, mat(s.tailTuft), 0.09, 0.14, 0.09, 0, -s.tailLen, 0));
    tail.rotation.x = s.tailAngle ?? 0.5;
  }

  const shadow = blobShadow(W * 2.2, L * 1.5);
  g.add(shadow);

  const parts = { g, body, head, neck, tail, legs, L, W, H, bodyY, col };
  s.extra?.(parts);
  bakeRigid(g);

  let t = Math.random() * 10;
  const stride = s.stride ?? 0.7;
  return {
    root: g,
    parts,
    update(dt, rate = 1, mode = 'run') {
      t += dt * rate * (s.gait ?? 9);
      if (mode === 'idle') {
        legs.forEach((l) => (l.pivot.rotation.x = 0));
        body.position.y = bodyY;
        head.rotation.x = -s.neckAngle + (s.headTilt ?? 0) + Math.sin(t * 0.1) * 0.06;
        tail.rotation.z = Math.sin(t * 0.3) * 0.3;
        return;
      }
      const walk = mode === 'walk';
      const a = walk ? stride * 0.5 : stride;
      for (const l of legs) {
        const ph = (l.front ? 0 : Math.PI) + (l.x > 0 ? (walk ? Math.PI / 2 : 0.6) : 0);
        l.pivot.rotation.x = Math.sin(t + ph) * a;
      }
      body.position.y = bodyY + Math.abs(Math.sin(t)) * (walk ? 0.02 : 0.08) * H;
      body.rotation.z = Math.sin(t) * 0.02;
      neck.rotation.x = s.neckAngle + Math.sin(t * 2) * (walk ? 0.03 : 0.07);
      tail.rotation.z = Math.sin(t * 0.7) * 0.4;
      s.animate?.(parts, t, mode);
    },
  };
}

function ringStripes(p, color, count, from = -0.85, to = 0.75) {
  const m = mat(color);
  for (let i = 0; i < count; i++) {
    const f = from + ((to - from) * i) / (count - 1);
    const r = Math.sqrt(Math.max(0, 1 - f * f));
    const st = mesh(G.ico1, m, (p.W / 2) * r * 1.03, (p.H / 2) * r * 1.03, 0.045, 0, 0, (f * p.L) / 2);
    st.rotation.x = 0.25;
    p.body.add(st);
  }
}

function spots(p, color, count, size, target = p.body, spread) {
  const m = mat(color);
  const sp = spread ?? { w: p.W / 2, h: p.H / 2, l: p.L / 2 };
  for (let i = 0; i < count; i++) {
    const u = Math.random() * Math.PI * 2;
    const v = rand(-0.85, 0.85);
    const ring = Math.sqrt(1 - v * v);
    const x = Math.cos(u) * sp.w * ring;
    const y = Math.sin(u) * sp.h * ring;
    if (y < -sp.h * 0.4) continue;
    const z = v * sp.l;
    const s = size * rand(0.7, 1.3);
    target.add(mesh(G.ico, m, s, s, s, x * 1.01, y * 1.01, z));
  }
}

export const Animals = {
  elephant() {
    const a = quad({
      color: 0x8e8a87, legColor: 0x85817d, belly: 0x9c9893,
      bodyLen: 3.0, bodyH: 2.0, bodyW: 1.8, legLen: 1.3, legT: 0.36,
      neckLen: 0.2, neckW: 0.6, neckAngle: -0.4, neckY: 0.2, neckInset: 0.3,
      headSize: 1.35, headTilt: 0.1, muzzle: 0x8e8a87, ears: false,
      tailLen: 0.8, tailTuft: 0x3a3532, stride: 0.45, gait: 7, hoof: 0xd9d1c5,
      extra(p) {
        const earM = mat(0x9a8f8a);
        for (const x of [-1, 1]) {
          const ear = mesh(G.ico1, earM, 0.08, 0.62, 0.52, x * 0.62, 0.05, 0.2);
          ear.rotation.y = x * 0.5;
          p.head.add(ear);
          p.head.add(mesh(G.ico1, mat(0xc49a8f), 0.05, 0.48, 0.38, x * 0.66, 0.05, 0.12));
        }
        // trunk — four segments curling down and forward
        let seg = p.head;
        const trunkM = mat(0x8a8683);
        const pieces = [];
        for (let i = 0; i < 4; i++) {
          const piv = new Group();
          piv.position.set(0, i === 0 ? -0.15 : -0.3, i === 0 ? -0.95 : 0);
          piv.rotation.x = i === 0 ? 0.25 : -0.22;
          seg.add(piv);
          const r = 0.22 - i * 0.04;
          piv.add(mesh(G.cyl, trunkM, r, 0.34, r, 0, -0.15, 0));
          seg = piv;
          pieces.push(piv);
        }
        p.trunk = pieces;
        for (const x of [-1, 1]) {
          const tusk = mesh(G.cone, mat(0xfff6e0), 0.07, 0.62, 0.07, x * 0.3, -0.45, -0.85);
          tusk.rotation.x = -2.2;
          p.head.add(tusk);
        }
        // ceremonial blanket for the ride
        const blanket = mat(0xc0392b);
        p.body.add(mesh(G.box, blanket, 1.86, 0.08, 1.4, 0, 0.92, -0.1));
        p.body.add(mesh(G.box, mat(0xf4d35e), 1.9, 0.6, 0.05, 0, 0.62, -0.78));
        p.body.add(mesh(G.box, mat(0xf4d35e), 1.9, 0.6, 0.05, 0, 0.62, 0.58));
        for (const x of [-1, 1]) p.body.add(mesh(G.box, blanket, 0.05, 0.75, 1.4, x * 0.93, 0.55, -0.1));
      },
      animate(p, t) {
        p.trunk.forEach((pc, i) => (pc.rotation.x = (i === 0 ? 0.25 : -0.25) + Math.sin(t * 0.5 + i) * 0.12));
      },
    });
    return a;
  },

  giraffe() {
    return quad({
      color: 0xe7b257, belly: 0xf3dcae, legColor: 0xe9c07a,
      bodyLen: 1.9, bodyH: 1.15, bodyW: 0.85, legLen: 1.9, legT: 0.16,
      neckLen: 2.2, neckW: 0.22, neckAngle: -0.38, neckY: 0.3, neckInset: 0.25,
      headSize: 0.55, headTilt: 1.2, muzzle: 0xd9a65a, earColor: 0xe7b257,
      tailLen: 0.9, tailTuft: 0x3a2312, stride: 0.6, gait: 5.5, hoof: 0x3a2b20,
      extra(p) {
        spots(p, 0x8a4a1c, 34, 0.14);
        const nm = mat(0x8a4a1c);
        for (let i = 0; i < 9; i++) {
          const yy = 0.25 + i * 0.22;
          const r = 0.22 - (i * 0.08) / 9;
          const a = Math.random() * Math.PI * 2;
          p.neck.add(mesh(G.ico, nm, 0.09, 0.11, 0.09, Math.sin(a) * r, yy, Math.cos(a) * r));
          p.neck.add(mesh(G.ico, nm, 0.08, 0.1, 0.08, -Math.sin(a) * r, yy + 0.1, -Math.cos(a) * r));
        }
        const mane = mat(0x7a4a22);
        p.neck.add(mesh(G.box, mane, 0.06, 2.1, 0.08, 0, 1.1, 0.2));
        for (const x of [-1, 1]) {
          p.head.add(mesh(G.cyl, mat(0x7a4a22), 0.03, 0.22, 0.03, x * 0.1, 0.32, 0.05));
          p.head.add(mesh(G.sphere, mat(0x3a2312), 0.05, 0.05, 0.05, x * 0.1, 0.44, 0.05));
        }
      },
    });
  },

  zebra() {
    return quad({
      color: 0xf4f2ec, legColor: 0xf4f2ec,
      bodyLen: 1.7, bodyH: 0.95, bodyW: 0.72, legLen: 0.95, legT: 0.13,
      neckLen: 0.8, neckW: 0.22, neckAngle: -0.65, neckY: 0.2,
      headSize: 0.55, headTilt: 0.9, muzzle: 0x2b2b2b,
      tailLen: 0.6, tailTuft: 0x111111, stride: 0.75, gait: 9, hoof: 0x1a1a1a,
      extra(p) {
        ringStripes(p, 0x161616, 9);
        const bm = mat(0x161616);
        for (let i = 0; i < 5; i++) p.neck.add(mesh(G.cyl, bm, 0.235, 0.05, 0.25, 0, 0.12 + i * 0.15, 0)).rotation.x = 0.3;
        p.neck.add(mesh(G.box, bm, 0.06, 0.85, 0.12, 0, 0.42, 0.18));
        for (const leg of p.legs) for (let i = 0; i < 4; i++) leg.pivot.add(mesh(G.cyl, bm, 0.12, 0.05, 0.12, 0, -0.55 - i * 0.16, 0));
      },
    });
  },

  cheetah() {
    return quad({
      color: 0xe3b25a, belly: 0xf6e6c2, legColor: 0xe6bb6a,
      bodyLen: 1.5, bodyH: 0.55, bodyW: 0.46, legLen: 0.8, legT: 0.1,
      neckLen: 0.35, neckW: 0.15, neckAngle: -1.0, neckY: 0.2,
      headSize: 0.42, headTilt: 1.0, muzzle: 0xf2dcb0, roundEars: true,
      tailLen: 0.95, tailColor: 0xe3b25a, tailTuft: 0x111111, tailAngle: 1.0,
      stride: 1.05, gait: 13,
      extra(p) {
        spots(p, 0x1d140c, 46, 0.045);
        for (const x of [-1, 1]) p.head.add(mesh(G.box, mat(0x1d140c), 0.025, 0.16, 0.02, x * 0.12, -0.02, -0.38)).rotation.z = x * 0.2;
      },
      animate(p, t) {
        p.body.rotation.x = Math.sin(t) * 0.06;
      },
    });
  },

  lion() {
    return quad({
      color: 0xcf9446, belly: 0xe7c08a, legColor: 0xd29a50,
      bodyLen: 1.75, bodyH: 0.85, bodyW: 0.75, legLen: 0.8, legT: 0.15,
      neckLen: 0.3, neckW: 0.3, neckAngle: -0.9, neckY: 0.25,
      headSize: 0.66, headTilt: 0.9, muzzle: 0xe8c48e, roundEars: true,
      tailLen: 0.9, tailTuft: 0x5a2e10, tailAngle: 0.9, stride: 0.8, gait: 9,
      extra(p) {
        const mane = mat(0x8a4a18);
        const mane2 = mat(0xa45b20);
        p.head.add(mesh(G.ico1, mane, 0.55, 0.55, 0.42, 0, 0.02, 0.1));
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          p.head.add(mesh(G.ico, i % 2 ? mane : mane2, 0.2, 0.2, 0.25, Math.cos(a) * 0.48, Math.sin(a) * 0.46, 0.18));
        }
        p.neck.add(mesh(G.ico1, mane, 0.36, 0.42, 0.36, 0, 0.1, 0.05));
      },
    });
  },

  hyena(boss = false) {
    const a = quad({
      color: boss ? 0x7b6a55 : 0xa38d6d, belly: 0xbfae8e, legColor: boss ? 0x6e5d4a : 0x9a8566,
      bodyLen: 1.25, bodyH: 0.66, bodyW: 0.56, legLen: 0.85, backLegLen: 0.6, legT: 0.12,
      neckLen: 0.35, neckW: 0.22, neckAngle: -1.0, neckY: 0.2,
      headSize: 0.5, headTilt: 1.05, muzzle: 0x3a2e24, roundEars: true, earColor: 0x5a4636,
      tailLen: 0.45, tailTuft: 0x2a2018, stride: 0.85, gait: 11,
      extra(p) {
        spots(p, 0x3d2f22, 22, 0.07);
        p.body.add(mesh(G.box, mat(0x3a2b1e), 0.08, 0.18, p.L * 0.7, 0, p.H * 0.45, -0.05));
        p.neck.add(mesh(G.box, mat(0x3a2b1e), 0.08, 0.4, 0.14, 0, 0.2, 0.12));
        // glowing eyes — they are the villains after all
        const glow = basic(0xffe14d);
        p.head.add(mesh(G.sphere, glow, 0.05, 0.035, 0.03, -0.2, 0.08, -0.33));
        p.head.add(mesh(G.sphere, glow, 0.05, 0.035, 0.03, 0.2, 0.08, -0.33));
        if (boss) {
          // Fisi's tattered red bandana and gold tooth
          p.neck.add(mesh(G.cyl, mat(0xb3261e), 0.26, 0.12, 0.28, 0, 0.18, 0));
          const knot = mesh(G.cone4, mat(0xb3261e), 0.15, 0.3, 0.05, 0, 0.0, 0.25);
          knot.rotation.x = 2.4;
          p.neck.add(knot);
          p.head.add(mesh(G.box, mat(0xffd34d, { emissive: 0x553300 }), 0.05, 0.07, 0.03, 0.06, -0.2, -0.56));
        }
      },
    });
    if (boss) a.root.scale.setScalar(1.12);
    return a;
  },

  rhino() {
    return quad({
      color: 0x86807a, belly: 0x948d86, bodyLen: 2.3, bodyH: 1.25, bodyW: 1.15,
      legLen: 0.6, legT: 0.24, neckLen: 0.2, neckW: 0.55, neckAngle: -1.2, neckY: 0.0,
      headSize: 0.9, headTilt: 1.45, tailLen: 0.4, tailTuft: 0x333333, stride: 0.75, gait: 10, hoof: 0x55504a,
      extra(p) {
        const horn = mat(0xe6dccb);
        const h1 = mesh(G.cone, horn, 0.12, 0.55, 0.12, 0, 0.15, -0.95);
        h1.rotation.x = -0.4;
        p.head.add(h1);
        const h2 = mesh(G.cone, horn, 0.08, 0.28, 0.08, 0, 0.18, -0.6);
        h2.rotation.x = -0.2;
        p.head.add(h2);
        p.body.add(mesh(G.ico1, mat(0x7d7771), 0.5, 0.42, 0.6, 0, 0.35, -0.55));
        // angry red eyes when charging
        p.head.add(mesh(G.sphere, basic(0xff3b1f), 0.06, 0.05, 0.05, -0.38, 0.12, -0.42));
        p.head.add(mesh(G.sphere, basic(0xff3b1f), 0.06, 0.05, 0.05, 0.38, 0.12, -0.42));
      },
    });
  },

  wildebeest() {
    return quad({
      color: 0x55504a, belly: 0x6a645d, bodyLen: 1.6, bodyH: 1.0, bodyW: 0.7,
      legLen: 0.95, backLegLen: 0.8, legT: 0.12, neckLen: 0.55, neckW: 0.3, neckAngle: -0.75,
      headSize: 0.55, headTilt: 1.5, muzzle: 0x2a2724, tailLen: 0.6, tailTuft: 0x1a1816, stride: 0.75, gait: 9, hoof: 0x222,
      extra(p) {
        const horn = mat(0x2b2723);
        for (const x of [-1, 1]) {
          const h = mesh(G.cone, horn, 0.05, 0.35, 0.05, x * 0.28, 0.32, 0);
          h.rotation.z = -x * 1.2;
          p.head.add(h);
        }
        p.head.add(mesh(G.box, mat(0x1f1c1a), 0.08, 0.3, 0.2, 0, -0.32, -0.25));
        p.neck.add(mesh(G.box, mat(0x1f1c1a), 0.08, 0.6, 0.16, 0, 0.3, 0.2));
      },
    });
  },
};

/* ==========================================================================
 * BIRDS
 * ========================================================================== */
export function makeEagle() {
  const g = new Group();
  const brown = mat(0x5a3a1f);
  g.add(mesh(G.ico1, brown, 0.35, 0.32, 0.75));
  g.add(mesh(G.ico1, mat(0xf8f4ea), 0.27, 0.27, 0.3, 0, 0.12, -0.72));
  const beak = mesh(G.cone, mat(0xffc21a), 0.08, 0.26, 0.1, 0, 0.06, -1.02);
  beak.rotation.x = -1.8;
  g.add(beak);
  g.add(mesh(G.sphere, mat(0x111111), 0.04, 0.04, 0.04, -0.15, 0.2, -0.86));
  g.add(mesh(G.sphere, mat(0x111111), 0.04, 0.04, 0.04, 0.15, 0.2, -0.86));
  const tail = mesh(G.box, mat(0xf8f4ea), 0.42, 0.06, 0.45, 0, 0, 0.85);
  g.add(tail);
  const wings = [];
  for (const x of [-1, 1]) {
    const w = new Group();
    w.position.set(x * 0.25, 0.08, -0.1);
    g.add(w);
    const inner = mesh(G.box, brown, 1.2, 0.07, 0.75, x * 0.6, 0, 0);
    w.add(inner);
    const tip = new Group();
    tip.position.x = x * 1.2;
    w.add(tip);
    tip.add(mesh(G.box, mat(0x3c2512), 1.0, 0.05, 0.6, x * 0.5, 0, 0.08));
    for (let i = 0; i < 4; i++) tip.add(mesh(G.box, mat(0x2a190b), 0.4, 0.04, 0.1, x * (1.1 + i * 0.02), 0, -0.15 + i * 0.12));
    wings.push({ w, tip, x });
  }
  // talons
  for (const x of [-1, 1]) g.add(mesh(G.box, mat(0xffc21a), 0.08, 0.3, 0.08, x * 0.15, -0.35, 0.1));
  bakeRigid(g);
  let t = 0;
  return {
    root: g,
    update(dt, rate = 1) {
      t += dt * 7 * rate;
      for (const w of wings) {
        w.w.rotation.z = w.x * Math.sin(t) * 0.6;
        w.tip.rotation.z = w.x * Math.sin(t - 0.6) * 0.4;
      }
    },
  };
}

export function makeHornbill() {
  const g = new Group();
  const black = mat(0x1d1b1a);
  g.add(mesh(G.ico1, black, 0.22, 0.22, 0.4));
  g.add(mesh(G.ico1, mat(0xf6f1e6), 0.18, 0.14, 0.3, 0, -0.08, -0.05));
  g.add(mesh(G.ico1, black, 0.16, 0.16, 0.18, 0, 0.12, -0.42));
  const beak = mesh(G.cone, mat(0xffb21a), 0.09, 0.5, 0.12, 0, 0.05, -0.75);
  beak.rotation.x = -1.75;
  g.add(beak);
  const casque = mesh(G.ico1, mat(0xe2451f), 0.07, 0.08, 0.2, 0, 0.17, -0.62);
  g.add(casque);
  g.add(mesh(G.sphere, mat(0xffffff), 0.035, 0.035, 0.035, -0.11, 0.17, -0.5));
  g.add(mesh(G.sphere, mat(0xffffff), 0.035, 0.035, 0.035, 0.11, 0.17, -0.5));
  g.add(mesh(G.box, black, 0.2, 0.04, 0.5, 0, 0.02, 0.55));
  const wings = [];
  for (const x of [-1, 1]) {
    const w = new Group();
    w.position.set(x * 0.15, 0.06, -0.05);
    g.add(w);
    w.add(mesh(G.box, black, 0.7, 0.04, 0.38, x * 0.35, 0, 0));
    w.add(mesh(G.box, mat(0xf6f1e6), 0.25, 0.042, 0.36, x * 0.6, 0, 0));
    wings.push({ w, x });
  }
  bakeRigid(g);
  let t = 0;
  return {
    root: g,
    update(dt) {
      t += dt * 16;
      for (const w of wings) w.w.rotation.z = w.x * Math.sin(t) * 0.8;
    },
  };
}

/* ==========================================================================
 * SCENERY
 * ========================================================================== */
const leafCols = [0x5f7d2c, 0x6f8c33, 0x56722a, 0x7b9638];

export function makeAcacia(scale = 1) {
  const g = new Group();
  const bark = mat(0x5b3d26);
  const h = rand(3.2, 4.4);
  const lean = rand(-0.12, 0.12);
  const trunk = mesh(taper(0.55), bark, 0.22, h, 0.22, 0, h / 2, 0);
  trunk.rotation.z = lean;
  g.add(trunk);
  const top = new THREE.Vector3(-Math.sin(lean) * h, h, 0);
  const n = 3 + ((Math.random() * 2) | 0);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rand(0, 1);
    const len = rand(1.2, 2.0);
    const br = mesh(taper(0.5), bark, 0.09, len, 0.09);
    br.position.set(top.x + Math.cos(a) * len * 0.35, top.y + len * 0.35, Math.sin(a) * len * 0.35);
    br.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
    g.add(br);
  }
  const canopyY = top.y + rand(1.0, 1.4);
  const leaf = mat(pick(leafCols));
  const leaf2 = mat(pick(leafCols));
  g.add(mesh(G.ico1, leaf, rand(2.6, 3.4), 0.55, rand(2.2, 3.0), top.x, canopyY, 0));
  for (let i = 0; i < 4; i++) {
    const a = rand(0, Math.PI * 2);
    const r = rand(1.2, 2.2);
    g.add(mesh(G.ico1, i % 2 ? leaf2 : leaf, rand(1.1, 1.7), rand(0.35, 0.5), rand(1.0, 1.5), top.x + Math.cos(a) * r, canopyY + rand(-0.15, 0.25), Math.sin(a) * r));
  }
  g.add(blobShadow(7, 6));
  g.scale.setScalar(scale);
  return g;
}

export function makeBaobab(scale = 1) {
  const g = new Group();
  const bark = mat(pick([0x9b8775, 0x8f7d6b, 0xa58f7a]));
  const h = rand(3.6, 4.6);
  g.add(mesh(taper(0.62, 9), bark, 1.15, h, 1.15, 0, h / 2, 0));
  g.add(mesh(G.ico1, bark, 1.2, 0.6, 1.2, 0, 0.3, 0));
  const top = h;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const len = rand(1.0, 1.8);
    const br = mesh(taper(0.4), bark, 0.18, len, 0.18);
    br.position.set(Math.cos(a) * 0.5, top + len * 0.3, Math.sin(a) * 0.5);
    br.rotation.set(Math.sin(a) * 0.8, 0, -Math.cos(a) * 0.8);
    g.add(br);
    g.add(mesh(G.ico, mat(pick(leafCols)), 0.5, 0.35, 0.5, Math.cos(a) * (0.5 + len * 0.6), top + len * 0.75, Math.sin(a) * (0.5 + len * 0.6)));
  }
  g.add(blobShadow(5, 5));
  g.scale.setScalar(scale);
  return g;
}

export function makeKopje(scale = 1) {
  const g = new Group();
  const cols = [0xb39a84, 0xa68b74, 0xc2a88f, 0x9a806b];
  const n = 4 + ((Math.random() * 4) | 0);
  for (let i = 0; i < n; i++) {
    const s = rand(1.0, 2.4);
    const r = mesh(G.dodec, mat(pick(cols)), s * rand(1, 1.4), s * rand(0.7, 1.1), s, rand(-2.5, 2.5), s * 0.6, rand(-2, 2));
    r.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
    g.add(r);
  }
  const top = mesh(G.dodec, mat(pick(cols)), 1.4, 1.1, 1.3, rand(-0.6, 0.6), 2.6, 0);
  top.rotation.set(rand(0, 3), rand(0, 3), 0);
  g.add(top);
  g.scale.setScalar(scale);
  return g;
}

export function makeTermiteMound(scale = 1) {
  const g = new Group();
  const m = mat(pick([0xa65a32, 0xb4673a, 0x9b5230]));
  const h = rand(1.6, 2.6);
  g.add(mesh(G.cone, m, 0.7, h, 0.7, 0, h / 2, 0));
  g.add(mesh(G.cone, m, 0.35, h * 0.6, 0.35, 0.45, h * 0.3, 0.1));
  g.add(mesh(G.cone, m, 0.3, h * 0.45, 0.3, -0.35, h * 0.22, -0.2));
  g.add(mesh(G.ico1, m, 0.9, 0.35, 0.9, 0, 0.1, 0));
  g.scale.setScalar(scale);
  return g;
}

const grassCols = [0xd9b44a, 0xc9a03a, 0xe2c25c, 0xb8913a];
export function makeGrass(scale = 1) {
  const g = new Group();
  const m = mat(pick(grassCols));
  for (let i = 0; i < 6; i++) {
    const b = mesh(G.cone4, m, 0.08, rand(0.5, 0.9), 0.08, rand(-0.25, 0.25), 0.3, rand(-0.25, 0.25));
    b.rotation.set(rand(-0.3, 0.3), rand(0, 3), rand(-0.3, 0.3));
    g.add(b);
  }
  g.scale.setScalar(scale);
  return g;
}

export function makeBush(scale = 1) {
  const g = new Group();
  const m = mat(pick([0x6b7f2f, 0x5c6f28, 0x7a8a3a]));
  for (let i = 0; i < 4; i++) g.add(mesh(G.ico1, m, rand(0.5, 0.8), rand(0.4, 0.6), rand(0.5, 0.8), rand(-0.6, 0.6), 0.35, rand(-0.5, 0.5)));
  if (Math.random() < 0.4) for (let i = 0; i < 5; i++) g.add(mesh(G.sphere, mat(pick([0xe94f37, 0xf6c445, 0xf2f2f2])), 0.07, 0.07, 0.07, rand(-0.7, 0.7), rand(0.5, 0.85), rand(-0.6, 0.6)));
  g.scale.setScalar(scale);
  return g;
}

/* Kilimanjaro + horizon — unbent, unfogged backdrop pieces */
export function makeKilimanjaro(baseMat, snowMat) {
  const g = new Group();
  const geo = new THREE.CylinderGeometry(70, 300, 160, 18, 4);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y > -79 && y < 79) {
      pos.setX(i, pos.getX(i) * rand(0.92, 1.08));
      pos.setZ(i, pos.getZ(i) * rand(0.92, 1.08));
      pos.setY(i, y + rand(-6, 6));
    }
  }
  geo.computeVertexNormals();
  const mtn = new THREE.Mesh(geo, baseMat);
  mtn.position.y = 80;
  g.add(mtn);
  const capGeo = new THREE.CylinderGeometry(62, 108, 42, 18, 2);
  const cp = capGeo.attributes.position;
  for (let i = 0; i < cp.count; i++) if (cp.getY(i) < 0) cp.setY(i, cp.getY(i) - rand(0, 16));
  capGeo.computeVertexNormals();
  const cap = new THREE.Mesh(capGeo, snowMat);
  cap.position.y = 141;
  g.add(cap);
  // Mawenzi — the jagged secondary peak
  const maw = new THREE.Mesh(new THREE.ConeGeometry(70, 110, 7), baseMat);
  maw.position.set(250, 50, 40);
  g.add(maw);
  return g;
}

/* ==========================================================================
 * OBSTACLES & PICKUPS
 * ========================================================================== */
export function makeLog() {
  const g = new Group();
  const bark = mat(0x6b4526);
  const log = mesh(G.cyl, bark, 0.42, 2.3, 0.42, 0, 0.42, 0);
  log.rotation.z = Math.PI / 2;
  g.add(log);
  for (const x of [-1, 1]) {
    const cap = mesh(G.cyl, mat(0xd9b07a), 0.38, 0.04, 0.38, x * 1.16, 0.42, 0);
    cap.rotation.z = Math.PI / 2;
    g.add(cap);
    const ring = mesh(G.cyl, mat(0xa77a48), 0.22, 0.05, 0.22, x * 1.17, 0.42, 0);
    ring.rotation.z = Math.PI / 2;
    g.add(ring);
  }
  const stub = mesh(taper(0.4), bark, 0.1, 0.7, 0.1, 0.4, 0.95, 0.05);
  stub.rotation.z = -0.5;
  g.add(stub);
  g.add(mesh(G.ico, mat(0x6f8c33), 0.3, 0.2, 0.3, 0.68, 1.25, 0.05));
  g.add(mesh(G.ico1, mat(0x5b8a2a), 0.25, 0.15, 0.25, -0.6, 0.85, 0.2));
  g.add(blobShadow(2.8, 1.4));
  return g;
}

export function makeBranchGate() {
  const g = new Group();
  const wood = mat(0x5b3d26);
  for (const x of [-1, 1]) {
    g.add(mesh(G.cyl, wood, 0.1, 3.1, 0.1, x * 1.05, 1.55, 0));
    g.add(mesh(G.cone, wood, 0.12, 0.25, 0.12, x * 1.05, 3.2, 0));
  }
  const bough = mesh(taper(0.75), wood, 0.2, 2.5, 0.2, 0, 1.75, 0);
  bough.rotation.z = Math.PI / 2;
  g.add(bough);
  const bough2 = mesh(taper(0.75), wood, 0.13, 2.4, 0.13, 0, 2.35, 0.05);
  bough2.rotation.z = -Math.PI / 2 + 0.06;
  g.add(bough2);
  // thorny leaves
  const leaves = [mat(0x6f8c33), mat(0x5b7a2a)];
  for (let i = 0; i < 7; i++) g.add(mesh(G.ico, leaves[i % 2], 0.32, 0.22, 0.28, -1.0 + i * 0.33, 1.95 + (i % 2) * 0.35, 0.04));
  // kanga warning flags
  const flagCols = [0xd7263d, 0xf4d35e, 0x1b998b, 0xf08a24];
  for (let i = 0; i < 6; i++) {
    const f = mesh(G.cone4, mat(flagCols[i % 4]), 0.13, 0.32, 0.02, -0.85 + i * 0.34, 1.45, 0.12);
    f.rotation.x = Math.PI;
    f.rotation.y = Math.PI / 4;
    g.add(f);
  }
  g.add(blobShadow(2.6, 0.8));
  return g;
}

export function makeBoulder() {
  const g = new Group();
  const cols = [0xa08a78, 0x93806e, 0xb09a86];
  const b = mesh(G.dodec, mat(pick(cols)), 1.15, 1.3, 1.1, 0, 1.2, 0);
  b.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
  g.add(b);
  g.add(mesh(G.dodec, mat(pick(cols)), 0.6, 0.5, 0.6, 0.7, 0.4, 0.4));
  g.add(mesh(G.dodec, mat(pick(cols)), 0.5, 0.45, 0.5, -0.75, 0.35, -0.3));
  g.add(makeGrass(0.9).translateX(-0.9).translateZ(0.6));
  g.add(blobShadow(3, 2.6));
  return g;
}

export function makeMoundObstacle() {
  const g = makeTermiteMound(1.15);
  g.add(blobShadow(2.6, 2.4));
  return g;
}

/** Rustmaw poacher truck. `oncoming` trucks face the player with headlights on. */
export function makeTruck(len = 7, oncoming = false) {
  const g = new Group();
  const H = 2.7;
  const paint = mat(pick([0x4f6b3a, 0x6a5a2e, 0x7a3b2a]));
  const rust = mat(0x8a4a22);
  const dark = mat(0x2a2522);
  // cargo box (walkable top)
  const cargoLen = len - 1.9;
  g.add(mesh(G.box, paint, 2.15, 2.0, cargoLen, 0, H - 1.0, cargoLen / 2 - len / 2 + 0.1 + 1.8));
  g.add(mesh(G.box, mat(0x7a5a34), 2.2, 0.06, cargoLen + 0.02, 0, H + 0.01, cargoLen / 2 - len / 2 + 0.1 + 1.8));
  // tarp ribs
  for (let i = 0; i < Math.floor(cargoLen / 1.2); i++) g.add(mesh(G.box, rust, 2.2, 2.02, 0.08, 0, H - 1.0, -len / 2 + 2.3 + i * 1.2));
  // logo "RUSTMAW" stripe
  for (const x of [-1, 1]) g.add(mesh(G.box, mat(0xf2c14e), 0.02, 0.35, cargoLen * 0.8, x * 1.08, H - 0.8, cargoLen / 2 - len / 2 + 1.9));
  // cab
  const cabZ = -len / 2 + 0.9;
  g.add(mesh(G.box, paint, 2.1, 1.7, 1.7, 0, 1.55, cabZ));
  g.add(mesh(G.box, mat(0x9fd3e6, { emissive: 0x112233 }), 1.9, 0.7, 0.04, 0, 1.95, cabZ - 0.86));
  g.add(mesh(G.box, dark, 2.12, 0.6, 0.06, 0, 0.95, cabZ - 0.86));
  // grille + bumper
  for (let i = 0; i < 5; i++) g.add(mesh(G.box, mat(0x777066), 0.06, 0.45, 0.04, -0.4 + i * 0.2, 0.95, cabZ - 0.9));
  g.add(mesh(G.box, mat(0x55504a), 2.3, 0.2, 0.2, 0, 0.6, cabZ - 0.9));
  const lightM = oncoming ? basic(0xfff3b0) : mat(0xddd6c0);
  for (const x of [-1, 1]) g.add(mesh(G.cyl, lightM, 0.16, 0.06, 0.16, x * 0.78, 1.15, cabZ - 0.9)).rotation.x = Math.PI / 2;
  // chassis + wheels
  g.add(mesh(G.box, dark, 1.9, 0.35, len - 0.3, 0, 0.55, 0));
  const wheelM = mat(0x1d1a18);
  const hubM = mat(0x9a948a);
  const wz = [cabZ + 0.1, len / 2 - 1.2, len / 2 - 2.5];
  for (const z of wz)
    for (const x of [-1, 1]) {
      const w = mesh(G.cyl, wheelM, 0.48, 0.32, 0.48, x * 0.98, 0.48, z);
      w.rotation.z = Math.PI / 2;
      g.add(w);
      const hb = mesh(G.cyl, hubM, 0.2, 0.34, 0.2, x * 0.99, 0.48, z);
      hb.rotation.z = Math.PI / 2;
      g.add(hb);
    }
  // empty cages on top -> rescued animals!
  const cage = mat(0x3a3530);
  g.add(mesh(G.box, cage, 0.05, 0.6, 0.05, 0.7, H + 0.3, len / 2 - 1));
  g.add(blobShadow(3.2, len + 0.6));
  // Built with the cab towards the horizon; oncoming trucks turn to face the runner.
  if (oncoming) g.rotation.y = Math.PI;
  return { group: g, height: H };
}

export function makeRamp(len = 5, height = 2.7) {
  const g = new Group();
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(len, height);
  shape.lineTo(len, 0);
  shape.lineTo(0, 0);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 2.1, bevelEnabled: false });
  geo.translate(-len / 2, 0, -1.05);
  geo.rotateY(Math.PI / 2);
  const ramp = new THREE.Mesh(geo, mat(0x8b5e34));
  g.add(ramp);
  // planks
  const plank = mat(0xa8743f);
  for (let i = 0; i < len / 0.5; i++) {
    const f = (i + 0.5) / (len / 0.5);
    const p = mesh(G.box, plank, 2.15, 0.06, 0.42, 0, f * height + 0.03, len / 2 - f * len);
    p.rotation.x = Math.atan2(height, len);
    g.add(p);
  }
  g.add(blobShadow(2.8, len));
  return g;
}

export function makeTotem(emoji, ring) {
  const g = new Group();
  const disc = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), basic(0xffffff, { map: emojiTexture(emoji, ring), transparent: true }));
  disc.position.y = 1.3;
  g.add(disc);
  const torus = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.06, 6, 24), basic(ring));
  torus.position.y = 1.3;
  g.add(torus);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.75, 2.4, 12, 1, true), basic(ring, { transparent: true, opacity: 0.22, additive: true, side: THREE.DoubleSide }));
  beam.position.y = 1.2;
  g.add(beam);
  g.add(blobShadow(1.4, 1.4));
  g.userData.spin = (t) => {
    torus.rotation.y = t * 2.5;
    torus.rotation.x = Math.sin(t * 1.3) * 0.4;
    disc.position.y = 1.3 + Math.sin(t * 3) * 0.12;
    torus.position.y = disc.position.y;
  };
  return g;
}
