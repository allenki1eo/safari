import { useRef, useState, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../store/gameStore';
import { LANES, PLAYER_RADIUS, COIN_ARC_COUNT } from '../../utils/constants';
import { randomInt, randomItem, randomInRange } from '../../utils/helpers';

const SPAWN_Z = -65;
const DESPAWN_Z = 10;
const COIN_COLLECT_RADIUS = 1.2;
const GEM_COLLECT_RADIUS = 1.5;
const POWERUP_COLLECT_RADIUS = 1.8;

// Collectible pattern generators
function generateCoinPattern(lane) {
  const patterns = ['line', 'arc', 'zigzag'];
  const pattern = randomItem(patterns);
  const coins = [];

  if (pattern === 'line') {
    for (let i = 0; i < 8; i++) {
      coins.push({ x: LANES[lane], y: 0.8, z: SPAWN_Z - i * 2 });
    }
  } else if (pattern === 'arc') {
    for (let i = 0; i < COIN_ARC_COUNT; i++) {
      const t = i / (COIN_ARC_COUNT - 1);
      const arcY = Math.sin(t * Math.PI) * 2.5 + 0.8;
      coins.push({ x: LANES[lane], y: arcY, z: SPAWN_Z - i * 2 });
    }
  } else {
    for (let i = 0; i < 6; i++) {
      const laneOffset = i % 3;
      coins.push({ x: LANES[laneOffset], y: 0.8, z: SPAWN_Z - i * 3 });
    }
  }

  return coins;
}

function Coin({ position, collected, collectRadius }) {
  const meshRef = useRef();

  useFrame((state) => {
    if (!meshRef.current || collected) return;
    meshRef.current.rotation.y += 0.05;
    meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 2 + position[2]) * 0.1;
  });

  if (collected) return null;

  return (
    <mesh ref={meshRef} position={position}>
      <torusGeometry args={[0.2, 0.06, 8, 16]} />
      <meshStandardMaterial
        color="#FFD700"
        emissive="#FFA500"
        emissiveIntensity={0.3}
        metalness={0.8}
        roughness={0.2}
      />
    </mesh>
  );
}

function Gem({ position, collected }) {
  const meshRef = useRef();

  useFrame((state) => {
    if (!meshRef.current || collected) return;
    meshRef.current.rotation.y += 0.03;
    meshRef.current.rotation.x += 0.02;
    const pulse = (Math.sin(state.clock.elapsedTime * 3) + 1) / 2;
    meshRef.current.material.emissiveIntensity = 0.3 + pulse * 0.5;
  });

  if (collected) return null;

  return (
    <mesh ref={meshRef} position={position}>
      <icosahedronGeometry args={[0.2, 0]} />
      <meshStandardMaterial
        color="#00BFFF"
        emissive="#0080FF"
        emissiveIntensity={0.5}
        metalness={0.3}
        roughness={0.1}
        transparent
        opacity={0.9}
      />
    </mesh>
  );
}

function PowerUp({ position, type, collected }) {
  const meshRef = useRef();

  useFrame((state) => {
    if (!meshRef.current || collected) return;
    meshRef.current.rotation.y += 0.04;
    meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 2) * 0.2;
  });

  if (collected) return null;

  const color = type === 'magnet' ? '#FF69B4' : type === 'shield' ? '#00FF7F' : '#FF4500';

  return (
    <mesh ref={meshRef} position={position}>
      <octahedronGeometry args={[0.3, 0]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.6}
        metalness={0.5}
        roughness={0.2}
      />
    </mesh>
  );
}

