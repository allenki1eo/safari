import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../store/gameStore';

const PLAY_TARGET = new THREE.Vector3(0, 4.5, 9);
const MENU_TARGET = new THREE.Vector3(0, 3, 7);
const LOOK_PLAY = new THREE.Vector3(0, 0.8, -20);
const LOOK_MENU = new THREE.Vector3(0, 1, -5);
const _lookAt = new THREE.Vector3();

function Camera() {
  const { camera } = useThree();
  const lookRef = useRef(LOOK_MENU.clone());

  useFrame((_, delta) => {
    const { gameState } = useGameStore.getState();
    const dt = Math.min(delta, 0.1);
    const lerpSpeed = 6 * dt;

    if (gameState === 'playing' || gameState === 'paused') {
      camera.position.lerp(PLAY_TARGET, lerpSpeed);
      lookRef.current.lerp(LOOK_PLAY, lerpSpeed);
    } else {
      camera.position.lerp(MENU_TARGET, lerpSpeed);
      lookRef.current.lerp(LOOK_MENU, lerpSpeed);
    }

    camera.lookAt(lookRef.current);
  });

  return null;
}

export default Camera;
