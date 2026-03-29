import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../store/gameStore';

const PLAY_POS  = new THREE.Vector3(0, 4.5, 9);
const MENU_POS  = new THREE.Vector3(0, 3, 7);
const LOOK_PLAY = new THREE.Vector3(0, 0.8, -20);
const LOOK_MENU = new THREE.Vector3(0, 1, -5);

const _target = new THREE.Vector3();
const _look   = new THREE.Vector3();

function Camera() {
  const { camera } = useThree();
  const lookRef = useRef(LOOK_MENU.clone());

  useFrame((_, delta) => {
    const { gameState } = useGameStore.getState();
    const dt = Math.min(delta, 0.1);
    const lerp = 5 * dt;

    if (gameState === 'playing' || gameState === 'paused') {
      // Track player's lane position for dynamic feel
      const rx = window.__runnerX ?? 0;
      _target.set(rx * 0.3, PLAY_POS.y, PLAY_POS.z);
      _look.set(rx * 0.4, LOOK_PLAY.y, LOOK_PLAY.z);
      camera.position.lerp(_target, lerp);
      lookRef.current.lerp(_look, lerp);
    } else {
      camera.position.lerp(MENU_POS, lerp);
      lookRef.current.lerp(LOOK_MENU, lerp);
    }

    camera.lookAt(lookRef.current);
  });

  return null;
}

export default Camera;
