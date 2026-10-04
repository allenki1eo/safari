import * as THREE from 'three';
import { G, mat, basic, bend, mesh, turn, taper, blobShadow, bakeRigid } from './materials.js';
import { Animals, quad, spots, makeTermiteMound } from './models.js';
import { makeWildAnimal } from './wildlife.js';

/* Low-poly art for the journey beyond the Serengeti. */

const { Group } = THREE;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

/* ============================================================== flora */
export function makeFeverTree(scale = 1) {
  const g = new Group();
  const bark = mat(pick([0xc2c95a, 0xb5bf55, 0xcfd06a]));
  const h = rand(5, 7);
  g.add(mesh(taper(0.6), bark, 0.26, h, 0.26, 0, h / 2, 0));
  for (let i = 0; i < 4; i++) {
    const a = rand(0, Math.PI * 2);
    const len = rand(1.6, 2.6);
    const y = h * rand(0.55, 0.9);
    const b = mesh(taper(0.5), bark, 0.1, len, 0.1, Math.cos(a) * len * 0.35, y + len * 0.35, Math.sin(a) * len * 0.35);
    b.rotation.set(Math.sin(a) * 0.8, 0, -Math.cos(a) * 0.8);
    g.add(b);
    g.add(mesh(G.ico1, mat(pick([0x9fbf4a, 0x8db043])), rand(1.0, 1.5), 0.4, rand(0.9, 1.3), Math.cos(a) * len * 0.75, y + len * 0.75, Math.sin(a) * len * 0.75));
  }
  g.add(blobShadow(4, 4));
  g.scale.setScalar(scale);
  return g;
}

export function makeGroundsel(scale = 1) {
  const g = new Group();
  const trunk = mat(0x6f6658);
  const skirt = mat(0x8a7a5e);
  const h = rand(2.2, 3.4);
  g.add(mesh(G.cyl6, skirt, 0.32, h * 0.8, 0.32, 0, h * 0.4, 0));
  const arms = 1 + ((Math.random() * 3) | 0);
  for (let i = 0; i < arms; i++) {
    const a = (i / arms) * Math.PI * 2 + rand(0, 1);
    const off = arms === 1 ? 0 : 0.55;
    const ah = h + rand(-0.3, 0.6);
    const x = Math.cos(a) * off;
    const z = Math.sin(a) * off;
    const arm = mesh(G.cyl6, trunk, 0.2, ah - h * 0.7, 0.2, x / 2, h * 0.7 + (ah - h * 0.7) / 2, z / 2);
    arm.rotation.set(z * 0.6, 0, -x * 0.6);
    g.add(arm);
    // the cabbage-like rosette
    g.add(mesh(G.ico1, mat(0x5f7d3a), 0.5, 0.32, 0.5, x, ah + 0.1, z));
    for (let k = 0; k < 7; k++) {
      const b = (k / 7) * Math.PI * 2;
      const leaf = mesh(G.cone4, mat(0x7a9a48), 0.1, 0.6, 0.05, x + Math.cos(b) * 0.35, ah + 0.25, z + Math.sin(b) * 0.35);
      leaf.rotation.set(Math.sin(b) * 0.9, 0, -Math.cos(b) * 0.9);
      g.add(leaf);
    }
  }
  g.add(blobShadow(2.2, 2.2));
  g.scale.setScalar(scale);
  return g;
}

export function makeLobelia(scale = 1) {
  const g = new Group();
  const h = rand(1.4, 2.4);
  g.add(mesh(G.ico1, mat(0x6f8a52), 0.6, 0.25, 0.6, 0, 0.15, 0));
  g.add(mesh(taper(0.55, 8), mat(0x8fa27a), 0.22, h, 0.22, 0, h / 2 + 0.2, 0));
  for (let i = 0; i < 14; i++) {
    const y = 0.4 + (i / 14) * h;
    const a = i * 2.4;
    const r = 0.22 * (1 - i / 18);
    g.add(mesh(G.ico, mat(i % 2 ? 0x7d9a6a : 0x5e7a8a), 0.08, 0.08, 0.08, Math.cos(a) * r, y, Math.sin(a) * r));
  }
  g.scale.setScalar(scale);
  return g;
}

export function makeMontane(scale = 1) {
  const g = new Group();
  const h = rand(6, 9);
  g.add(mesh(taper(0.5), mat(0x4a3a2c), 0.3, h, 0.3, 0, h / 2, 0));
  const leaf = mat(pick([0x2f5a35, 0x37643a, 0x2a4f31]));
  for (let i = 0; i < 4; i++) {
    const y = h * 0.45 + i * h * 0.15;
    g.add(mesh(G.cone, leaf, 1.8 - i * 0.35, 1.6, 1.8 - i * 0.35, 0, y, 0));
  }
  // "old man's beard" lichen
  for (let i = 0; i < 5; i++) {
    const a = rand(0, Math.PI * 2);
    g.add(mesh(G.cyl6, mat(0xb9c79a), 0.04, rand(0.5, 1.1), 0.04, Math.cos(a) * 1.2, h * rand(0.45, 0.7), Math.sin(a) * 1.2));
  }
  g.add(blobShadow(3.5, 3.5));
  g.scale.setScalar(scale);
  return g;
}

export function makeSnowRock(scale = 1) {
  const g = new Group();
  const s = rand(0.8, 1.6);
  const r = mesh(G.dodec, mat(pick([0x7d7f88, 0x8c8e96, 0x6f717a])), s * 1.2, s * 0.8, s, 0, s * 0.5, 0);
  r.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
  g.add(r);
  g.add(mesh(G.ico1, mat(0xf4f7fb), s * 1.05, s * 0.3, s * 0.9, 0, s * 1.05, 0));
  g.scale.setScalar(scale);
  return g;
}

