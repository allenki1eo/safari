import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Environment as DreiEnvironment, Sky } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../../store/gameStore';
import { BIOME_CONFIGS } from '../../utils/constants';
import AnimalNPC from './AnimalNPC';
import { NPC_ANIMALS } from '../../utils/assetManifest';
import { randomItem } from '../../utils/helpers';

// Far background NPCs — static positions, large distance from track
const BG_NPCS = NPC_ANIMALS.length > 0 ? [
  { path: NPC_ANIMALS[0]?.path, x: -25, z: -40, scale: [1.5, 1.5, 1.5], rotY: Math.PI / 4 },
  { path: NPC_ANIMALS[Math.min(1, NPC_ANIMALS.length - 1)]?.path, x: 22, z: -55, scale: [1.3, 1.3, 1.3], rotY: -Math.PI / 6 },
  { path: NPC_ANIMALS[Math.min(2, NPC_ANIMALS.length - 1)]?.path, x: -30, z: -70, scale: [1.2, 1.2, 1.2], rotY: Math.PI / 3 },
].filter(n => n.path) : [];

function BiomeFog({ biome }) {
  const config = BIOME_CONFIGS[biome] || BIOME_CONFIGS.serengeti;
  return <fog attach="fog" args={[config.fogColor, config.fogNear, config.fogFar]} />;
}

function SunLight({ biome }) {
  const config = BIOME_CONFIGS[biome] || BIOME_CONFIGS.serengeti;
  return (
    <>
      <ambientLight intensity={0.5} color={config.ambientColor} />
      <directionalLight
        position={[10, 20, -10]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={0.1}
        shadow-camera-far={100}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />
      <hemisphereLight
        skyColor={config.ambientColor}
        groundColor={config.groundColor || '#333'}
        intensity={0.3}
      />
    </>
  );
}

function GameEnvironment() {
  const currentBiome = useGameStore(s => s.currentBiome);
  const gameState = useGameStore(s => s.gameState);

  return (
    <>
      <BiomeFog biome={currentBiome} />
      <SunLight biome={currentBiome} />

      {/* Distant mountain/skyline mesh for Kilimanjaro */}
      {currentBiome === 'kilimanjaro' && (
        <mesh position={[0, 15, -120]} rotation={[0, 0, 0]}>
          <coneGeometry args={[35, 40, 6]} />
          <meshLambertMaterial color="#8B9BAA" fog={false} />
        </mesh>
      )}

      {/* Ocean plane for Zanzibar */}
      {currentBiome === 'zanzibar' && (
        <mesh position={[40, -0.3, -30]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[80, 200]} />
          <meshLambertMaterial color="#006994" transparent opacity={0.7} />
        </mesh>
      )}

      {/* Background NPC animals */}
      {(gameState === 'playing' || gameState === 'menu') &&
        BG_NPCS.map((npc, i) => (
          <AnimalNPC
            key={i}
            path={npc.path}
            position={[npc.x, 0, npc.z]}
            scale={npc.scale}
            rotationY={npc.rotY}
          />
        ))
      }
    </>
  );
}

export default GameEnvironment;
