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
const DESPAWN_Z =   3;   // despawn just past player, well before camera at z≈9

// Target heights (world units)
const TARGET_H = { large: 1.5, medium: 1.0, obstacle: 1.1, rock: 0.8, tree: 2.0 };
// Collision half-widths
const COLLIDE_W = { large: 1.1, medium: 0.8, obstacle: 0.7, rock: 0.6, tree: 0.5 };

// ─── Single obstacle with robust auto-scaling ────────────────────────────────
function ObstacleModel({ path, sizeKey, facePlayer = true }) {
  const { scene, animations } = useGLTF(path);
  const rootRef   = useRef();
  const scaleRef  = useRef(false);
  const frameRef  = useRef(0);
  const clone = useMemo(() => scene.clone(true), [scene]);
  const { actions, mixer } = useAnimations(animations, rootRef);

  // Play walk/run animation
  useEffect(() => {
    if (!actions || Object.keys(actions).length === 0) return;
    const priority = ['Walk', 'walk', 'Run', 'run', 'Gallop', 'Trot', 'trot', 'Idle', 'idle'];
    const name = priority.find(n => actions[n]) ?? Object.keys(actions)[0];
    if (name) actions[name].reset().setLoop(THREE.LoopRepeat, Infinity).play();
  }, [actions]);

  useFrame((_, delta) => {
    mixer?.update(Math.min(delta, 0.1));
    frameRef.current++;

    // Wait a few frames so Three.js has fully committed the model to the scene
    if (!scaleRef.current && rootRef.current && frameRef.current >= 3) {
      rootRef.current.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(rootRef.current);
      const h = box.max.y - box.min.y;

      if (isFinite(h) && h > 0.05) {
        const targetH = TARGET_H[sizeKey] ?? 1.2;
        const s = targetH / h;
        rootRef.current.scale.setScalar(s);

        // Recompute box at new scale for accurate feet placement
        rootRef.current.updateMatrixWorld(true);
        const newBox = new THREE.Box3().setFromObject(rootRef.current);
        if (isFinite(newBox.min.y)) {
          rootRef.current.position.y = -newBox.min.y;
        }
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

// Preload obstacle assets so they're ready when spawned
[...LARGE_OBSTACLE_ANIMALS, ...MEDIUM_OBSTACLE_ANIMALS].forEach(a => {
  try { useGLTF.preload(a.path); } catch (_) { /* ignore */ }
});
ROCK_PATHS.forEach(p => { try { useGLTF.preload(p); } catch (_) {} });
TREE_PATHS.slice(0, 5).forEach(p => { try { useGLTF.preload(p); } catch (_) {} });

function buildConfig() {
  const r = Math.random();

  // 25% large animal (buffalo, etc.)
  if (r < 0.25 && LARGE_OBSTACLE_ANIMALS.length > 0) {
    return { path: randomItem(LARGE_OBSTACLE_ANIMALS).path, lane: randomInt(0, 2), sizeKey: 'large', isAnimal: true };
  }
  // 30% medium animal (gazelle, impala, wild dog)
  if (r < 0.55 && MEDIUM_OBSTACLE_ANIMALS.length > 0) {
    return { path: randomItem(MEDIUM_OBSTACLE_ANIMALS).path, lane: randomInt(0, 2), sizeKey: 'medium', isAnimal: true };
  }
  // 20% rock
  if (r < 0.75 && ROCK_PATHS.length > 0) {
    return { path: randomItem(ROCK_PATHS), lane: randomInt(0, 2), sizeKey: 'rock', isAnimal: false };
  }
  // 25% tree
  if (TREE_PATHS.length > 0) {
    return { path: randomItem(TREE_PATHS), lane: randomInt(0, 2), sizeKey: 'tree', isAnimal: false };
  }
  // fallback
  if (NATURE_OBSTACLES.length > 0) {
    return { path: randomItem(NATURE_OBSTACLES).path, lane: randomInt(0, 2), sizeKey: 'obstacle', isAnimal: false };
  }
  return null;
}

// ─── Manager ──────────────────────────────────────────────────────────────────
function ObstacleManager() {
  const [obstacles, setObstacles] = useState([]);
  const spawnTimer = useRef(0);
  const nextSpawn  = useRef(randomInRange(2.0, 4.0));
  const gameState  = useGameStore(s => s.gameState);

  // Clear on game end / restart
  useEffect(() => {
    if (gameState !== 'playing') {
      setObstacles([]);
      spawnTimer.current = 0;
      nextSpawn.current  = randomInRange(2.0, 4.0);
    }
  }, [gameState]);

  useFrame((_, delta) => {
    const { gameState: gs, speed, takeDamage, isInvincible } = useGameStore.getState();
    if (gs !== 'playing') return;
    const dt = Math.min(delta, 0.1);

    setObstacles(prev => {
      // Advance positions and despawn past camera
      let next = prev
        .map(ob => ({ ...ob, z: ob.z + speed * dt }))
        .filter(ob => ob.z < DESPAWN_Z);

      // Spawn new obstacle
      spawnTimer.current += dt;
      if (spawnTimer.current >= nextSpawn.current) {
        spawnTimer.current = 0;
        nextSpawn.current  = randomInRange(1.8, 3.5);
        const cfg = buildConfig();
        if (cfg) {
          next.push({
            id: Date.now() + Math.random(),
            ...cfg,
            x: LANES[cfg.lane] ?? 0,
            z: SPAWN_Z,
          });
        }
      }

      // Collision detection
      if (!isInvincible) {
        const rx = window.__runnerX ?? 0;
        for (const ob of next) {
          if (ob.z > -1.5 && ob.z < 1.5) {
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