export function makePalm(scale = 1) {
  const g = new Group();
  const bark = mat(0x9a7a55);
  const ring = mat(0x7d6142);
  const segs = 7;
  const lean = rand(0.04, 0.12) * (Math.random() < 0.5 ? -1 : 1);
  let x = 0;
  let y = 0;
  for (let i = 0; i < segs; i++) {
    const s = mesh(taper(0.85, 7), i % 2 ? bark : ring, 0.2 - i * 0.012, 0.95, 0.2 - i * 0.012, x, y + 0.47, 0);
    s.rotation.z = -lean * i * 0.6;
    g.add(s);
    x += Math.sin(lean * i * 0.6) * 0.95;
    y += Math.cos(lean * i * 0.6) * 0.95;
  }
  const frond = mat(pick([0x4f8a3a, 0x5c9a40, 0x467d34]));
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rand(0, 0.3);
    const piv = new Group();
    piv.position.set(x, y + 0.05, 0);
    piv.rotation.set(0, a, 0);
    const f = mesh(G.box, frond, 0.36, 0.04, 2.4, 0, 0, 1.15);
    f.rotation.x = rand(0.35, 0.7);
    piv.add(f);
    const tip = mesh(G.box, frond, 0.26, 0.04, 1.2, 0, -0.85, 2.6);
    tip.rotation.x = 1.0;
    piv.add(tip);
    g.add(piv);
  }
  for (let i = 0; i < 3; i++) g.add(mesh(G.sphere, mat(0x6b5a2e), 0.14, 0.14, 0.14, x + rand(-0.2, 0.2), y - 0.2, rand(-0.2, 0.2)));
  g.add(blobShadow(4, 4));
  g.scale.setScalar(scale);
  return g;
}

export function makeDoum(scale = 1) {
  const g = new Group();
  const bark = mat(0x7a6a52);
  const h = rand(2.4, 3.2);
  g.add(mesh(G.cyl6, bark, 0.22, h, 0.22, 0, h / 2, 0));
  for (const side of [-1, 1]) {
    const b = mesh(G.cyl6, bark, 0.15, 2, 0.15, side * 0.55, h + 0.8, 0);
    b.rotation.z = -side * 0.55;
    g.add(b);
    const fan = mat(pick([0x6f9a48, 0x7fa851]));
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const f = mesh(G.cone4, fan, 0.45, 1.3, 0.05, side * 1.1 + Math.cos(a) * 0.5, h + 1.8, Math.sin(a) * 0.5);
      f.rotation.set(Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2);
      g.add(f);
    }
  }
  g.add(blobShadow(3.5, 3));
  g.scale.setScalar(scale);
  return g;
}

export function makePapyrus(scale = 1) {
  const g = new Group();
  const stalk = mat(0x6f9a3a);
  const head = mat(0x9cc45a);
  for (let i = 0; i < 9; i++) {
    const x = rand(-0.6, 0.6);
    const z = rand(-0.6, 0.6);
    const h = rand(1.4, 2.4);
    const s = mesh(G.cyl6, stalk, 0.03, h, 0.03, x, h / 2, z);
    s.rotation.set(rand(-0.15, 0.15), 0, rand(-0.15, 0.15));
    g.add(s);
    g.add(turn(mesh(G.cone, head, 0.32, 0.25, 0.32, x, h + 0.05, z), 'x', Math.PI));
  }
  g.scale.setScalar(scale);
  return g;
}

export function makeHut(scale = 1) {
  const g = new Group();
  g.add(mesh(G.cyl, mat(0xd9b98a), 1.5, 1.8, 1.5, 0, 0.9, 0));
  g.add(mesh(G.box, mat(0x5a3a22), 0.7, 1.2, 0.1, 0, 0.6, 1.48));
  g.add(mesh(G.cone, mat(0xb08a4a), 2.3, 1.8, 2.3, 0, 2.6, 0));
  g.add(mesh(G.cone, mat(0x9a763c), 2.35, 0.25, 2.35, 0, 1.8, 0));
  g.add(blobShadow(4, 4));
  g.scale.setScalar(scale);
  return g;
}

export function makeStoneHouse(scale = 1) {
  const g = new Group();
  const wall = mat(pick([0xf2ead8, 0xe9d6b0, 0xf5efe2, 0xe8c9a0]));
  const w = rand(3, 4.5);
  const h = rand(3.2, 4.6);
  g.add(mesh(G.box, wall, w, h, 3, 0, h / 2, 0));
  g.add(mesh(G.box, mat(0xd8cbb0), w + 0.2, 0.25, 3.2, 0, h + 0.1, 0));
  // carved Zanzibar door with brass studs
  const door = mat(0x5a3418);
  g.add(mesh(G.box, door, 1.1, 2.0, 0.1, 0, 1.0, 1.52));
  g.add(mesh(G.box, mat(0x7a4a22), 1.4, 0.3, 0.12, 0, 2.15, 1.53));
  for (let i = 0; i < 6; i++) g.add(mesh(G.sphere, mat(0xd4a83a), 0.04, 0.04, 0.04, -0.35 + (i % 2) * 0.7, 0.4 + Math.floor(i / 2) * 0.6, 1.58));
  // shuttered windows + a little balcony
  const shutter = mat(pick([0x2f8f8a, 0x2e6f9a, 0x6a8f3a]));
  for (const x of [-w / 3, w / 3]) g.add(mesh(G.box, shutter, 0.6, 0.8, 0.08, x, h * 0.7, 1.52));
  g.add(mesh(G.box, mat(0x6b4a2a), w * 0.7, 0.08, 0.6, 0, h * 0.55, 1.8));
  g.add(blobShadow(w + 1.5, 4.5));
  g.scale.setScalar(scale);
  return g;
}

export function makeBanana(scale = 1) {
  const g = new Group();
  const h = rand(1.6, 2.4);
  g.add(mesh(taper(0.8), mat(0x6f8a3a), 0.16, h, 0.16, 0, h / 2, 0));
  const leaf = mat(pick([0x4f9a3a, 0x5aa845, 0x468a33]));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const piv = new Group();
    piv.position.y = h;
    piv.rotation.y = a;
    const l = mesh(G.box, leaf, 0.55, 0.03, 1.8, 0, 0.2, 0.85);
    l.rotation.x = -0.5 + rand(0, 0.9);
    piv.add(l);
    g.add(piv);
  }
  g.scale.setScalar(scale);
  return g;
}

