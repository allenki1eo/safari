import * as THREE from 'three';
import { bend, mat, mesh, G, bakeRigid, finishProp, streamMaterial } from './materials.js';

/**
 * Rivers that cut through the trail. The ground has a real gap in it: an invisible mask
 * marks the river's footprint in the stencil buffer, and the ground materials (see `cutGround`)
 * skip those pixels, so you look down past muddy walls into deep, racing water. The channel
 * runs well off both sides of the road and fades into reeds, like a river that was here first.
 */
export const WATER_Y = -0.34; // surface, a clear drop below the banks
const WALL_DEPTH = 0.55;
const rand = (a, b) => a + Math.random() * (b - a);

/** Ground materials call this so they leave the river's footprint empty. */
export function cutGround(m) {
  m.stencilWrite = true;
  m.stencilRef = 1;
  m.stencilFunc = THREE.NotEqualStencilFunc;
  m.stencilWriteMask = 0;
  m.stencilZPass = THREE.KeepStencilOp;
  return m;
}

let maskMat;
function holeMask() {
  maskMat ??= bend(
    new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      stencilWrite: true,
      stencilRef: 1,
      stencilFunc: THREE.AlwaysStencilFunc,
      stencilZPass: THREE.ReplaceStencilOp,
    }),
    { key: 'hole' },
  );
  return maskMat;
}

let wallMat;
function bankWall() {
  wallMat ??= bend(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), { key: 'bank' });
  return wallMat;
}

/** A wall of wet earth, dark at the waterline and paler at the top, with a ragged lip. */
function wall(w, segs) {
  const geo = new THREE.PlaneGeometry(w, WALL_DEPTH, segs, 3);
  const pos = geo.attributes.position;
  const col = [];
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i); // -depth/2 .. depth/2
    const k = (y + WALL_DEPTH / 2) / WALL_DEPTH; // 0 bottom → 1 top
    pos.setZ(i, (Math.random() - 0.5) * 0.12 * (1 - k * 0.5)); // knobbly earth
    const c = new THREE.Color().setRGB(0.24 + 0.22 * k, 0.16 + 0.15 * k, 0.1 + 0.08 * k);
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, bankWall());
}

/** Reeds and papyrus where the river leaves the road, so it fades into the bush. */
function reedClump(x, z, scale = 1) {
  const g = new THREE.Group();
  const cols = [0x6f8a3a, 0x8a9a48, 0x5d7a30];
  for (let i = 0; i < 9; i++) {
    const h = rand(0.8, 1.7) * scale;
    const r = mesh(G.cone4, mat(cols[i % 3]), 0.06, h, 0.06, x + rand(-0.6, 0.6), h / 2 - 0.3, z + rand(-0.8, 0.8));
    r.rotation.set(rand(-0.25, 0.25), 0, rand(-0.25, 0.25));
    g.add(r);
    if (i % 3 === 0) g.add(mesh(G.ico, mat(0x9aae52), 0.22 * scale, 0.12 * scale, 0.22 * scale, r.position.x, h - 0.3, r.position.z));
  }
  return g;
}

/**
 * A stretch of river across the trail, `len` metres along the run and `halfX` either side.
 * Local z runs the same way as the world here: the far bank is at -len/2.
 */
export function makeChannel(len, halfX = 11, { color = 0x3b8e93 } = {}) {
  const g = new THREE.Group();
  const zSegs = Math.max(2, Math.ceil(len / 3)); // enough vertices to follow the curved world
  const xSegs = Math.ceil((halfX * 2) / 3);

  const hole = new THREE.Mesh(new THREE.PlaneGeometry(halfX * 2, len, xSegs, zSegs), holeMask());
  hole.rotation.x = -Math.PI / 2;
  hole.position.y = 0.06;
  hole.renderOrder = -1; // before the ground, which then skips these pixels
  hole.userData.keep = true;
  g.add(hole);

  const water = new THREE.Mesh(new THREE.PlaneGeometry(halfX * 2, len, xSegs, zSegs), streamMaterial(color, len / 2));
  water.rotation.x = -Math.PI / 2;
  water.position.y = WATER_Y;
  water.userData.keep = true;
  g.add(water);

  const yMid = -WALL_DEPTH / 2 + 0.04;
  for (const s of [-1, 1]) {
    const bank = wall(halfX * 2, xSegs * 2);
    bank.position.set(0, yMid, s * (len / 2));
    bank.userData.keep = true;
    g.add(bank);
    const side = wall(len, zSegs * 2);
    side.rotation.y = Math.PI / 2;
    side.position.set(s * halfX, yMid, 0);
    side.userData.keep = true;
    g.add(side);
  }

  // muddy lips and pebbles along both banks, reeds where it leaves the road
  const deco = new THREE.Group();
  for (const s of [-1, 1]) {
    deco.add(mesh(G.box, mat(0x4a3322), halfX * 2, 0.06, 0.14, 0, 0.02, s * (len / 2 + 0.05)));
    for (let i = 0; i < Math.ceil(halfX * 0.9); i++) {
      const r = rand(0.1, 0.24);
      deco.add(mesh(G.dodec, mat(i % 2 ? 0x8a8478 : 0x6f6a60), r, r * 0.6, r, rand(-halfX, halfX), 0.06, s * (len / 2 + rand(0.15, 0.6))));
    }
    for (let k = 0; k < Math.max(1, Math.round(len / 5)); k++) {
      deco.add(reedClump(s * (halfX - rand(0.2, 1.2)), rand(-len / 2, len / 2), rand(0.9, 1.3)));
    }
    deco.add(reedClump(s * (halfX + 0.4), -len / 2 - 0.6, 1.2), reedClump(s * (halfX + 0.4), len / 2 + 0.6, 1.2));
  }
  g.add(finishProp(bakeRigid(deco, true)));
  return g;
}

