import { useRef, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../store/gameStore';
import { NATURE_SCENERY } from '../../utils/assetManifest';
import { TRACK_WIDTH, TRACK_SEGMENT_LENGTH, BIOME_CONFIGS } from '../../utils/constants';
import { randomInRange, seededRandom } from '../../utils/helpers';

// Scenery spawns per side
const SIDE_PROPS_PER_SEGMENT = 6;
const SIDE_MIN_X = TRACK_WIDTH / 2 + 1.5;
const SIDE_MAX_X = TRACK_WIDTH / 2 + 18;
const SCENERY_SPAWN_Z = -80;
const SCENERY_DESPAWN_Z = 20;

// A single nature model loaded once and reused
function NatureProp({ path, position, scale, rotY }) {
  const { scene } = useGLTF(path);
  const clone = useMemo(() => scene.clone(true), [scene]);

  return (
    <group position={position} rotation={[0, rotY, 0]} scale={scale}>
      <primitive object={clone} />
    </group>
  );
}

// Manages a pool of scenery props that scroll with the track
function NatureProps() {
  const currentBiome = useGameStore(s => s.currentBiome);
  const gameState = useGameStore(s => s.gameState);

  // Select a curated set of nature props for the current biome
  const biomeProps = useMemo(() => {
    const available = NATURE_SCENERY.filter(n =>
      !n.biomes || n.biomes.includes(currentBiome)
    );
    return available.length > 0 ? available.slice(0, 8) : NATURE_SCENERY.slice(0, 4);
  }, [currentBiome]);

  // Generate a static set of prop instances with pre-baked positions
  const propInstances = useMemo(() => {
    if (biomeProps.length === 0) return [];
    const rng = seededRandom(42);
    const instances = [];
    const numSegments = 12; // covers visible range

    for (let seg = 0; seg < numSegments; seg++) {
      for (let i = 0; i < SIDE_PROPS_PER_SEGMENT; i++) {
        const propDef = biomeProps[Math.floor(rng() * biomeProps.length)];
        const side = rng() > 0.5 ? 1 : -1;
        const x = side * (SIDE_MIN_X + rng() * (SIDE_MAX_X - SIDE_MIN_X));
        const z = SCENERY_SPAWN_Z + seg * (TRACK_SEGMENT_LENGTH / 2) + rng() * TRACK_SEGMENT_LENGTH;
        const scaleBase = 0.7 + rng() * 0.6;
        instances.push({
          id: `${seg}-${i}`,
          path: propDef.path,
          x,
          z,
          scale: [scaleBase, scaleBase, scaleBase],
          rotY: rng() * Math.PI * 2,
        });
      }
    }
    return instances;
  }, [biomeProps]);

  // Scroll props
  const propsRef = useRef(propInstances.map(p => ({ ...p })));
  const speedRef = useRef(0);

  useFrame((_, delta) => {
    if (gameState !== 'playing') return;
    const { speed } = useGameStore.getState();
    speedRef.current = speed;
    const dt = Math.min(delta, 0.1);

    propsRef.current = propsRef.current.map(p => {
      let newZ = p.z + speed * dt;
      if (newZ > SCENERY_DESPAWN_Z) {
        // Teleport to back
        newZ = SCENERY_SPAWN_Z - (newZ - SCENERY_DESPAWN_Z);
      }
      return { ...p, z: newZ };
    });
  });

  if (gameState === 'loading' || biomeProps.length === 0) return null;

  return (
    <group>
      {propsRef.current.map(prop => (
        <NatureProp
          key={prop.id}
          path={prop.path}
          position={[prop.x, 0, prop.z]}
          scale={prop.scale}
          rotY={prop.rotY}
        />
      ))}
    </group>
  );
}

export default NatureProps;
