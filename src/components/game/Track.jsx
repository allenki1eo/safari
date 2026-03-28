import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../../store/gameStore';
import {
  TRACK_SEGMENT_LENGTH, TRACK_WIDTH, SEGMENTS_AHEAD,
  BIOME_CONFIGS,
} from '../../utils/constants';
import { GROUND_TEXTURES } from '../../utils/assetManifest';

const POOL_SIZE = SEGMENTS_AHEAD + 3;

// Segment types for variety
const SEGMENT_TYPES = ['plains', 'plains', 'plains', 'rocky', 'coastal'];

function createSegmentData(index, biome, random) {
  return {
    index,
    biome,
    type: SEGMENT_TYPES[Math.floor(random() * SEGMENT_TYPES.length)],
    zPosition: -index * TRACK_SEGMENT_LENGTH,
  };
}

function TrackSegment({ zPos, biome, textureMap }) {
  const config = BIOME_CONFIGS[biome] || BIOME_CONFIGS.serengeti;
  const texture = textureMap[biome];

  if (texture) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3, TRACK_SEGMENT_LENGTH / 3);
  }

  return (
    <group position={[0, -0.05, zPos]}>
      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[TRACK_WIDTH + 60, TRACK_SEGMENT_LENGTH]} />
        <meshLambertMaterial
          map={texture || null}
          color={texture ? '#ffffff' : config.groundColor}
        />
      </mesh>
      {/* Lane dividers (subtle) */}
      {[-1.5, 1.5].map((x, i) => (
        <mesh key={i} position={[x, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.05, TRACK_SEGMENT_LENGTH]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.1} />
        </mesh>
      ))}
    </group>
  );
}

function Track({ runnerZRef }) {
  const currentBiome = useGameStore(s => s.currentBiome);
  const gameState = useGameStore(s => s.gameState);
  const segmentsRef = useRef([]);
  const nextIndexRef = useRef(0);
  const worldZRef = useRef(0);

  // Load both textures
  const serengetiTex = useTexture(GROUND_TEXTURES.serengeti);
  const zanzibarTex = useTexture(GROUND_TEXTURES.zanzibar);
  const textureMap = {
    serengeti: serengetiTex,
    kilimanjaro: serengetiTex, // reused with color tint
    zanzibar: zanzibarTex,
  };

  // Initialize segment pool
  useEffect(() => {
    segmentsRef.current = Array.from({ length: POOL_SIZE }, (_, i) => ({
      id: i,
      zPos: -i * TRACK_SEGMENT_LENGTH,
      biome: 'serengeti',
      active: i < SEGMENTS_AHEAD,
    }));
    nextIndexRef.current = POOL_SIZE;
  }, []);

  useFrame((state, delta) => {
    if (gameState !== 'playing') return;
    const { speed } = useGameStore.getState();
    const dt = Math.min(delta, 0.1);

    // Advance world Z (track scrolls toward camera = negative Z moves)
    worldZRef.current += speed * dt;

    // Move all segments forward
    segmentsRef.current = segmentsRef.current.map(seg => ({
      ...seg,
      zPos: seg.zPos + speed * dt,
    }));

    // Recycle segments that have passed the camera
    const recycleThreshold = TRACK_SEGMENT_LENGTH * 2;
    segmentsRef.current = segmentsRef.current.map(seg => {
      if (seg.zPos > recycleThreshold) {
        // Move to front
        const frontZ = Math.min(...segmentsRef.current.map(s => s.zPos)) - TRACK_SEGMENT_LENGTH;
        return { ...seg, zPos: frontZ, biome: currentBiome };
      }
      return seg;
    });
  });

  return (
    <group>
      {segmentsRef.current.map(seg => (
        <TrackSegment
          key={seg.id}
          zPos={seg.zPos}
          biome={seg.biome}
          textureMap={textureMap}
        />
      ))}
    </group>
  );
}

export default Track;
