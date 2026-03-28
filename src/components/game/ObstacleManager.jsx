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

const SPAWN_Z   = -58;
const DESPAWN_Z =  13;

// Target heights (world units) for auto-scaling
const TARGET_H = { large: 1.6, medium: 1.1, obstacle: 1.2, rock: 0.8, tree: 2.0 };
// Collision half-widths
const COLLIDE_W = { large: 1.3, medium: 0.9, obstacle: 0.7, rock: 0.6, tree: 0.7 };

// ─── Single obstacle mesh ───────────────────────────────────────────────────
function ObstacleModel({ path, sizeKey, facePlayer = true }) {
  const { scene, animations } = useGLTF(path);
  const rootRef  = useRef();
  const scaleRef = useRef(false);

  // Create a stable clone per obstacle instance
  const clone = useMemo(() => scene.clone(true), [scene]);

  // Bind animations to the group that holds the clone
  const { actions, mixer } = useAnimations(animations, rootRef);

  // Play walk / idle animation once actions are ready
  useEffect(() => {
    if (!actions || Object.keys(actions).length === 0) return;
    const priority = ['Walk', 'walk', 'Run', 'run', 'Trot', 'trot', 'Idle', 'idle'];
    const name = priority.find(n => actions[n]) ?? Object.keys(actions)[0];
    if (name) actions[name].reset().setLoop(THREE.LoopRepeat, Infinity).play();
  }, [actions]);

  // Update mixer every frame
  useFrame((_, delta) => {
    mixer?.update(Math.min(delta, 0.1));

    // Auto-scale once after mount (bounding box on first frame)
    if (!scaleRef.current && rootRef.current) {
      const box = new THREE.Box3().setFromObject(rootRef.current);
      const h   = box.max.y - box.min.y;
      if (h > 0.01) {
        const targetH = TARGET_H[sizeKey] ?? 1.2;
        const s = targetH / h;
        rootRef.current.scale.setScalar(s);
        // Sit the model's feet on y=0
        const minY = box.min.y * s;
        rootRef.current.position.y = -minY;
        scaleRef.current = true;
      }
    }
  });

  return (
    <group ref={rootRef}>
      {/* Animals face toward the camera (+Z) so they "charge" at the player */}
      <primitive
        object={clone}
        rotation={[0, facePlayer ? 0 : Math.PI, 0]}
      />
    </group>
  );
}

// ─── Wrapper that positions each obstacle in world space ─────────────────────
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

// ─── Config builders ─────────────────────────────────────────────────────────

// Nature obstacles: rocks and trees that appear on every biome
const ROCK_PATHS  = NATURE.filter(n => n.id.startsWith('rock_medium')  ).map(n => n.path);
const PEBBLE_PATHS= NATURE.filter(n => n.id.startsWith('pebble_round') ).map(n => n.path);
const TREE_PATHS  = NATURE.filter(n =>
  n.id.startsWith('twistedtree') || n.id.startsWith('deadtree') || n.id.startsWith('commontree')
).map(n => n.path);

function buildConfig(biome) {
  const r = Math.random();

  // 35 % → large animal
  if (r < 0.20 && LARGE_OBSTACLE_ANIMALS.length > 0) {
    const animal = randomItem(LARGE_OBSTACLE_ANIMALS);
    const lane   = randomInt(0, 1); // blocks centre+right or left+centre
    return { path: animal.path, lane, sizeKey: 'large', isAnimal: true };
  }

  // 35 % → medium animal
  if (r < 0.45 && MEDIUM_OBSTACLE_ANIMALS.length > 0) {
    const pool = MEDIUM_OBSTACLE_ANIMALS.length > 0 ? MEDIUM_OBSTACLE_ANIMALS : OBSTACLE_ANIMALS;
    return { path: randomItem(pool).path, lane: randomInt(0, 2), sizeKey: 'medium', isAnimal: true };
  }

  // 25 % → rock / boulder
  if (r < 0.70 && ROCK_PATHS.length > 0) {
    return { path: randomItem(ROCK_PATHS), lane: randomInt(0, 2), sizeKey: 'rock', isAnimal: false };
  }

  // 20 % → tree / fallen trunk
  if (TREE_PATHS.length > 0) {
    return { path: randomItem(TREE_PATHS), lane: randomInt(0, 2), sizeKey: 'tree', isAnimal: false };
  }

  // Fallback → any nature obstacle
  if (NATURE_OBSTACLES.length > 0) {
    return { path: randomItem(NATURE_OBSTACLES).path, lane: randomInt(0, 2), sizeKey: 'obstacle', isAnimal: false };
  }

  return null;
}

// ─── Manager ─────────────────────────────────────────────────────────────────
function ObstacleManager() {
  const [obstacles, setObstacles] = useState([]);
  const spawnTimer = useRef(0);
  const nextSpawn  = useRef(randomInRange(2.5, 5));
  const gameState  = useGameStore(s => s.gameState);

  // Clear on game end / restart
  useEffect(() => {
    if (gameState !== 'playing') {
      setObstacles([]);
      spawnTimer.current = 0;
      nextSpawn.current  = randomInRange(2.5, 5);
    }
  }, [gameState]);

  useFrame((_, delta) => {
    const { gameState: gs, speed, currentBiome, takeDamage, isInvincible } = useGameStore.getState();
    if (gs !== 'playing') return;
    const dt = Math.min(delta, 0.1);

    setObstacles(prev => {
      // Advance & despawn
      let next = prev
        .map(ob => ({ ...ob, z: ob.z + speed * dt }))
        .filter(ob => ob.z < DESPAWN_Z);

      // Spawn
      spawnTimer.current += dt;
      if (spawnTimer.current >= nextSpawn.current) {
        spawnTimer.current = 0;
        nextSpawn.current  = randomInRange(2.0, 4.5);

        const cfg = buildConfig(currentBiome);
        if (cfg) {
          const x = LANES[cfg.lane] ?? 0;
          next.push({ id: Date.now() + Math.random(), ...cfg, x, z: SPAWN_Z });

          // Large animal blocks two lanes
          if (cfg.sizeKey === 'large' && cfg.lane < 2) {
            next.push({
              id: Date.now() + Math.random() + 1,
              ...cfg,
              lane: cfg.lane + 1,
              x: LANES[cfg.lane + 1],
              z: SPAWN_Z,
            });
          }
        }
      }

      // Collision check
      if (!isInvincible) {
        const rx = window.__runnerX ?? 0;
        for (const ob of next) {
          if (ob.z > -1.2 && ob.z < 2.2) {
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