export function makeJungleTree(scale = 1) {
  const g = new Group();
  const bark = mat(pick([0x5a4632, 0x4e3e2c]));
  const h = rand(7, 10);
  g.add(mesh(taper(0.55, 8), bark, 0.55, h, 0.55, 0, h / 2, 0));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const fin = mesh(G.box, bark, 0.12, 1.4, 1.1, Math.cos(a) * 0.6, 0.6, Math.sin(a) * 0.6);
    fin.rotation.y = -a;
    g.add(fin);
  }
  const leaf = [mat(0x2f5f2a), mat(0x376b2f), mat(0x2a5427)];
  for (let i = 0; i < 6; i++) {
    const a = rand(0, Math.PI * 2);
    const r = rand(0.8, 2.6);
    g.add(mesh(G.ico1, leaf[i % 3], rand(1.8, 2.8), rand(1.1, 1.6), rand(1.8, 2.8), Math.cos(a) * r, h + rand(-0.8, 1), Math.sin(a) * r));
  }
  for (let i = 0; i < 6; i++) g.add(mesh(G.cyl6, mat(0x4f7a2e), 0.035, rand(2, 4), 0.035, rand(-2.2, 2.2), h - 2.2, rand(-2.2, 2.2)));
  g.add(blobShadow(7, 7));
  g.scale.setScalar(scale);
  return g;
}

export function makeFern(scale = 1) {
  const g = new Group();
  const m = mat(pick([0x4f8a3a, 0x5c9a40, 0x3f7a32]));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + rand(0, 0.4);
    const f = mesh(G.cone4, m, 0.22, 1.1, 0.04, Math.cos(a) * 0.45, 0.45, Math.sin(a) * 0.45);
    f.rotation.set(Math.sin(a) * 1.0, 0, -Math.cos(a) * 1.0);
    g.add(f);
  }
  g.scale.setScalar(scale);
  return g;
}

export function makeTreeFern(scale = 1) {
  const g = new Group();
  const h = rand(2.4, 3.6);
  g.add(mesh(G.cyl6, mat(0x4a3826), 0.18, h, 0.18, 0, h / 2, 0));
  const top = makeFern(1.8);
  top.position.y = h - 0.3;
  g.add(top);
  g.scale.setScalar(scale);
  return g;
}

export function makeFlowers(scale = 1) {
  const g = new Group();
  const cols = [0xe94f9a, 0xb35ae9, 0xf6c445, 0xff7a5a, 0xffffff];
  const c = mat(pick(cols));
  const c2 = mat(pick(cols));
  for (let i = 0; i < 10; i++) {
    const x = rand(-0.7, 0.7);
    const z = rand(-0.7, 0.7);
    const h = rand(0.3, 0.6);
    g.add(mesh(G.cyl6, mat(0x5b8a2a), 0.015, h, 0.015, x, h / 2, z));
    g.add(mesh(G.sphere, i % 2 ? c : c2, 0.08, 0.06, 0.08, x, h, z));
  }
  g.scale.setScalar(scale);
  return g;
}

/* ============================================================= fauna */
const soft = (c) => mat(c, { flat: false });

