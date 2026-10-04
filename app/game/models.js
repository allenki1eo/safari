import * as THREE from 'three';
import { G, mat, basic, bend, mesh, taper, blobShadow, emojiTexture, bakeRigid } from './materials.js';

import { makeAnimal } from './fauna.js';

const { Group } = THREE;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

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

/** The savanna's animals are rigged and animated in fauna.js. */
export const Animals = {
  elephant: (opts) => makeAnimal('elephant', opts),
  giraffe: () => makeAnimal('giraffe'),
  zebra: () => makeAnimal('zebra'),
  cheetah: () => makeAnimal('cheetah'),
  lion: () => makeAnimal('lion'),
  hyena(boss = false) {
    const a = makeAnimal('hyena', { boss });
    if (boss) a.root.scale.setScalar(1.12);
    return a;
  },
  rhino: () => makeAnimal('rhino'),
  wildebeest: () => makeAnimal('wildebeest'),
  buffalo: () => makeAnimal('buffalo'),
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
  const capGeo = new THREE.CylinderGeometry(74, 134, 48, 18, 2);
  const cp = capGeo.attributes.position;
  for (let i = 0; i < cp.count; i++) if (cp.getY(i) < 0) cp.setY(i, cp.getY(i) - rand(0, 16));
  capGeo.computeVertexNormals();
  const cap = new THREE.Mesh(capGeo, snowMat);
  cap.position.y = 140;
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

let kitengeTex;
/** A kitenge print for the prize boxes: gold zigzags and teal dots on red. */
function kitengeTexture() {
  if (kitengeTex) return kitengeTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#c0392b';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#f4d35e';
  g.lineWidth = 7;
  for (let y = 8; y < 140; y += 32) {
    g.beginPath();
    for (let x = -16; x <= 144; x += 16) g.lineTo(x, y + ((x / 16) % 2 ? 9 : -9));
    g.stroke();
  }
  g.fillStyle = '#1b998b';
  for (let y = 24; y < 128; y += 32) for (let x = 8; x < 128; x += 16) {
    g.beginPath();
    g.arc(x, y, 3.2, 0, Math.PI * 2);
    g.fill();
  }
  kitengeTex = new THREE.CanvasTexture(c);
  kitengeTex.colorSpace = THREE.SRGBColorSpace;
  return kitengeTex;
}

/** A Zawadi (gift) box: kitenge-wrapped, gold ribbon and bow, floating in a beam of light. */
export function makePrizeBox() {
  const g = new Group();
  const box = new Group();
  box.position.y = 1.05;
  g.add(box);
  const wrap = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.86, 0.86), bend(new THREE.MeshLambertMaterial({ map: kitengeTexture(), emissive: 0x401008 })));
  box.add(wrap);
  const gold = mat(0xffc83d, { emissive: 0x7a4a00, flat: false });
  box.add(mesh(G.box, gold, 0.9, 0.9, 0.16));
  box.add(mesh(G.box, gold, 0.16, 0.9, 0.9));
  for (const s of [-1, 1]) {
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.05, 6, 14), gold);
    loop.position.set(s * 0.13, 0.52, 0);
    loop.rotation.set(0, Math.PI / 2, s * 0.5);
    box.add(loop);
  }
  box.add(mesh(G.sphere, gold, 0.07, 0.07, 0.07, 0, 0.48, 0));
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 2.6, 14, 1, true), basic(0xffd34d, { transparent: true, opacity: 0.2, additive: true, side: THREE.DoubleSide }));
  beam.position.y = 1.2;
  g.add(beam);
  g.add(blobShadow(1.2, 1.2));
  g.userData.spin = (t) => {
    box.rotation.y = t * 1.8;
    box.rotation.z = Math.sin(t * 2.2) * 0.12;
    box.position.y = 1.05 + Math.sin(t * 3.1) * 0.13;
    beam.material.opacity = 0.16 + Math.sin(t * 5) * 0.06;
  };
  return g;
}

/** A golden letter token for the daily word hunt. */
export function makeLetterToken(char) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 54, 8, 64, 64, 62);
  grd.addColorStop(0, '#fff6c8');
  grd.addColorStop(0.65, '#ffc83d');
  grd.addColorStop(1, '#c47a00');
  g.fillStyle = grd;
  g.beginPath();
  g.arc(64, 64, 60, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 6;
  g.strokeStyle = '#7a4a00';
  g.stroke();
  g.font = '900 78px "Luckiest Guy", "Arial Black", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#5a2d00';
  g.fillText(char, 64, 70);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const grp = new Group();
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.62, 28), basic(0xffffff, { map: tex, transparent: true, side: THREE.DoubleSide }));
  disc.position.y = 1.35;
  grp.add(disc);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.65, 2.6, 12, 1, true), basic(0xffe58a, { transparent: true, opacity: 0.18, additive: true, side: THREE.DoubleSide }));
  beam.position.y = 1.2;
  grp.add(beam);
  grp.add(blobShadow(1.1, 1.1));
  grp.userData.spin = (t) => {
    disc.rotation.y = Math.sin(t * 2.4) * 0.9;
    disc.position.y = 1.35 + Math.sin(t * 3) * 0.12;
  };
  return grp;
}

export { quad, spots };
