import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Shared "curved world" uniform. Every world material bends vertices downward
 * (and slightly sideways) with distance from the camera, giving the classic
 * rolling-horizon look of lane runners.
 */
export const curve = { value: new THREE.Vector2(0, 0.0016) };

const BEND = /* glsl */ `
  float bendD = max(-mvPosition.z, 0.0);
  bendD *= bendD;
  mvPosition.x += uCurve.x * bendD;
  mvPosition.y -= uCurve.y * bendD;
  gl_Position = projectionMatrix * mvPosition;
`;

export function bend(material) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uCurve = curve;
    shader.vertexShader =
      'uniform vec2 uCurve;\n' +
      shader.vertexShader.replace(
        '#include project_vertex',
        THREE.ShaderChunk.project_vertex.replace('gl_Position = projectionMatrix * mvPosition;', BEND),
      );
  };
  material.customProgramCacheKey = () => 'bend';
  return material;
}

const matCache = new Map();

/** Flat-shaded, curved, cached lambert material. */
export function mat(color, opts = {}) {
  const key = `${color}|${opts.emissive ?? ''}|${opts.transparent ? opts.opacity : ''}|${opts.flat === false ? 's' : 'f'}`;
  let m = matCache.get(key);
  if (!m) {
    m = bend(
      new THREE.MeshLambertMaterial({
        color,
        flatShading: opts.flat !== false,
        emissive: opts.emissive ?? 0x000000,
        transparent: !!opts.transparent,
        opacity: opts.opacity ?? 1,
        depthWrite: opts.transparent ? false : true,
      }),
    );
    m.userData.bakeable = !opts.emissive && !opts.transparent;
    matCache.set(key, m);
  }
  return m;
}

/** One shared vertex-coloured material: every rigid part bakes into a single draw call. */
let vcMat;
export function vertexColorMat() {
  vcMat ??= bend(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  return vcMat;
}

/** Unlit curved material (glows, shadows, decals). */
export function basic(color, opts = {}) {
  return bend(
    new THREE.MeshBasicMaterial({
      color,
      transparent: opts.transparent ?? false,
      opacity: opts.opacity ?? 1,
      depthWrite: opts.depthWrite ?? !opts.transparent,
      blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      map: opts.map ?? null,
      side: opts.side ?? THREE.FrontSide,
      fog: opts.fog ?? true,
      vertexColors: !!opts.vertexColors,
    }),
  );
}

// ---- Unit geometries, scaled per mesh -------------------------------------------------
export const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  ico: new THREE.IcosahedronGeometry(1, 0),
  ico1: new THREE.IcosahedronGeometry(1, 1),
  sphere: new THREE.SphereGeometry(1, 10, 8),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 8),
  cyl6: new THREE.CylinderGeometry(1, 1, 1, 6),
  cone: new THREE.ConeGeometry(1, 1, 7),
  cone4: new THREE.ConeGeometry(1, 1, 4),
  dodec: new THREE.DodecahedronGeometry(1, 0),
};

/** Tapered cylinder geometry cache (top radius ratio). */
const taperCache = new Map();
export function taper(ratio, seg = 7) {
  const k = `${ratio}|${seg}`;
  if (!taperCache.has(k)) taperCache.set(k, new THREE.CylinderGeometry(ratio, 1, 1, seg));
  return taperCache.get(k);
}

export function mesh(geo, material, sx = 1, sy = 1, sz = 1, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  return m;
}

/** Soft round blob shadow texture. */
let shadowTex;
export function shadowTexture() {
  if (shadowTex) return shadowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  grd.addColorStop(0, 'rgba(40,20,5,0.55)');
  grd.addColorStop(0.6, 'rgba(40,20,5,0.25)');
  grd.addColorStop(1, 'rgba(40,20,5,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  shadowTex = new THREE.CanvasTexture(c);
  return shadowTex;
}

let shadowMat;
export function blobShadow(w = 1, d = 1) {
  shadowMat ??= basic(0xffffff, { map: shadowTexture(), transparent: true, depthWrite: false });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shadowMat);
  m.rotation.x = -Math.PI / 2;
  m.scale.set(w, d, 1);
  m.position.y = 0.03;
  m.renderOrder = 1;
  return m;
}

/** Renders an emoji to a texture — used for ally totems and floating icons. */
const emojiCache = new Map();
export function emojiTexture(emoji, ring = '#ffd34d') {
  const key = emoji + ring;
  if (emojiCache.has(key)) return emojiCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 10, 64, 64, 62);
  grd.addColorStop(0, 'rgba(255,250,220,1)');
  grd.addColorStop(0.7, ring);
  grd.addColorStop(1, 'rgba(255,160,40,0)');
  g.fillStyle = grd;
  g.beginPath();
  g.arc(64, 64, 62, 0, Math.PI * 2);
  g.fill();
  g.font = '72px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(emoji, 64, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  emojiCache.set(key, t);
  return t;
}

/**
 * Merges the direct mesh children of every group in `root` by material.
 * Hierarchy (and therefore animation pivots) is preserved, but a 40-piece
 * low-poly animal drops from ~40 draw calls to a handful.
 */
export function bakeRigid(root, deep = false) {
  if (deep) flatten(root);
  const groups = [];
  root.traverse((o) => {
    if (!o.isMesh && !o.isPoints) groups.push(o);
  });
  for (const node of groups) {
    const buckets = new Map();
    for (const c of node.children) {
      if (!c.isMesh || c.isInstancedMesh || c.children.length || c.userData.keep) continue;
      const key = c.material.userData?.bakeable ? 'vc' : c.material;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(c);
    }
    for (const [key, list] of buckets) {
      if (list.length < 2) continue;
      const vc = key === 'vc';
      const material = vc ? vertexColorMat() : key;
      const keepUv = !!material.map;
      const geos = list.map((m) => {
        m.updateMatrix();
        const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
        for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && !(keepUv && k === 'uv')) g.deleteAttribute(k);
        if (vc) {
          const { r, g: gg, b } = m.material.color;
          const n = g.attributes.position.count;
          const col = new Float32Array(n * 3);
          for (let i = 0; i < n; i++) col.set([r, gg, b], i * 3);
          g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        }
        g.applyMatrix4(m.matrix);
        return g;
      });
      const merged = mergeGeometries(geos);
      geos.forEach((g) => g.dispose());
      if (!merged) continue;
      const mm = new THREE.Mesh(merged, material);
      mm.renderOrder = list[0].renderOrder;
      list.forEach((m) => node.remove(m));
      node.add(mm);
    }
  }
  return root;
}

/** Re-parents every nested mesh directly under `root`, preserving its transform. */
function flatten(root) {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert();
  const meshes = [];
  root.traverse((o) => {
    if (o.isMesh && o.parent !== root && !o.children.length) meshes.push(o);
  });
  const m4 = new THREE.Matrix4();
  for (const m of meshes) {
    m4.multiplyMatrices(inv, m.matrixWorld);
    m.parent.remove(m);
    m4.decompose(m.position, m.quaternion, m.scale);
    root.add(m);
  }
  for (const c of [...root.children]) if (c.isGroup && !c.children.length) root.remove(c);
}