export const RegionAnimals = {
  buffalo: () => Animals.buffalo(),

  /** A bottlenose dolphin that leaps out of the sea in long arcs. */
  dolphin() {
    const g = new Group();
    const body = new Group();
    g.add(body);
    const grey = mat(0x6f8796, { flat: false });
    const belly = mat(0xd9e2e6, { flat: false });
    body.add(mesh(G.sphere, grey, 0.32, 0.34, 1.05));
    body.add(mesh(G.sphere, belly, 0.26, 0.24, 0.85, 0, -0.1, -0.05));
    body.add(mesh(G.sphere, grey, 0.13, 0.12, 0.32, 0, -0.03, -1.12));
    const fin = mesh(G.cone4, grey, 0.08, 0.38, 0.22, 0, 0.42, 0.05);
    fin.rotation.x = 0.5;
    body.add(fin);
    for (const s of [-1, 1]) {
      const f = mesh(G.box, grey, 0.28, 0.03, 0.14, s * 0.32, -0.15, -0.35);
      f.rotation.z = s * 0.4;
      body.add(f);
    }
    const tail = mesh(G.box, grey, 0.62, 0.04, 0.2, 0, 0.0, 1.12);
    body.add(tail);
    bakeRigid(body);
    let t = Math.random() * 6;
    const period = rand(2.6, 4.2);
    return {
      root: g,
      update(dt) {
        t += dt;
        // a leap, then a long swim under water
        const k = (t % period) / period;
        const leap = Math.min(1, k / 0.32);
        const up = k < 0.32 ? Math.sin(leap * Math.PI) : -1;
        body.position.set(0, up * 1.8 - 0.6, (0.5 - leap) * 3.5);
        body.rotation.x = k < 0.32 ? (leap - 0.5) * 2.2 : 0;
        body.visible = k < 0.34;
      },
    };
  },

  /** A ghost crab that scuttles sideways across the sand. */
  crab() {
    const g = new Group();
    const shell = mat(pick([0xe8a35a, 0xd98c4a, 0xf0b97a]));
    const body = new Group();
    body.position.y = 0.12;
    g.add(body);
    body.add(mesh(G.sphere, shell, 0.22, 0.09, 0.18));
    for (const s of [-1, 1]) {
      body.add(mesh(G.sphere, mat(0x1a1410), 0.025, 0.025, 0.025, s * 0.06, 0.1, -0.14));
      const claw = mesh(G.sphere, shell, 0.08, 0.05, 0.06, s * 0.2, 0.0, -0.18);
      body.add(claw);
    }
    const legs = [];
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
      const l = mesh(G.box, shell, 0.2, 0.02, 0.02, s * 0.24, -0.04, -0.06 + i * 0.07);
      l.rotation.z = s * -0.5;
      body.add(l);
      legs.push(l);
    }
    let t = Math.random() * 10;
    let dir = Math.random() < 0.5 ? -1 : 1;
    return {
      root: g,
      update(dt) {
        t += dt;
        // dash, stop, dash the other way
        const moving = Math.sin(t * 0.9) > -0.2;
        if (moving) g.position.x += dir * dt * 1.4;
        if (Math.sin(t * 0.45) > 0.98) dir = -dir;
        body.position.y = 0.12 + (moving ? Math.abs(Math.sin(t * 22)) * 0.02 : 0);
        legs.forEach((l, i) => (l.rotation.x = moving ? Math.sin(t * 22 + i) * 0.5 : 0));
      },
    };
  },
  flamingo() {
    const g = new Group();
    const pink = soft(pick([0xf28fa8, 0xf5a3b8, 0xee7f9c]));
    const body = new Group();
    body.position.y = 1.15;
    g.add(body);
    body.add(mesh(G.ball, pink, 0.2, 0.16, 0.32));
    body.add(mesh(G.ball, pink, 0.16, 0.13, 0.18, 0, 0.04, -0.22));
    // folded wing, darker at the flight feathers
    body.add(mesh(G.ball, soft(0xd46a88), 0.08, 0.12, 0.28, 0.14, 0.02, 0.04));
    body.add(mesh(G.ball, soft(0x1a1a1a), 0.05, 0.08, 0.16, 0.12, 0, 0.28));
    const neck = new Group();
    neck.position.set(0, 0.1, -0.28);
    body.add(neck);
    const n1 = mesh(G.cyl16, pink, 0.028, 0.55, 0.028, 0, 0.27, -0.04);
    n1.rotation.x = -0.22;
    neck.add(n1);
    const head = new Group();
    head.position.set(0, 0.54, -0.1);
    neck.add(head);
    head.add(mesh(G.ball, pink, 0.055, 0.05, 0.06));
    const beak = mesh(taper(0.35, 12), soft(0x1a1a1a), 0.028, 0.18, 0.022, 0, -0.02, -0.12);
    beak.rotation.x = Math.PI / 2 + 0.35;
    head.add(beak);
    head.add(mesh(G.ball, soft(0xf4efe6), 0.012, 0.012, 0.01, 0.03, 0.02, -0.04));
    head.add(mesh(G.ball, soft(0x120c08), 0.006, 0.006, 0.006, 0.03, 0.02, -0.048));
    const leg = soft(0xe8708c);
    const stand = mesh(G.cyl16, leg, 0.012, 1.1, 0.012, 0.05, 0.55, 0);
    g.add(stand);
    g.add(mesh(G.ball, leg, 0.02, 0.012, 0.045, 0.05, 0.02, -0.02));
    const tuck = mesh(G.cyl16, leg, 0.012, 0.48, 0.012, -0.05, 0.95, 0.02);
    tuck.rotation.x = 1.15;
    g.add(tuck);
    bakeRigid(g);
    let t = Math.random() * 10;
    return {
      root: g,
      update(dt) {
        t += dt;
        head.rotation.x = Math.sin(t * 1.3) * 0.3;
        neck.rotation.x = Math.sin(t * 0.7) * 0.15;
      },
    };
  },

  hippo: () => Animals.hippo(),

  gorilla(asObstacle = false) {
    const g = new Group();
    const fur = soft(0x2b2826);
    const silver = soft(0x8a8780);
    const face = soft(0x4a3e38);
    const dark = soft(0x1a1614);
    const body = new Group();
    body.position.y = 0.7;
    g.add(body);
    body.add(mesh(G.ball, fur, 0.62, 0.55, 0.48, 0, 0.32, 0.02));
    body.add(mesh(G.ball, silver, 0.48, 0.28, 0.36, 0, 0.48, 0.22));
    body.add(mesh(G.ball, soft(0x3a332e), 0.38, 0.32, 0.22, 0, 0.22, -0.32));
    const head = new Group();
    head.position.set(0, 1.05, -0.12);
    body.add(head);
    head.add(mesh(G.ball, fur, 0.32, 0.34, 0.3, 0, 0.08, 0.02));
    head.add(mesh(G.ball, fur, 0.26, 0.16, 0.24, 0, 0.32, 0.04));
    head.add(mesh(G.ball, face, 0.2, 0.16, 0.14, 0, -0.02, -0.2));
    head.add(mesh(G.ball, face, 0.1, 0.06, 0.1, 0, -0.06, -0.32));
    head.add(mesh(G.ball, dark, 0.16, 0.02, 0.04, 0, -0.12, -0.34));
    for (const x of [-1, 1]) {
      head.add(mesh(G.ball, soft(0xf4efe6), 0.045, 0.032, 0.02, x * 0.1, 0.06, -0.26));
      head.add(mesh(G.ball, soft(0x3b2414), 0.022, 0.022, 0.012, x * 0.1, 0.055, -0.275));
      head.add(mesh(G.ball, dark, 0.01, 0.01, 0.008, x * 0.1, 0.052, -0.284));
      head.add(mesh(G.ball, dark, 0.025, 0.018, 0.02, x * 0.045, -0.02, -0.38));
      head.add(mesh(G.ball, face, 0.08, 0.12, 0.05, x * 0.28, 0.02, 0.02));
    }
    const arms = [];
    for (const x of [-1, 1]) {
      const sh = new Group();
      sh.position.set(x * 0.48, 0.72, -0.02);
      body.add(sh);
      sh.add(mesh(G.ball, fur, 0.18, 0.16, 0.16, 0, 0.02, 0));
      sh.add(mesh(G.cyl16, fur, 0.14, 0.48, 0.15, 0, -0.26, 0.02));
      const elbow = new Group();
      elbow.position.set(0, -0.5, 0.04);
      elbow.rotation.x = 0.45;
      sh.add(elbow);
      elbow.add(mesh(G.cyl16, fur, 0.11, 0.46, 0.12, 0, -0.22, 0));
      elbow.add(mesh(G.ball, face, 0.14, 0.08, 0.18, 0, -0.46, -0.04));
      arms.push({ sh, x });
    }
    for (const x of [-1, 1]) {
      g.add(mesh(G.ball, fur, 0.22, 0.28, 0.26, x * 0.28, 0.42, -0.08));
      g.add(mesh(G.ball, face, 0.12, 0.08, 0.16, x * 0.3, 0.08, -0.18));
    }
    g.add(blobShadow(2.2, 2));
    bakeRigid(g);
    let t = Math.random() * 10;
    let beat = 0;
    return {
      root: g,
      update(dt) {
        t += dt;
        beat = Math.max(0, beat - dt);
        if (beat === 0 && Math.random() < dt * (asObstacle ? 0.7 : 0.15)) beat = 1.2;
        for (const a of arms) {
          if (beat > 0) a.sh.rotation.set(-1.4 + Math.sin(t * 22 + a.x) * 0.25, 0, a.x * 0.6);
          else a.sh.rotation.set(Math.sin(t * 0.8 + a.x) * 0.05, 0, a.x * 0.15);
        }
        head.rotation.y = Math.sin(t * 0.4) * 0.4;
      },
    };
  },

  /** 0 A.D.'s Nile crocodile, with the hand-built one standing in while it loads. */
  croc: () => makeWildAnimal('croc', () => RegionAnimals.crocBuilt()),

  crocBuilt() {
    const g = new Group();
    const skin = soft(0x4f5a2e);
    const belly = soft(0xc4b56a);
    const scale = soft(0x3a4422);
    const body = new Group();
    g.add(body);
    body.add(mesh(G.ball, skin, 0.42, 0.26, 0.85, 0, 0.32, 0.05));
    body.add(mesh(G.ball, belly, 0.32, 0.12, 0.7, 0, 0.16, 0.05));
    for (let i = 0; i < 7; i++) {
      body.add(mesh(G.cone12, scale, 0.05, 0.1, 0.07, 0, 0.56, -0.55 + i * 0.18));
    }
    const tail = new Group();
    tail.position.set(0, 0.28, 0.85);
    body.add(tail);
    const t1 = mesh(taper(0.22, 16), skin, 0.22, 1.35, 0.14, 0, 0.04, 0.62);
    t1.rotation.x = Math.PI / 2;
    tail.add(t1);
    const jaw = new Group();
    jaw.position.set(0, 0.3, -0.72);
    body.add(jaw);
    const upper = new Group();
    jaw.add(upper);
    upper.add(mesh(G.ball, skin, 0.2, 0.1, 0.42, 0, 0.04, -0.38));
    for (const x of [-1, 1]) {
      upper.add(mesh(G.ball, soft(0xf4efe6), 0.045, 0.032, 0.03, x * 0.12, 0.12, -0.08));
      upper.add(mesh(G.ball, soft(0x1a1408), 0.02, 0.02, 0.015, x * 0.12, 0.12, -0.1));
    }
    for (let i = 0; i < 6; i++) {
      const tooth = mesh(G.cone12, soft(0xf4f0e0), 0.018, 0.05, 0.016, i % 2 ? 0.1 : -0.1, -0.02, -0.18 - i * 0.1);
      tooth.rotation.x = Math.PI;
      upper.add(tooth);
    }
    const lower = mesh(G.ball, belly, 0.18, 0.07, 0.38, 0, -0.04, -0.36);
    jaw.add(lower);
    for (const [x, z] of [[-0.32, -0.35], [0.32, -0.35], [-0.34, 0.35], [0.34, 0.35]]) {
      body.add(mesh(G.ball, skin, 0.1, 0.08, 0.16, x, 0.14, z));
    }
    g.add(blobShadow(1.6, 3.2));
    bakeRigid(g);
    let t = Math.random() * 10;
    return {
      root: g,
      update(dt, rate = 1) {
        t += dt * rate;
        upper.rotation.x = -Math.max(0, Math.sin(t * 3)) * 0.6;
        tail.rotation.y = Math.sin(t * 1.6) * 0.3;
      },
    };
  },
};

