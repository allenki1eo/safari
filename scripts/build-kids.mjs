/**
 * Builds the runners' character models in static/models from CC0 Quaternius sources:
 * Universal Base Characters (bodies, eyes, brows, hair) and Universal Animation Library 1 + 2
 * (clips). Both use the same 65-bone skeleton, so clips and hair drop straight onto the bodies.
 *
 *   npm i --no-save @gltf-transform/core @gltf-transform/functions @gltf-transform/extensions meshoptimizer sharp
 *   node scripts/build-kids.mjs path/to/sources
 *
 * The sources folder holds quaternius_UBC/ (the .gltf files and textures) and
 * quaternius_UAL/UAL1_Standard.glb, quaternius_UAL2/UAL2_Standard.glb.
 *
 * Output: kid-male.glb and kid-female.glb (skinned body with hair variants, 512px WebP
 * textures, no clips) and kid-clips.glb (the clips the game plays, on a bare skeleton).
 * Everything is meshopt-compressed.
 */
import { statSync } from 'node:fs';
import { join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, EXTTextureWebP, KHRMeshQuantization } from '@gltf-transform/extensions';
import { dedup, meshopt, mergeDocuments, prune, resample, textureCompress, unpartition } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';

const SRC = process.argv[2];
if (!SRC) throw new Error('usage: node scripts/build-kids.mjs <sources folder>');
const OUT = new URL('../static/models/', import.meta.url).pathname;

await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions([EXTMeshoptCompression, KHRMeshQuantization, EXTTextureWebP])
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

const UBC = join(SRC, 'quaternius_UBC');
const BODIES = {
  male: { file: 'Superhero_Male_FullBody.gltf', hair: ['Hair_Buzzed'] },
  female: { file: 'Superhero_Female_FullBody.gltf', hair: ['Hair_BuzzedFemale', 'Hair_Buns'] },
};
// game state -> clip; see app/game/people.js
const CLIPS = [
  'Idle_Loop', 'Sprint_Loop', 'Jog_Fwd_Loop', 'Jump_Start', 'Jump_Loop', 'Jump_Land', 'NinjaJump_Start', 'NinjaJump_Idle_Loop',
  'Slide_Start', 'Slide_Loop', 'Slide_Exit', 'Roll', 'Death01', 'Hit_Chest', 'Driving_Loop', 'Dance_Loop', 'Yes', 'Swim_Idle_Loop',
];

const size = (f) => `${(statSync(join(OUT, f)).size / 1024).toFixed(0)} KB`;

/** Moves a hair mesh (rigged to its own copy of the skeleton) onto the body's skeleton. */
async function addHair(doc, name) {
  const root = doc.getRoot();
  const bones = new Map(root.listNodes().map((n) => [n.getName(), n]));
  const scene = root.listScenes()[0];
  const hair = await io.read(join(UBC, `${name}.gltf`));
  const before = new Set(root.listNodes());
  mergeDocuments(doc, hair);
  const added = root.listNodes().filter((n) => !before.has(n));
  const meshNode = added.find((n) => n.getMesh());
  const skin = meshNode.getSkin();
  const joints = skin.listJoints();
  for (const j of joints) skin.removeJoint(j);
  for (const j of joints) skin.addJoint(bones.get(j.getName()));
  skin.setSkeleton(bones.get('root') ?? null);
  meshNode.setName(name);
  meshNode.getParentNode()?.removeChild(meshNode);
  scene.addChild(meshNode);
  for (const n of added) if (n !== meshNode) n.dispose();
  for (const s of root.listScenes()) if (s !== scene) s.dispose();
}

for (const [id, { file, hair }] of Object.entries(BODIES)) {
  const doc = await io.read(join(UBC, file));
  for (const h of hair) await addHair(doc, h);
  for (const m of doc.getRoot().listMaterials()) {
    // roughness comes from a constant (and the outfit shader); one less texture to ship
    m.getMetallicRoughnessTexture()?.dispose();
    m.setMetallicRoughnessTexture(null).setRoughnessFactor(0.7).setMetallicFactor(0);
  }
  await doc.transform(
    unpartition(), // the merged hair brought its own buffers
    dedup(),
    prune(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [512, 512], quality: 82 }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  );
  await io.write(join(OUT, `kid-${id}.glb`), doc);
  console.log(`kid-${id}.glb`, size(`kid-${id}.glb`));
}

// clips: the male skeleton with every mesh removed, plus the clips copied over by bone name
const clips = await io.read(join(UBC, BODIES.male.file));
const cr = clips.getRoot();
for (const n of cr.listNodes()) {
  if (n.getMesh()) {
    n.setMesh(null);
    n.setSkin(null);
  }
}
const byName = new Map(cr.listNodes().map((n) => [n.getName(), n]));
const buf = cr.listBuffers()[0];
const want = new Set(CLIPS);
for (const lib of ['quaternius_UAL/UAL1_Standard.glb', 'quaternius_UAL2/UAL2_Standard.glb']) {
  const ld = await io.read(join(SRC, lib));
  for (const a of ld.getRoot().listAnimations()) {
    if (!want.has(a.getName())) continue;
    want.delete(a.getName());
    const na = clips.createAnimation(a.getName());
    for (const ch of a.listChannels()) {
      const target = byName.get(ch.getTargetNode().getName());
      if (!target) continue;
      const s = ch.getSampler();
      const copy = (acc) => clips.createAccessor().setType(acc.getType()).setArray(acc.getArray().slice()).setBuffer(buf);
      const ns = clips.createAnimationSampler().setInput(copy(s.getInput())).setOutput(copy(s.getOutput())).setInterpolation(s.getInterpolation());
      na.addSampler(ns).addChannel(clips.createAnimationChannel().setTargetNode(target).setTargetPath(ch.getTargetPath()).setSampler(ns));
    }
  }
}
if (want.size) console.error('missing clips:', [...want]);
await clips.transform(resample({ tolerance: 1e-4 }), prune({ keepLeaves: true }), dedup(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(join(OUT, 'kid-clips.glb'), clips);
console.log('kid-clips.glb', size('kid-clips.glb'));
