import { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../../store/gameStore';
import { LANES, PLAYER_RADIUS } from '../../utils/constants';
import { randomItem, randomInt, randomInRange } from '../../utils/helpers';
import {
  OBSTACLE_ANIMALS, LARGE_OBSTACLE_ANIMALS,
  MEDIUM_OBSTACLE_ANIMALS, NATURE_OBSTACLES, NATURE,
} from '../../utils/assetManifest';

const SPAWN_Z   = -55;
const DESPAWN_Z =  14;

// Target heights (world units) per obstacle type
const TARGET_H = { large: 1.6, medium: 1.1, obstacle: 1.2, rock: 0.9, tree: 2.2 };
// Collision half-widths
const COLLIDE_W = { large: 1.2, medium: 0.8, obstacle: 0.7, rock: 0.7, tree: 0.6 };

// Compute height from mesh geometries only (avoids Armature scale=100 inflation)
function getMeshGeomHeight(root) {
  let minY = Infinity, maxY = -Infinity;
  root.traverse(child => {
    if (child.isMesh && child.geometry?.attributes?.position) {
      if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
      const bb = child.geometry.boundingBox;
      if (bb) {
        minY = Math.min(minY, bb.min.y);
        maxY = Math.max(maxY, bb.max.y);
      }
    }
  });
  if (!isFinite(minY) || !isFinite(maxY)) return null;
  const h = maxY - minY;
  // Normalize cm→m if needed
  return h > 100 ? { h: h * 0.01, minY: minY * 0.01 } : { h, minY };
}

// ─── Single obstacle mesh ────────────────────────────────────────────────────
function ObstacleModel({ path, sizeKey, facePlayer = true }) {
  const { scene, animations } = useGLTF(path);
  const rootRef  = useRef();
  const scaleRef = useRef(false);
  const clone = useMemo(() => scene.clone(true), [scene]);
  const { actions, mixer } = useAnimations(animations, rootRef);

  useEffect(() => {
    if (!actions || Object.keys(actions).length === 0) return;
    const priority = ['Walk', 'walk', 'Run', 'run', 'Trot', 'trot', 'Idle', 'idle'];
    const name = priority.find(n => actions[n]) ?? Object.keys(actions)[0];
    if (name) actions[name].reset().setLoop(THREE.LoopRepeat, Infinity).play();
  }, [actions]);

  useFrame((_, delta) => {
    mixer?.update(Math.min(delta, 0.1));

    if (!scaleRef.current && rootRef.current) {
      const result = getMeshGeomHeight(rootRef.current);
      if (result && result.h > 0.01) {
        const targetH = TARGET_H[sizeKey] ?? 1.2;
        const s = targetH / result.h;
        rootRef.current.scale.setScalar(s);
        // Sit feet on y=0 of parent ObstacleInstance group
        rootRef.current.position.y = -result.minY * s;
        scaleRef.current = true;
      }
    }
  });

  return (
    <group ref={rootRef}>
      <primitive
        object={clone}
        rotation={[0, facePlayer ? 0 : Math.PI, 0]}
      />
    </group>
  );
}

// ─── Positioned wrapper ───────────────────────────────────────────────────────
function ObstacleInstance({ ob }) {
  return (
    <group position={[ob.x, 0, ob.z]}>
      <ObstacleModel
        path={ob.path}
        sizeKey={ob.sizeKey}
        facePlayer={ob.isAnimal}
      />
    </group>
  );
}

// ─── Asset pools ──────────────────────────────────────────────────────────────
const ROCK_PATHS = NATURE.filter(n => n.id.startsWith('rock_medium')).map(n => n.path);
const TREE_PATHS = NATURE.filter(n =>
  n.id.startsWith('twistedtree') || n.id.startsWith('deadtree') || n.id.startsWith('commontree')
).map(n => n.path);

function buildConfig() {
  const r = Math.random();

  if (r < 0.25 && LARGE_OBSTACLE_ANIMALS.length > 0) {
    const animal = randomItem(LARGE_OBSTACLE_ANIMALS);
    const lane = randomInt(0, 2);
    return { path: animal.path, lane, sizeKey: 'large', isAnimal: true };
  }
  if (r < 0.55 && MEDIUM_OBSTACLE_ANIMALS.length > 0) {
    return { path: randomItem(MEDIUM_OBSTACLE_ANIMALS).path, lane: randomInt(0, 2), sizeKey: 'medium', isAnimal: true };
  }
  if (r < 0.75 && ROCK_PATHS.length > 0) {
    return { path: randomItem(ROCK_PATHS), lane: randomInt(0, 2), sizeKey: 'rock', isAnimal: false };
  }
  if (TREE_PATHS.length > 0) {
    return { path: randomItem(TREE_PATHS), lane: randomInt(0, 2), sizeKey: 'tree', isAnimal: false };
  }
  if (NATURE_OBSTACLES.length > 0) {
    return { path: randomItem(NATURE_OBSTACLES).path, lane: randomInt(0, 2), sizeKey: 'obstacle', isAnimal: false };
  }
  return null;
}

// ─── Manager ──────────────────────────────────────────────────────────────────
function ObstacleManager() {
  const [obstacles, setObstacles] = useState([]);
  const spawnTimer = useRef(0);
  const nextSpawn  = useRef(randomInRange(2.5, 4.5));
  const gameState  = useGameStore(s => s.gameState);

  useEffect(() => {
    if (gameState !== 'playing') {
      setObstacles([]);
      spawnTimer.current = 0;
      nextSpawn.current  = randomInRange(2.5, 4.5);
    }
  }, [gameState]);

  useFrame((_, delta) => {
    const { gameState: gs, speed, takeDamage, isInvincible } = useGameStore.getState();
    if (gs !== 'playing') return;
    const dt = Math.min(delta, 0.1);

    setObstacles(prev => {
      let next = prev
        .map(ob => ({ ...ob, z: ob.z + speed * dt }))
        .filter(ob => ob.z < DESPAWN_Z);

      spawnTimer.current += dt;
      if (spawnTimer.current >= nextSpawn.current) {
        spawnTimer.current = 0;
        nextSpawn.current  = randomInRange(2.0, 4.0);
        const cfg = buildConfig();
        if (cfg) {
          next.push({ id: Date.now() + Math.random(), ...cfg, x: LANES[cfg.lane] ?? 0, z: SPAWN_Z });
        }
      }

      // Collision check
      if (!isInvincible) {
        const rx = window.__runnerX ?? 0;
        for (const ob of next) {
          if (ob.z > -1.5 && ob.z < 2.0) {
            const hw = (COLLIDE_W[ob.sizeKey] ?? 0.8) + PLAYER_RADIUS;
            if (Math.abs(ob.x - rx) < hw) {
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
      {obstacles.map(ob => <ObstacleInstance key={ob.id} ob={ob} />)}
    </group>
  );
}

export default ObstacleManager;
