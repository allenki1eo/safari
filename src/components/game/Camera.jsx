import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../store/gameStore';
import { CAMERA_OFFSET, CAMERA_LERP } from '../../utils/constants';

const tempVec = new THREE.Vector3();
const targetVec = new THREE.Vector3();

function Camera() {
  const { camera } = useThree();
  const smoothPosRef = useRef(new THREE.Vector3(0, CAMERA_OFFSET.y, CAMERA_OFFSET.z));

  useFrame((state, delta) => {
    const { gameState } = useGameStore.getState();
    const dt = Math.min(delta, 0.1);

    if (gameState === 'menu' || gameState === 'character_select') {
      // Menu: fixed angle view
      tempVec.set(0, 3, 5);
      camera.position.lerp(tempVec, 0.05);
      camera.lookAt(0, 1, 0);
      return;
    }

    if (gameState !== 'playing' && gameState !== 'paused') return;

    // Follow runner — runner is always at z=0, moves in x
    // Camera stays behind and above
    targetVec.set(CAMERA_OFFSET.x, CAMERA_OFFSET.y, CAMERA_OFFSET.z);

    smoothPosRef.current.lerp(targetVec, CAMERA_LERP);
    camera.position.copy(smoothPosRef.current);
    camera.lookAt(0, 1, -15); // look ahead of runner
  });

  return null;
}

export default Camera;
