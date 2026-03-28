import { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const BURST_PARTICLES = 8;

function Burst({ position, onDone }) {
  const particles = useRef(
    Array.from({ length: BURST_PARTICLES }, () => ({
      vel: new THREE.Vector3(
        (Math.random() - 0.5) * 3,
        Math.random() * 3 + 1,
        (Math.random() - 0.5) * 3
      ),
      pos: new THREE.Vector3(...position),
      life: 1,
    }))
  );
  const refs = useRef([]);
  const doneRef = useRef(false);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    let allDead = true;

    particles.current.forEach((p, i) => {
      p.life -= dt * 2;
      if (p.life <= 0) return;
      allDead = false;
      p.pos.addScaledVector(p.vel, dt);
      p.vel.y -= 5 * dt;
      if (refs.current[i]) {
        refs.current[i].position.copy(p.pos);
        refs.current[i].material.opacity = p.life;
      }
    });

    if (allDead && !doneRef.current) {
      doneRef.current = true;
      onDone?.();
    }
  });

  return (
    <>
      {particles.current.map((p, i) => (
        <mesh key={i} ref={el => (refs.current[i] = el)} position={p.pos.toArray()}>
          <sphereGeometry args={[0.06, 4, 4]} />
          <meshBasicMaterial color="#FFD700" transparent opacity={1} />
        </mesh>
      ))}
    </>
  );
}

// Manager: listens for coin collect events and creates bursts
function CoinBurst() {
  const [bursts, setBursts] = useState([]);

  // Exposed globally for other components to trigger
  useEffect(() => {
    window.triggerCoinBurst = (position) => {
      const id = Date.now() + Math.random();
      setBursts(b => [...b, { id, position }]);
    };
    return () => { delete window.triggerCoinBurst; };
  }, []);

  return (
    <>
      {bursts.map(burst => (
        <Burst
          key={burst.id}
          position={burst.position}
          onDone={() => setBursts(b => b.filter(x => x.id !== burst.id))}
        />
      ))}
    </>
  );
}

export default CoinBurst;
