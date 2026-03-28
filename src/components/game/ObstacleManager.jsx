import { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../../store/gameStore';
import {
  LANES, LANE_WIDTH, TRACK_SEGMENT_LENGTH,
  PLAYER_HEIGHT, PLAYER_RADIUS, SLIDE_HEIGHT,
  OBSTACLE_SPAWN_MIN_DISTANCE, OBSTACLE_SPAWN_MAX_DISTANCE,
} from '../../utils/constants';
import { randomItem, randomInt, randomInRange } from '../../utils/helpers';
import { OBSTACLE_ANIMALS, LARGE_OBSTACLE_ANIMALS, MEDIUM_OBSTACLE_ANIMALS, NATURE_OBSTACLES } from '../../utils/assetManifest';

const POOL_SIZE = 8;
const SPAWN_Z = -60;
const DESPAWN_Z = 15;

// Obstacle sizes for collision
const OBSTACLE_SIZES = {
  large: { width: 1.8, height: 2.0, blockedLanes: 2 },
  medium: { width: 1.2, height: 1.6, blockedLanes: 1 },
  obstacle: { width: 1.0, height: 1.2, blockedLanes: 1 }, // nature obstacles
};

function ObstacleModel({ path, position, scale, onRef }) {
  const { scene, animations } = useGLTF(path);
  const groupRef = useRef();
  const { actions } = useAnimations(animations, groupRef);

  useEffect(() => {
    if (onRef) onRef(groupRef);
    // Play idle/walk animation
    const anim = actions['walk'] || actions['Walk'] || actions['idle'] || actions['Idle'] || Object.values(actions)[0];
    if (anim) anim.reset().play();
  }, [actions]);

  const clone = scene.clone(true);

  return (
    <group ref={groupRef} position={position} scale={scale}>
      <primitive object={clone} />
    </group>
  );
}

function generateObstacleConfig(biome) {
  const r = Math.random();

  if (r < 0.5 && OBSTACLE_ANIMALS.length > 0) {
    // Animal obstacle
    const isLarge = Math.random() < 0.3 && LARGE_OBSTACLE_ANIMALS.length > 0;
    const pool = isLarge ? LARGE_OBSTACLE_ANIMALS : MEDIUM_OBSTACLE_ANIMALS;
    const animal = randomItem(pool.length > 0 ? pool : OBSTACLE_ANIMALS);
    const size = isLarge ? 'large' : 'medium';
    const sizeConfig = OBSTACLE_SIZES[size];

    // For large obstacles, pick a starting lane that blocks 2 lanes
    let lane;
    if (sizeConfig.blockedLanes === 2) {
      lane = randomInt(0, 1); // left or center start (blocks 2 lanes)
    } else {
      lane = randomInt(0, 2);
    }

    return {
      path: animal.path,
      lane,
      size,
      blockedLanes: sizeConfig.blockedLanes,
      scale: size === 'large' ? [1.2, 1.2, 1.2] : [0.8, 0.8, 0.8],
      colliderHeight: sizeConfig.height,
      colliderRadius: sizeConfig.width / 2,
    };
  } else if (NATURE_OBSTACLES.length > 0) {
    // Nature obstacle
    const natureBiomeObs = NATURE_OBSTACLES.filter(n => n.biomes?.includes(biome));
    const pool = natureBiomeObs.length > 0 ? natureBiomeObs : NATURE_OBSTACLES;
    const nature = randomItem(pool);
    const lane = randomInt(0, 2);

    return {
      path: nature.path,
      lane,
      size: 'obstacle',
      blockedLanes: 1,
      scale: [1, 1, 1],
      colliderHeight: 1.2,
      colliderRadius: 0.5,
    };
  }

  return null;
}

function useObstaclePool(size) {
  const [pool, setPool] = useState(() =>
    Array.from({ length: size }, (_, i) => ({
      id: i,
      active: false,
      path: null,
      x: 0,
      z: SPAWN_Z,
      config: null,
    }))
  );
  return [pool, setPool];
}

function ObstacleManager({ runnerRef }) {
  const [obstacles, setObstacles] = useState([]);
  const spawnTimerRef = useRef(0);
  const worldZRef = useRef(0);
  const nextSpawnIntervalRef = useRef(randomInRange(3, 5));

  const { gameState, currentBiome, takeDamage, isInvincible } = useGameStore(s => ({
    gameState: s.gameState,
    currentBiome: s.currentBiome,
    takeDamage: s.takeDamage,
    isInvincible: s.isInvincible,
  }));

  const obstaclesRef = useRef(obstacles);
  useEffect(() => { obstaclesRef.current = obstacles; }, [obstacles]);

  useFrame((state, delta) => {
    if (gameState !== 'playing') return;
    const { speed, isInvincible: inv } = useGameStore.getState();
    const dt = Math.min(delta, 0.1);

    // Advance obstacles
    setObstacles(prev => {
      const next = prev
        .map(ob => ob.active ? { ...ob, z: ob.z + speed * dt } : ob)
        .filter(ob => !ob.active || ob.z < DESPAWN_Z);

      // Spawn timer
      spawnTimerRef.current += dt;
      if (spawnTimerRef.current >= nextSpawnIntervalRef.current) {
        spawnTimerRef.current = 0;
        nextSpawnIntervalRef.current = randomInRange(2.5, 5);

        const config = generateObstacleConfig(currentBiome);
        if (config) {
          next.push({
            id: Date.now() + Math.random(),
            active: true,
            ...config,
            z: SPAWN_Z,
            x: LANES[config.lane],
          });
          // If 2-lane blocker, add second lane mesh
          if (config.blockedLanes === 2) {
            next.push({
              id: Date.now() + Math.random() + 1,
              active: true,
              ...config,
              lane: config.lane + 1,
              z: SPAWN_Z,
              x: LANES[Math.min(config.lane + 1, 2)],
            });
          }
        }
      }

      // Collision detection
      if (!inv) {
        const runnerX = runnerRef?.current?.position?.x ?? 0;
        const runnerY = runnerRef?.current?.position?.y ?? 0;
        const isSliding = false; // TODO: read from runner state

        for (const ob of next) {
          if (!ob.active) continue;
          if (ob.z > -0.5 && ob.z < 2.5) {
            const xDist = Math.abs(ob.x - runnerX);
            const collideRadius = (ob.colliderRadius || 0.6) + PLAYER_RADIUS;
            if (xDist < collideRadius) {
              takeDamage();
              break;
            }
          }
        }
      }

      return next;
    });
  });

  if (gameState !== 'playing' && gameState !== 'paused') return null;

  return (
    <group>
      {obstacles.map(ob => ob.active && ob.path ? (
        <ObstacleModel
          key={ob.id}
          path={ob.path}
          position={[ob.x, 0, ob.z]}
          scale={ob.scale || [1, 1, 1]}
        />
      ) : null)}
    </group>
  );
}

export default ObstacleManager;
