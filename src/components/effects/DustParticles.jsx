import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../store/gameStore';

const PARTICLE_COUNT = 30;

function DustParticles() {
  const meshRef = useRef();
  const gameState = useGameStore(s => s.gameState);

  const { positions, velocities, lifetimes } = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const velocities = [];
    const lifetimes = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 0.5;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
      velocities.push({
        x: (Math.random() - 0.5) * 0.8,
        y: Math.random() * 0.5 + 0.2,
        z: Math.random() * 0.5,
      });
      lifetimes.push(Math.random());
    }
    return { positions, velocities, lifetimes };
  }, []);

  useFrame((state, delta) => {
    if (!meshRef.current || gameState !== 'playing') return;
    const dt = Math.min(delta, 0.1);
    const pos = meshRef.current.geometry.attributes.position.array;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      lifetimes[i] -= dt * 1.5;
      if (lifetimes[i] <= 0) {
        // Reset
        pos[i * 3] = (Math.random() - 0.5) * 0.4;
        pos[i * 3 + 1] = 0;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
        lifetimes[i] = 0.5 + Math.random() * 0.5;
        velocities[i] = {
          x: (Math.random() - 0.5) * 0.8,
          y: Math.random() * 0.4 + 0.1,
          z: Math.random() * 0.3,
        };
      } else {
        pos[i * 3] += velocities[i].x * dt;
        pos[i * 3 + 1] += velocities[i].y * dt;
        pos[i * 3 + 2] += velocities[i].z * dt;
        velocities[i].y -= 1.5 * dt;
      }
    }

    meshRef.current.geometry.attributes.position.needsUpdate = true;
  });

  if (gameState !== 'playing') return null;

  return (
    <points ref={meshRef} position={[0, 0, 0.5]}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={PARTICLE_COUNT}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#C4883C"
        size={0.08}
        transparent
        opacity={0.5}
        sizeAttenuation
      />
    </points>
  );
}

export default DustParticles;
