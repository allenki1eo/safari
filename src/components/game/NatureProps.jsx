import { useRef, useMemo, useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../store/gameStore';
import { NATURE_SCENERY } from '../../utils/assetManifest';
import { TRACK_WIDTH } from '../../utils/constants';
import { seededRandom } from '../../utils/helpers';

const NUM_PROPS = 24;
const RECYCLE_Z = 22;
const SIDE_MIN = TRACK_WIDTH / 2 + 2;   // 6.5
const SIDE_MAX = TRACK_WIDTH / 2 + 20;  // 24.5

// One static nature prop — position updated via innerRef
function NatureProp({ innerRef, path, initialZ, x, scale, rotY }) {
  const { scene } = useGLTF(path);
  const clone = useMemo(() => scene.clone(true), [scene]);

  return (
    <group ref={innerRef} position={[x, 0, initialZ]} rotation={[0, rotY, 0]}>
      <primitive object={clone} scale={[scale, scale, scale]} />
    </group>
  );
}

function NatureProps() {
  const currentBiome = useGameStore(s => s.currentBiome);
  const gameState = useGameStore(s => s.gameState);

  // Pick biome-appropriate props (memo'd on biome change)
  const propDefs = useMemo(() => {
    const available = NATURE_SCENERY.filter(n =>
      !n.biomes || n.biomes.includes(currentBiome)
    );
    const pool = available.length >= 4 ? available : NATURE_SCENERY;
    const rng = seededRandom(99);
    return Array.from({ length: NUM_PROPS }, (_, i) => {
      const def = pool[Math.floor(rng() * pool.length)];
      const side = rng() > 0.5 ? 1 : -1;
      const x = side * (SIDE_MIN + rng() * (SIDE_MAX - SIDE_MIN));
      const z = -(i * (90 / NUM_PROPS) + rng() * 3 + 1);
      const scale = 0.6 + rng() * 0.9;
      const rotY = rng() * Math.PI * 2;
      return { id: i, path: def.path, x, z, scale, rotY };
    });
  }, [currentBiome]);

  const propRefs = useRef([]);
  const propZ = useRef(propDefs.map(p => p.z));

  // Sync positions when propDefs change
  useEffect(() => {
    propZ.current = propDefs.map(p => p.z);
    propRefs.current.forEach((r, i) => {
      if (r) r.position.z = propZ.current[i];
    });
  }, [propDefs]);

  useFrame((_, delta) => {
    if (gameState !== 'playing') return;
    const { speed } = useGameStore.getState();
    const dt = Math.min(delta, 0.1);
    const adv = speed * dt;

    let minZ = Infinity;
    for (let i = 0; i < propZ.current.length; i++) {
      if (propZ.current[i] < minZ) minZ = propZ.current[i];
    }

    for (let i = 0; i < propZ.current.length; i++) {
      propZ.current[i] += adv;
      if (propZ.current[i] > RECYCLE_Z) {
        propZ.current[i] = minZ - (90 / NUM_PROPS);
        minZ = propZ.current[i];
      }
      if (propRefs.current[i]) {
        propRefs.current[i].position.z = propZ.current[i];
      }
    }
  });

  if (propDefs.length === 0) return null;

  return (
    <group>
      {propDefs.map((def, i) => (
        <NatureProp
          key={`${def.path}-${i}`}
          innerRef={el => (propRefs.current[i] = el)}
          path={def.path}
          initialZ={def.z}
          x={def.x}
          scale={def.scale}
          rotY={def.rotY}
        />
      ))}
    </group>
  );
}

export default NatureProps;