/* ========================================================== obstacles */
export function makeLogStyled(style) {
  const g = new Group();
  const bark = mat(style === 'palm' ? 0x9a7a55 : style === 'mossy' ? 0x4f3e2c : 0x6b4526);
  const log = mesh(G.cyl, bark, 0.42, 2.3, 0.42, 0, 0.42, 0);
  log.rotation.z = Math.PI / 2;
  g.add(log);
  if (style === 'palm') {
    for (let i = 0; i < 6; i++) {
      const r = mesh(G.cyl, mat(0x7d6142), 0.44, 0.08, 0.44, -1 + i * 0.4, 0.42, 0);
      r.rotation.z = Math.PI / 2;
      g.add(r);
    }
    g.add(turn(mesh(G.box, mat(0x4f8a3a), 0.3, 0.05, 1.6, 1.1, 0.7, 0.3), 'y', 0.6));
  } else if (style === 'mossy') {
    for (let i = 0; i < 6; i++) g.add(mesh(G.ico1, mat(i % 2 ? 0x4f8a3a : 0x6aa845), rand(0.2, 0.35), 0.14, rand(0.2, 0.3), rand(-1, 1), 0.82, rand(-0.2, 0.2)));
    g.add(makeFern(0.6).translateX(0.9).translateY(0.6));
  }
  for (const x of [-1, 1]) {
    const cap = mesh(G.cyl, mat(0xd9b07a), 0.38, 0.04, 0.38, x * 1.16, 0.42, 0);
    cap.rotation.z = Math.PI / 2;
    g.add(cap);
  }
  g.add(blobShadow(2.8, 1.4));
  return g;
}

export function makeGateStyled(style) {
  const g = new Group();
  const wood = mat(style === 'net' ? 0x8a6a42 : 0x4f3e2c);
  for (const x of [-1, 1]) g.add(mesh(G.cyl, wood, 0.1, 3.2, 0.1, x * 1.05, 1.6, 0));
  if (style === 'net') {
    const cord = mat(0xe8dcc0);
    for (let i = 0; i < 5; i++) g.add(mesh(G.box, cord, 2.1, 0.03, 0.03, 0, 1.3 + i * 0.32, 0));
    for (let i = 0; i < 9; i++) g.add(mesh(G.box, cord, 0.03, 1.3, 0.03, -0.96 + i * 0.24, 1.95, 0));
    const floats = [mat(0xff6a3d), mat(0xffd34d)];
    for (let i = 0; i < 6; i++) g.add(mesh(G.sphere, floats[i % 2], 0.09, 0.09, 0.09, -0.85 + i * 0.34, 2.62, 0.04));
    g.add(turn(mesh(G.cyl, wood, 0.06, 2.3, 0.06, 0, 2.62, 0), 'z', Math.PI / 2));
  } else {
    const bough = mesh(taper(0.75), wood, 0.2, 2.5, 0.2, 0, 2.3, 0);
    bough.rotation.z = Math.PI / 2;
    g.add(bough);
    const vine = mat(0x4f7a2e);
    const leaf = [mat(0x5c9a40), mat(0x3f7a32)];
    for (let i = 0; i < 9; i++) {
      const x = -1 + i * 0.25;
      const len = rand(0.7, 1.1);
      g.add(mesh(G.cyl6, vine, 0.03, len, 0.03, x, 2.3 - len / 2, 0.05));
      g.add(mesh(G.ico, leaf[i % 2], 0.14, 0.1, 0.1, x, 2.3 - len, 0.05));
    }
    for (let i = 0; i < 6; i++) g.add(mesh(G.ico1, leaf[i % 2], 0.3, 0.2, 0.25, -1 + i * 0.4, 2.45, 0.02));
    g.add(mesh(G.ico, mat(0xe94f9a), 0.08, 0.08, 0.08, 0.4, 1.4, 0.08));
  }
  g.add(blobShadow(2.6, 0.8));
  return g;
}

