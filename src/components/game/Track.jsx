import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../../store/gameStore';
import { TRACK_SEGMENT_LENGTH, TRACK_WIDTH, BIOME_CONFIGS } from '../../utils/constants';
import { GROUND_TEXTURES } from '../../utils/assetManifest';

const POOL_SIZE = 8;
const RECYCLE_Z = 22; // recycle once past camera

// A single track segment mesh (never unmounts, position updated via ref)
function Segment({ innerRef, serengetiTex, zanzibarTex, initialZ, biomeRef }) {
  return (
    <group ref={innerRef} position={[0, -0.05, initialZ]}>
      <SegmentMesh serengetiTex={serengetiTex} zanzibarTex={zanzibarTex} biomeRef={biomeRef} />
    </group>
  );
}

function SegmentMesh({ serengetiTex, zanzibarTex, biomeRef }) {
  // Material ref for live biome updates
  const matRef = useRef();

  useFrame(() => {
    if (!matRef.current || !biomeRef.current) return;
    const biome = biomeRef.current;
    const cfg = BIOME_CONFIGS[biome] || BIOME_CONFIGS.serengeti;
    const tex = biome === 'zanzibar' ? zanzibarTex : serengetiTex;
    if (matRef.current.map !== tex) {
      matRef.current.map = tex;
      matRef.current.color.set(biome === 'kilimanjaro' ? '#9A8A7A' : '#ffffff');
      matRef.current.needsUpdate = true;
    }
  });

  if (serengetiTex) {
    serengetiTex.wrapS = serengetiTex.wrapT = THREE.RepeatWrapping;
    serengetiTex.repeat.set(3, TRACK_SEGMENT_LENGTH / 3);
  }
  if (zanzibarTex) {
    zanzibarTex.wrapS = zanzibarTex.wrapT = THREE.RepeatWrapping;
    zanzibarTex.repeat.set(3, TRACK_SEGMENT_LENGTH / 3);
  }

  return (
    <>
      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[TRACK_WIDTH + 80, TRACK_SEGMENT_LENGTH]} />
        <meshLambertMaterial ref={matRef} map={serengetiTex} />
      </mesh>
      {/* Lane dividers */}
      {[-1.5, 1.5].map((x, i) => (
        <mesh key={i} position={[x, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.07, TRACK_SEGMENT_LENGTH]} />
          <meshBasicMaterial color="#FFFFFF" transparent opacity={0.18} />
        </mesh>
      ))}
    </>
  );
}

function Track() {
  const currentBiome = useGameStore(s => s.currentBiome);
  const biomeRef = useRef(currentBiome);

  // Keep biomeRef up to date without re-rendering track
  useFrame(() => {
    biomeRef.current = useGameStore.getState().currentBiome;
  });

  const serengetiTex = useTexture(GROUND_TEXTURES.serengeti);
  const zanzibarTex = useTexture(GROUND_TEXTURES.zanzibar);

  const segRefs = useRef([]);
  const segZ = useRef(
    Array.from({ length: POOL_SIZE }, (_, i) => -i * TRACK_SEGMENT_LENGTH)
  );

  useFrame((_, delta) => {
    const { speed, gameState } = useGameStore.getState();
    if (gameState !== 'playing') return;
    const dt = Math.min(delta, 0.1);
    const adv = speed * dt;

    // Find min z before advancing (for recycling)
    let minZ = Infinity;
    for (let i = 0; i < POOL_SIZE; i++) if (segZ.current[i] < minZ) minZ = segZ.current[i];

    for (let i = 0; i < POOL_SIZE; i++) {
      segZ.current[i] += adv;
      if (segZ.current[i] > RECYCLE_Z) {
        segZ.current[i] = minZ - TRACK_SEGMENT_LENGTH;
        minZ = segZ.current[i];
      }
      if (segRefs.current[i]) {
        segRefs.current[i].position.z = segZ.current[i];
      }
    }
  });

  return (
    <group>
      {Array.from({ length: POOL_SIZE }, (_, i) => (
        <Segment
          key={i}
          innerRef={el => (segRefs.current[i] = el)}
          serengetiTex={serengetiTex}
          zanzibarTex={zanzibarTex}
          biomeRef={biomeRef}
          initialZ={-i * TRACK_SEGMENT_LENGTH}
        />
      ))}
    </group>
  );
}

export default Track;