/** A log floating in the river: bark, a few stubs, its top just at bank height to land on. */
export function makeLog(len, width = 1.0) {
  const g = new THREE.Group();
  const r = width * 0.45;
  const log = mesh(G.cyl, mat(0x6b4a2e), r, len, r, 0, -r + 0.06, 0);
  log.rotation.x = Math.PI / 2;
  g.add(log);
  for (const s of [-1, 1]) g.add(mesh(G.cyl, mat(0xb08a5a), r * 0.92, 0.04, r * 0.92, 0, -r + 0.06, s * len / 2).rotateX(Math.PI / 2));
  for (let i = 0; i < 3; i++) {
    const stub = mesh(G.cyl, mat(0x5a3d26), 0.06, 0.4, 0.06, rand(-r, r) * 0.6, 0.0, rand(-len / 2, len / 2) * 0.8);
    stub.rotation.z = rand(-1.2, 1.2);
    g.add(stub);
  }
  // a ring of ripples where it sits in the current
  g.add(mesh(G.box, mat(0xd9eef0), width * 1.15, 0.02, len + 0.4, 0, WATER_Y + 0.02, 0));
  return finishProp(bakeRigid(g, true), { ao: false });
}

/** Flat river rocks huddled into one stepping stone, top at bank height. */
export function makeSteppingRock(len, width = 1.6) {
  const g = new THREE.Group();
  const cols = [0x7d776c, 0x8f887b, 0x6c665c];
  const n = Math.max(2, Math.round(len / 1.4));
  for (let i = 0; i < n; i++) {
    const z = -len / 2 + ((i + 0.5) / n) * len;
    const s = rand(0.75, 0.95);
    const rock = mesh(G.dodec, mat(cols[i % 3]), width * 0.5 * s, 0.7, (len / n) * 0.62, rand(-0.12, 0.12), -0.62, z);
    rock.rotation.y = rand(0, Math.PI);
    g.add(rock);
  }
  g.add(mesh(G.box, mat(0xd9eef0), width * 1.05, 0.02, len + 0.3, 0, WATER_Y + 0.02, 0));
  return finishProp(bakeRigid(g, true), { ao: false });
}

/** A hippo wallowing out in the river: just its back, eyes, ears and nostrils above water. */
function wallowingHippo() {
  const g = new THREE.Group();
  const skin = mat(0x6e5d63);
  const pink = mat(0xb07d82);
  g.add(mesh(G.sphere, skin, 1.0, 0.38, 1.5, 0, WATER_Y, 0)); // back
  g.add(mesh(G.sphere, skin, 0.55, 0.32, 0.6, 0, WATER_Y + 0.08, -1.45)); // head
  g.add(mesh(G.sphere, pink, 0.42, 0.22, 0.32, 0, WATER_Y + 0.03, -1.95)); // snout
  for (const s of [-1, 1]) {
    g.add(mesh(G.sphere, skin, 0.12, 0.12, 0.12, s * 0.3, WATER_Y + 0.32, -1.3)); // eye bumps
    g.add(mesh(G.cone, skin, 0.08, 0.16, 0.06, s * 0.36, WATER_Y + 0.42, -1.12)); // ears
    g.add(mesh(G.sphere, mat(0x2a2024), 0.05, 0.04, 0.05, s * 0.14, WATER_Y + 0.14, -2.18)); // nostrils
  }
  g.add(mesh(G.box, mat(0xd9eef0), 2.2, 0.02, 3.4, 0, WATER_Y + 0.02, -0.5)); // ripple ring
  return g;
}

/**
 * The Great Ruaha crossing: one long channel across the trail with the lanes' logs and
 * stepping stones in it (`rafts`: { lane x, from, to, kind } in metres from the span's middle,
 * along the run), and hippos wallowing out in the river either side.
 */
export function makeRiverSpan(len, rafts, laneX) {
  const g = makeChannel(len, 13, { color: 0x4f8e86 });
  for (const r of rafts) {
    const l = r.to - r.from;
    const piece = r.kind === 'rock' ? makeSteppingRock(l) : makeLog(l);
    piece.position.set(laneX[r.lane], 0, -(r.from + r.to) / 2);
    g.add(piece);
  }
  const parts = new THREE.Group();
  const n = Math.max(2, Math.round(len / 30));
  for (let i = 0; i < n; i++) {
    const h = wallowingHippo();
    const s = i % 2 ? 1 : -1;
    h.position.set(s * rand(6.5, 10.5), 0, rand(-len / 2 + 4, len / 2 - 4));
    h.rotation.y = rand(-0.8, 0.8) + (s > 0 ? Math.PI : 0) * (Math.random() < 0.5 ? 1 : 0);
    parts.add(h);
  }
  g.add(finishProp(bakeRigid(parts, true), { ao: false }));
  return g;
}