export function makeBoulderStyled(style) {
  const g = new Group();
  const cols = style === 'snow' ? [0x7d7f88, 0x8c8e96] : style === 'moss' ? [0x5f5a4e, 0x6a6555] : [0xa08a78, 0x93806e, 0xb09a86];
  const b = mesh(G.dodec, mat(pick(cols)), 1.15, 1.3, 1.1, 0, 1.2, 0);
  b.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
  g.add(b);
  g.add(mesh(G.dodec, mat(pick(cols)), 0.6, 0.5, 0.6, 0.7, 0.4, 0.4));
  if (style === 'snow') g.add(mesh(G.ico1, mat(0xf4f7fb), 1.1, 0.35, 1.05, 0, 2.2, 0));
  if (style === 'moss') for (let i = 0; i < 5; i++) g.add(mesh(G.ico1, mat(i % 2 ? 0x4f8a3a : 0x6aa845), 0.4, 0.15, 0.35, rand(-0.6, 0.6), rand(1.4, 2.3), rand(-0.6, 0.6)));
  g.add(blobShadow(3, 2.6));
  return g;
}

export function makeMoundStyled() {
  const g = makeTermiteMound(1.15);
  g.add(blobShadow(2.6, 2.4));
  return g;
}

export function makeCart() {
  const g = new Group();
  const wood = mat(0x8a5a32);
  g.add(mesh(G.box, wood, 1.9, 0.18, 2.2, 0, 0.85, 0));
  for (const x of [-1, 1]) g.add(mesh(G.box, wood, 0.08, 0.5, 2.2, x * 0.95, 1.15, 0));
  // spice sacks & baskets
  const spice = [0xe4572e, 0xf4a53a, 0xf6d04d, 0x8a3a1e, 0x6a8f3a];
  for (let i = 0; i < 6; i++) {
    const x = -0.55 + (i % 3) * 0.55;
    const z = i < 3 ? -0.5 : 0.5;
    g.add(mesh(G.cyl, mat(0xc9a46a), 0.26, 0.35, 0.26, x, 1.15, z));
    g.add(mesh(G.cone, mat(spice[i % spice.length]), 0.25, 0.3, 0.25, x, 1.45, z));
  }
  // striped awning
  for (const [x, z] of [[-0.9, -1], [0.9, -1], [-0.9, 1], [0.9, 1]]) g.add(mesh(G.cyl6, wood, 0.04, 1.6, 0.04, x, 1.75, z));
  for (let i = 0; i < 5; i++) g.add(mesh(G.box, mat(i % 2 ? 0xffffff : 0xd7263d), 0.4, 0.06, 2.3, -0.8 + i * 0.4, 2.55, 0));
  for (const x of [-1, 1]) {
    const w = mesh(G.cyl, mat(0x4a3420), 0.45, 0.1, 0.45, x * 1.02, 0.45, 0.2);
    w.rotation.z = Math.PI / 2;
    g.add(w);
  }
  g.add(blobShadow(2.8, 3));
  return g;
}

/**
 * A boda-boda: the scooter taxis of Zanzibar's lanes, with a rider in a white kanzu and kofia.
 * Built facing -z like everything else; the game turns it to face the runner.
 */
export function makeScooter() {
  const g = new Group();
  const paint = mat(pick([0xd7263d, 0x1b998b, 0xf4a53a, 0x2e6f9a]), { flat: false });
  const dark = mat(0x22201e);
  const chrome = mat(0xc9c4ba, { flat: false });
  // body: the rounded rear cowl, footboard and the front leg-shield
  g.add(mesh(G.sphere, paint, 0.42, 0.36, 0.62, 0, 0.62, 0.35));
  g.add(mesh(G.box, dark, 0.5, 0.08, 1.0, 0, 0.36, -0.15));
  g.add(turn(mesh(G.box, paint, 0.62, 0.9, 0.12, 0, 0.82, -0.62), 'x', -0.25));
  g.add(mesh(G.box, mat(0x3a2a20), 0.42, 0.12, 0.7, 0, 0.98, 0.28)); // seat
  // handlebar, headlamp, front fork
  g.add(turn(mesh(G.cyl, chrome, 0.03, 0.7, 0.03, 0, 1.32, -0.74), 'z', Math.PI / 2));
  g.add(mesh(G.sphere, basic(0xfff3b0), 0.1, 0.1, 0.06, 0, 1.22, -0.8));
  g.add(turn(mesh(G.cyl, chrome, 0.035, 0.8, 0.035, 0, 0.75, -0.8), 'x', -0.25));
  for (const z of [-0.85, 0.62]) {
    g.add(turn(mesh(G.cyl, dark, 0.27, 0.13, 0.27, 0, 0.27, z), 'z', Math.PI / 2));
    g.add(turn(mesh(G.cyl, chrome, 0.11, 0.14, 0.11, 0, 0.27, z), 'z', Math.PI / 2));
  }
  // the rider: kanzu, embroidered kofia, hands on the bars
  const skin = mat(pick([0x5a3a22, 0x4a2e1a, 0x6b4226]), { flat: false });
  const kanzu = mat(0xf4efe2, { flat: false });
  g.add(mesh(G.cyl, kanzu, 0.22, 0.62, 0.2, 0, 1.36, 0.22));
  g.add(mesh(G.sphere, kanzu, 0.2, 0.14, 0.32, 0, 1.06, 0.05));
  g.add(mesh(G.sphere, skin, 0.13, 0.15, 0.14, 0, 1.82, 0.16));
  g.add(mesh(G.cyl, mat(0xf4efe2), 0.13, 0.09, 0.13, 0, 1.95, 0.16));
  g.add(mesh(G.cyl, mat(0xd7263d), 0.135, 0.02, 0.135, 0, 1.92, 0.16));
  for (const x of [-1, 1]) {
    g.add(turn(mesh(G.cyl, kanzu, 0.05, 0.5, 0.05, x * 0.2, 1.4, -0.28), 'x', 1.1));
    g.add(mesh(G.sphere, skin, 0.05, 0.05, 0.05, x * 0.3, 1.32, -0.72));
  }
  // a crate of fish strapped on the back
  g.add(mesh(G.box, mat(0x8a5a32), 0.46, 0.28, 0.4, 0, 1.12, 0.78));
  g.add(blobShadow(1.2, 2.2));
  return g;
}

