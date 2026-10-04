/**
 * Builds the compressed character models in static/models from the CC0
 * Quaternius sources (Ultimate Modular Men + Ultimate Animated Animals,
 * https://quaternius.com). Sources are not kept in the repo; pass their folder:
 *
 *   npm i --no-save @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer
 *   node scripts/build-models.mjs path/to/sources
 *
 * The folder holds adventurer.glb, beach.glb, casual.glb, farmer.glb, hoodie.glb, punk.glb,
 * wolf.gltf, horse.gltf and bull.gltf.
 *
 * Runners ship as skinned meshes without animation; every runner shares one
 * clip file because the rigs are identical. Animals keep only the clips the
 * game plays. Normals are dropped (the game shades them flat) and everything is
 * meshopt-compressed (three's MeshoptDecoder).
 */
import { mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, resample, weld } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';

const SRC = process.argv[2];
if (!SRC) throw new Error('usage: node scripts/build-models.mjs <sources folder>');
const OUT = new URL('../static/models/', import.meta.url).pathname;
mkdirSync(join(OUT, 'runners'), { recursive: true });

await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

// runner id → source character
const RUNNERS = { zuri: 'adventurer', juma: 'beach', neema: 'casual', baraka: 'farmer', amani: 'hoodie', kito: 'punk' };
const RUNNER_CLIPS = ['Run', 'Idle', 'Roll', 'Death', 'Wave', 'HitRecieve'];
// output → [source, clips]
const ANIMALS = {
  hyena: ['wolf.gltf', ['Gallop', 'Idle', 'Walk']],
  zebra: ['horse.gltf', ['Gallop', 'Idle', 'Walk', 'Eating']],
  buffalo: ['bull.gltf', ['Gallop', 'Idle', 'Walk', 'Eating']],
};

const clipName = (a) => a.getName().replace(/^.*\|/, '');

async function build(src, out, { clips = [], meshes = true }) {
  const doc = await io.read(join(SRC, src));
  const root = doc.getRoot();
  for (const a of root.listAnimations()) {
    if (clips.includes(clipName(a))) a.setName(clipName(a));
    else {
      // disposing the animation alone leaves its samplers (and their keyframes) behind
      a.listChannels().forEach((c) => c.dispose());
      a.listSamplers().forEach((sm) => sm.dispose());
      a.dispose();
    }
  }
  // Tracks on helper bones the skin never reads go. A track that holds one value in every
  // kept clip (most of the animals' scale and translation channels) becomes the rest value.
  const joints = new Set(root.listSkins().flatMap((sk) => sk.listJoints()));
  const tracks = new Map();
  for (const a of root.listAnimations()) {
    for (const c of a.listChannels()) {
      const node = c.getTargetNode();
      if (!joints.has(node)) {
        c.getSampler().dispose();
        c.dispose();
        continue;
      }
      const key = `${node.getName()}|${c.getTargetPath()}`;
      if (!tracks.has(key)) tracks.set(key, []);
      tracks.get(key).push(c);
    }
  }
  const SETTERS = { translation: 'setTranslation', rotation: 'setRotation', scale: 'setScale' };
  for (const channels of tracks.values()) {
    const values = channels.map((c) => {
      const out = c.getSampler().getOutput();
      const n = out.getElementSize();
      const v = out.getArray();
      return v.every((x, i) => Math.abs(x - v[i % n]) < 1e-5) ? Array.from(v.slice(0, n)) : null;
    });
    const first = values[0];
    if (!first || !values.every((v) => v && v.every((x, i) => Math.abs(x - first[i]) < 1e-5))) continue;
    const c0 = channels[0];
    c0.getTargetNode()[SETTERS[c0.getTargetPath()]](first);
    for (const c of channels) {
      c.getSampler().dispose();
      c.dispose();
    }
  }
  if (!meshes) {
    for (const n of root.listNodes()) {
      if (n.getMesh()) {
        n.setMesh(null);
        n.setSkin(null);
      }
    }
  }
  // The game draws these flat-shaded (normals come from screen-space derivatives), so
  // dropping normals and vertex colours lets the faceted vertices weld together.
  for (const m of root.listMeshes()) {
    for (const p of m.listPrimitives()) {
      for (const sem of ['NORMAL', 'COLOR_0']) p.getAttribute(sem)?.dispose();
    }
  }
  await doc.transform(
    weld(),
    resample({ tolerance: 1e-4 }),
    prune({ keepLeaves: !meshes }),
    dedup(),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  );
  await io.write(join(OUT, out), doc);
  console.log(out.padEnd(22), (statSync(join(OUT, out)).size / 1024).toFixed(0).padStart(5), 'KB');
}

for (const [id, src] of Object.entries(RUNNERS)) await build(`${src}.glb`, `runners/${id}.glb`, {});
await build('casual.glb', 'runner-clips.glb', { clips: RUNNER_CLIPS, meshes: false });
for (const [id, [src, clips]] of Object.entries(ANIMALS)) await build(src, `${id}.glb`, { clips });
