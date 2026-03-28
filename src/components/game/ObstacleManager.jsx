import { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../../store/gameStore';
import { LANES, PLAYER_RADIUS } from '../../utils/constants';
import { randomItem, randomInt, randomInRange } from '../../utils/helpers';
import {
  OBSTACLE_ANIMALS, LARGE_OBSTACLE_ANIMALS,
  MEDIUM_OBSTACLE_ANIMALS, NATURE_OBSTACLES,
} from '../../utils/assetManifest';

const SPAWN_Z  = -62;
const DESPAWN_Z = 14;
const COLLIDE_W = { large: 1.5, medium: 1.0, obstacle: 0.9 };

function ObstacleModel({ path, position, scale }) {
  const { scene, animations } = useGLTF(path);
  const groupRef = useRef();
  const { actions } = useAnimations(animations, groupRef);
  const clone = useMemo(() => scene.clone(true), [scene]);

  useEffect(() => {
    const anim = actions['walk'] || actions['Walk'] || actions['idle']
              || actions['Idle'] || Object.values(actions)[0];
    if (anim) anim.reset().play();
  }, [actions]);

  return (
    <group ref={groupRef} position={position} scale={scale}>
      <primitive object={clone} />
    </group>
  );
}

function buildConfig(biome) {
  const r = Math.random();
  if (r < 0.55 && OBSTACLE_ANIMALS.length > 0) {
    const isLarge = Math.random() < 0.25 && LARGE_OBSTACLE_ANIMALS.length > 0;
    const pool = isLarge ? LARGE_OBSTACLE_ANIMALS
      : (MEDIUM_OBSTACLE_ANIMALS.length > 0 ? MEDIUM_OBSTACLE_ANIMALS : OBSTACLE_ANIMALS);
    const animal = randomItem(pool);
    const size = isLarge ? 'large' : 'medium';
    const lane = isLarge ? randomInt(0, 1) : randomInt(0, 2);
    return { path: animal.path, lane, size, scale: isLarge ? [1.1,1.1,1.1] : [0.75,0.75,0.75] };
  } else if (NATURE_OBSTACLES.length > 0) {
    const biomePool = NATURE_OBSTACLES.filter(n => n.biomes?.includes(biome));
    const pool = biomePool.length > 0 ? biomePool : NATURE_OBSTACLES;
    return { path: randomItem(pool).path, lane: randomInt(0, 2), size: 'obstacle', scale: [1,1,1] };
  }
  return null;
}

function ObstacleManager() {
  const [obstacles, setObstacles] = useState([]);
  const spawnTimer = useRef(0);
  const nextSpawn  = useRef(randomInRange(3, 5.5));
  const gameState  = useGameStore(s => s.gameState);

  // Clear obstacles when leaving play state
  useEffect(() => {
    if (gameState !== 'playing') {
      setObstacles([]);
      spawnTimer.current = 0;
      nextSpawn.current = randomInRange(3, 5.5);
    }
  }, [gameState]);

  useFrame((_, delta) => {
    const { gameState: gs, speed, currentBiome, takeDamage, isInvincible } = useGameStore.getState();
    if (gs !== 'playing') return;
    const dt = Math.min(delta, 0.1);

    setObstacles(prev => {
      let next = prev
        .map(ob => ({ ...ob, z: ob.z + speed * dt }))
        .filter(ob => ob.z < DESPAWN_Z);

      spawnTimer.current += dt;
      if (spawnTimer.current >= nextSpawn.current) {
        spawnTimer.current = 0;
        nextSpawn.current = randomInRange(2.2, 5);
        const cfg = buildConfig(currentBiome);
        if (cfg) {
          const x = LANES[cfg.lane] ?? 0;
          next.push({ id: Date.now() + Math.random(), ...cfg, x, z: SPAWN_Z });
          if (cfg.size === 'large' && cfg.lane < 2) {
            next.push({
              id: Date.now() + Math.random() + 1,
              ...cfg, lane: cfg.lane + 1,
              x: LANES[cfg.lane + 1], z: SPAWN_Z,
            });
          }
        }
      }

      // Collision check using runner X from global
      if (!isInvincible) {
        const rx = window.__runnerX ?? 0;
        for (const ob of next) {
          if (ob.z > -1.0 && ob.z < 2.0) {
            const cw = (COLLIDE_W[ob.size] ?? 0.9) + PLAYER_RADIUS;
            if (Math.abs(ob.x - rx) < cw) {
              takeDamage();
              break;
            }
          }
        }
      }
      return next;
    });
  });

  return (
    <group>
      {obstacles.map(ob => (
        <ObstacleModel
          key={ob.id}
          path={ob.path}
          position={[ob.x, 0, ob.z]}
          scale={ob.scale || [1,1,1]}
        />
      ))}
    </group>
  );
}

export default ObstacleManager;