/** Boulder that tumbles down onto the trail. `rock` is animated by the game. */
export function makeRockfall(style) {
  const g = new Group();
  const rock = new Group();
  if (style === 'coconut') {
    // a bunch of coconuts, husks and all, with a frond still attached
    const husk = mat(0x6b4a2a, { flat: false });
    const green = mat(0x8fae4a, { flat: false });
    for (const [x, y, z, c] of [[-0.32, 0.26, 0.1, husk], [0.3, 0.26, -0.05, green], [0, 0.26, -0.36, husk], [0.02, 0.62, 0.02, green], [0.1, 0.24, 0.42, husk]]) {
      rock.add(mesh(G.sphere, c, 0.3, 0.27, 0.3, x, y, z));
    }
    rock.add(turn(mesh(G.box, mat(0x5f8a3a), 0.06, 0.05, 1.1, 0.25, 0.75, 0.2), 'y', 0.7));
  } else {
    const b = makeBoulderStyled(style);
    b.children.filter((c) => c.material?.map).forEach((c) => b.remove(c));
    rock.add(b);
  }
  g.add(rock);
  const warn = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.2, 24), basic(0xff4a2a, { transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
  warn.rotation.x = -Math.PI / 2;
  warn.position.y = 0.05;
  g.add(warn);
  const shadow = blobShadow(2.6, 2.4);
  g.add(shadow);
  g.userData.shadow = shadow; // grows as the rock (or coconut) comes down
  g.userData.rock = rock;
  g.userData.warn = warn;
  return g;
}

/** Dhow — the lateen-rigged sailing boats of the Swahili coast (decor on water). */
/* ============================================================== coast */

/** An ngalawa: the Swahili outrigger canoe, with a lateen sail. */
export function makeNgalawa(scale = 1) {
  const g = new Group();
  const wood = mat(pick([0x8a5a32, 0x6b4526, 0x9a6a3a]));
  const hull = mesh(G.sphere, wood, 0.42, 0.32, 2.6, 0, 0.18, 0);
  g.add(hull);
  g.add(mesh(G.box, mat(0x2e6f9a), 0.86, 0.06, 3.6, 0, 0.42, 0)); // painted gunwale
  for (const z of [-0.9, 0.9]) {
    g.add(turn(mesh(G.cyl6, mat(0x5a3a22), 0.05, 3.4, 0.05, 0, 0.5, z), 'z', Math.PI / 2));
    for (const s of [-1, 1]) g.add(mesh(G.sphere, wood, 0.16, 0.12, 1.0, s * 1.6, 0.16, z * 0.15));
  }
  g.add(mesh(G.cyl6, mat(0x5a3a22), 0.05, 3.6, 0.05, 0, 2.1, -0.6));
  const sail = new THREE.Shape();
  sail.moveTo(0, 0);
  sail.lineTo(0, 3.2);
  sail.lineTo(2.4, 0.3);
  sail.lineTo(0, 0);
  const sm = new THREE.Mesh(new THREE.ShapeGeometry(sail), bend(new THREE.MeshLambertMaterial({ color: pick([0xfaf3e0, 0xf3e2c0, 0xe9d3b0]), side: THREE.DoubleSide })));
  sm.position.set(0.04, 0.6, -0.5);
  sm.rotation.y = Math.PI / 2;
  g.add(sm);
  g.scale.setScalar(scale);
  return g;
}

/** A makuti banda: an open beach shelter with a thatched palm-leaf roof and two loungers. */
export function makeBanda(scale = 1) {
  const g = new Group();
  const pole = mat(0x7a5a3a);
  for (const [x, z] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) g.add(mesh(G.cyl6, pole, 0.09, 2.6, 0.09, x, 1.3, z));
  const thatch = mat(0xc9a35a);
  const roof = mesh(G.cone4, thatch, 2.6, 1.6, 2.6, 0, 3.3, 0);
  roof.rotation.y = Math.PI / 4;
  g.add(roof);
  const fringe = mesh(G.cone4, mat(0xb08a42), 2.75, 0.35, 2.75, 0, 2.55, 0);
  fringe.rotation.y = Math.PI / 4;
  g.add(fringe);
  for (const x of [-0.7, 0.7]) {
    g.add(mesh(G.box, mat(0xf2ead8), 0.7, 0.12, 1.7, x, 0.35, 0.2));
    const back = mesh(G.box, mat(0xf2ead8), 0.7, 0.1, 0.6, x, 0.6, -0.75);
    back.rotation.x = 0.8;
    g.add(back);
    g.add(mesh(G.box, mat(pick([0x1b998b, 0xd7263d, 0xf4d35e])), 0.6, 0.04, 1.2, x, 0.43, 0.3));
  }
  g.add(blobShadow(4.5, 4.5));
  g.scale.setScalar(scale);
  return g;
}

/** A thatched beach parasol with a striped kikoi towel beneath. */
export function makeParasol(scale = 1) {
  const g = new Group();
  g.add(mesh(G.cyl6, mat(0x7a5a3a), 0.06, 2.4, 0.06, 0, 1.2, 0));
  g.add(mesh(G.cone, mat(0xc9a35a), 1.5, 0.7, 1.5, 0, 2.5, 0));
  const c = pick([[0xd7263d, 0xf4d35e], [0x1b998b, 0xffffff], [0x2e6f9a, 0xf4d35e]]);
  for (let i = 0; i < 5; i++) g.add(mesh(G.box, mat(c[i % 2]), 0.95, 0.02, 0.36, 0.6, 0.02, -0.72 + i * 0.36));
  g.add(blobShadow(3, 3));
  g.scale.setScalar(scale);
  return g;
}

/** A mangrove: a bushy crown held up on arching stilt roots. */
export function makeMangrove(scale = 1) {
  const g = new Group();
  const bark = mat(0x5a4632);
  g.add(mesh(taper(0.7, 6), bark, 0.18, 1.8, 0.18, 0, 1.9, 0));
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const root = mesh(G.cyl6, bark, 0.05, 1.4, 0.05, Math.cos(a) * 0.45, 0.6, Math.sin(a) * 0.45);
    root.rotation.set(Math.sin(a) * 0.55, 0, -Math.cos(a) * 0.55);
    g.add(root);
  }
  const leaf = mat(pick([0x3f6f34, 0x4a7a3a, 0x356a30]));
  for (let i = 0; i < 6; i++) g.add(mesh(G.ico1, leaf, rand(0.9, 1.3), rand(0.6, 0.85), rand(0.9, 1.3), rand(-0.9, 0.9), 3.1 + rand(-0.2, 0.4), rand(-0.9, 0.9)));
  g.add(blobShadow(3.5, 3.5));
  g.scale.setScalar(scale);
  return g;
}