function CollectibleManager() {
  const [coins, setCoins] = useState([]);
  const [gems, setGems] = useState([]);
  const [powerUps, setPowerUps] = useState([]);
  const spawnTimerRef = useRef(0);
  const gemTimerRef = useRef(randomInRange(8, 15));
  const powerUpTimerRef = useRef(randomInRange(15, 25));

  const { gameState, collectCoin, collectGem, activatePowerUp, activePowerUp } = useGameStore(s => ({
    gameState: s.gameState,
    collectCoin: s.collectCoin,
    collectGem: s.collectGem,
    activatePowerUp: s.activatePowerUp,
    activePowerUp: s.activePowerUp,
  }));

  // Clear all collectibles when leaving play state
  useEffect(() => {
    if (gameState !== 'playing') {
      setCoins([]);
      setGems([]);
      setPowerUps([]);
      spawnTimerRef.current = 0;
      gemTimerRef.current = randomInRange(8, 15);
      powerUpTimerRef.current = randomInRange(15, 25);
    }
  }, [gameState]);

  useFrame((state, delta) => {
    if (gameState !== 'playing') return;
    const { speed, isInvincible } = useGameStore.getState();
    const dt = Math.min(delta, 0.1);

    // Move all collectibles
    const moveZ = (items) => items.map(item => ({ ...item, z: item.z + speed * dt }));

    // Despawn
    const despawn = (items) => items.filter(item => item.z < DESPAWN_Z && !item.collected);

    setCoins(prev => {
      let next = moveZ(prev).filter(c => c.z < DESPAWN_Z);

      // Spawn coins
      spawnTimerRef.current += dt;
      if (spawnTimerRef.current > randomInRange(3, 6)) {
        spawnTimerRef.current = 0;
        const lane = randomInt(0, 2);
        const newCoins = generateCoinPattern(lane).map((c, i) => ({
          id: Date.now() + i,
          x: c.x, y: c.y, z: c.z,
          collected: false,
        }));
        next = [...next, ...newCoins];
      }

      // Check collection — use actual runner X from window.__runnerX
      const hasActivePU = useGameStore.getState().activePowerUp;
      const runnerX = window.__runnerX ?? 0;
      let collected = 0;
      next = next.map(coin => {
        if (coin.collected) return coin;
        const distZ = Math.abs(coin.z);
        const distX = Math.abs(coin.x - runnerX);

        // Magnet attracts coins in wider radius
        const collectR = hasActivePU === 'magnet' ? COIN_COLLECT_RADIUS * 3 : COIN_COLLECT_RADIUS;
        if (distZ < collectR && distX < collectR) {
          collected++;
          return { ...coin, collected: true };
        }
        return coin;
      });
      if (collected > 0) {
        for (let i = 0; i < collected; i++) collectCoin();
      }

      return next.filter(c => !c.collected || c.z > -2);
    });

    setGems(prev => {
      let next = moveZ(prev).filter(g => g.z < DESPAWN_Z);

      gemTimerRef.current -= dt;
      if (gemTimerRef.current <= 0) {
        gemTimerRef.current = randomInRange(10, 20);
        const lane = randomInt(0, 2);
        next.push({ id: Date.now(), x: LANES[lane], y: 1.2, z: SPAWN_Z, collected: false });
      }

      next = next.map(gem => {
        if (gem.collected) return gem;
        const gRx = window.__runnerX ?? 0;
        if (Math.abs(gem.z) < GEM_COLLECT_RADIUS && Math.abs(gem.x - gRx) < GEM_COLLECT_RADIUS) {
          collectGem();
          return { ...gem, collected: true };
        }
        return gem;
      });

      return next.filter(g => !g.collected);
    });

    setPowerUps(prev => {
      let next = moveZ(prev).filter(p => p.z < DESPAWN_Z);

      powerUpTimerRef.current -= dt;
      if (powerUpTimerRef.current <= 0 && !activePowerUp) {
        powerUpTimerRef.current = randomInRange(20, 35);
        const types = ['magnet', 'shield', 'boost'];
        const type = randomItem(types);
        const lane = randomInt(0, 2);
        next.push({ id: Date.now(), type, x: LANES[lane], y: 1.2, z: SPAWN_Z, collected: false });
      }

      next = next.map(pu => {
        if (pu.collected) return pu;
        const puRx = window.__runnerX ?? 0;
        if (Math.abs(pu.z) < POWERUP_COLLECT_RADIUS && Math.abs(pu.x - puRx) < POWERUP_COLLECT_RADIUS) {
          activatePowerUp(pu.type);
          return { ...pu, collected: true };
        }
        return pu;
      });

      return next.filter(p => !p.collected);
    });
  });

  if (gameState !== 'playing' && gameState !== 'paused') return null;

  return (
    <group>
      {coins.map(coin => (
        <Coin key={coin.id} position={[coin.x, coin.y, coin.z]} collected={coin.collected} />
      ))}
      {gems.map(gem => (
        <Gem key={gem.id} position={[gem.x, gem.y, gem.z]} collected={gem.collected} />
      ))}
      {powerUps.map(pu => (
        <PowerUp key={pu.id} position={[pu.x, pu.y, pu.z]} type={pu.type} collected={pu.collected} />
      ))}
    </group>
  );
}

export default CollectibleManager;