/** Weathered coral-rag rocks along the tideline. */
export function makeCoralRock(scale = 1) {
  const g = new Group();
  const rock = mat(pick([0xcfc2a2, 0xbfb08e, 0xd8ccb0]));
  for (let i = 0; i < 3; i++) {
    const r = mesh(G.dodec, rock, rand(0.5, 1.1), rand(0.35, 0.7), rand(0.5, 1.0), rand(-0.8, 0.8), 0.25, rand(-0.6, 0.6));
    r.rotation.set(rand(0, 3), rand(0, 3), 0);
    g.add(r);
  }
  for (let i = 0; i < 5; i++) g.add(mesh(G.sphere, mat(0x8f8468), 0.08, 0.05, 0.08, rand(-0.9, 0.9), rand(0.4, 0.7), rand(-0.6, 0.6)));
  g.add(turn(mesh(G.box, mat(0xff8a5c), 0.18, 0.03, 0.18, rand(-1, 1), 0.04, 1.0), 'y', 0.6)); // a starfish
  g.scale.setScalar(scale);
  return g;
}

/** A seaweed farm: rows of stakes and lines in the shallows, as off Paje. */
export function makeSeaweedFarm(scale = 1) {
  const g = new Group();
  const stake = mat(0x7a5a3a);
  const weed = mat(0x6f8f3a);
  for (let r = 0; r < 4; r++) {
    for (let i = 0; i < 6; i++) g.add(mesh(G.cyl6, stake, 0.04, 1.0, 0.04, -3 + i * 1.2, 0.3, r * 1.4));
    g.add(mesh(G.box, mat(0xe9e2d0), 6.2, 0.02, 0.02, 0, 0.55, r * 1.4));
    for (let i = 0; i < 10; i++) g.add(mesh(G.ico, weed, 0.12, 0.1, 0.12, -3 + i * 0.66, 0.5, r * 1.4));
  }
  g.scale.setScalar(scale);
  return g;
}

/** Fish drying on a pole rack, with a net hung beside it. */
export function makeFishRack(scale = 1) {
  const g = new Group();
  const pole = mat(0x7a5a3a);
  for (const x of [-1.1, 1.1]) g.add(mesh(G.cyl6, pole, 0.06, 1.6, 0.06, x, 0.8, 0));
  g.add(turn(mesh(G.cyl6, pole, 0.04, 2.4, 0.04, 0, 1.5, 0), 'z', Math.PI / 2));
  for (let i = 0; i < 7; i++) {
    const f = mesh(G.sphere, mat(0xb9c4c8), 0.06, 0.22, 0.03, -0.9 + i * 0.3, 1.25, 0);
    g.add(f);
  }
  g.add(mesh(G.box, mat(0x3a5a6a, { transparent: true, opacity: 0.6 }), 1.6, 1.2, 0.02, 0, 0.85, 0.6));
  g.add(blobShadow(2.8, 1.8));
  g.scale.setScalar(scale);
  return g;
}

/** A red-and-white lighthouse with a glowing lamp. */
export function makeLighthouse(scale = 1) {
  const g = new Group();
  for (let i = 0; i < 6; i++) g.add(mesh(taper(0.92, 10), mat(i % 2 ? 0xd7263d : 0xf5efe2), 1.3 - i * 0.12, 2, 1.3 - i * 0.12, 0, 1 + i * 2, 0));
  g.add(mesh(G.cyl, mat(0x2a2a2a), 0.75, 0.2, 0.75, 0, 12.1, 0));
  g.add(mesh(G.cyl, basic(0xfff3b0), 0.5, 1.0, 0.5, 0, 12.7, 0));
  g.add(mesh(G.cone, mat(0xd7263d), 0.8, 0.9, 0.8, 0, 13.6, 0));
  g.add(mesh(G.dodec, mat(0xbfb08e), 2.2, 0.8, 2.2, 0, 0.2, 0));
  g.scale.setScalar(scale);
  return g;
}

/** A beached outrigger canoe lying across a lane: an obstacle on Zanzibar's beach. */
export function makeBeachedCanoe() {
  return makeNgalawa(0.72);
}

export function makeDhow(scale = 1) {
  const g = new Group();
  const hull = mat(0x8a5a32);
  g.add(mesh(G.box, hull, 1.6, 0.7, 5, 0, 0.2, 0));
  const bow = mesh(G.cone4, hull, 0.8, 1.6, 0.5, 0, 0.4, -3.1);
  bow.rotation.x = -Math.PI / 2;
  g.add(bow);
  g.add(mesh(G.cyl6, mat(0x5a3a22), 0.07, 5, 0.07, 0, 2.8, -0.4));
  const sail = new THREE.Shape();
  sail.moveTo(0, 0);
  sail.lineTo(0, 4.6);
  sail.lineTo(3.4, 0.4);
  sail.lineTo(0, 0);
  const sm = new THREE.Mesh(new THREE.ShapeGeometry(sail), basic(0xfaf3e0, { side: THREE.DoubleSide }));
  sm.position.set(0.05, 0.9, -0.3);
  sm.rotation.y = Math.PI / 2;
  g.add(sm);
  g.scale.setScalar(scale);
  return g;
}
