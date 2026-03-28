import { useRef, useEffect, useMemo } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';

function AnimalNPCInstance({ path, position, scale, rotationY = 0 }) {
  const { scene, animations } = useGLTF(path);
  // Clone in useMemo — never in render body
  const clone = useMemo(() => scene.clone(true), [scene]);
  const groupRef = useRef();
  const { actions, mixer } = useAnimations(animations, groupRef);

  useEffect(() => {
    const anim = actions['walk'] || actions['Walk'] || actions['idle'] || actions['Idle'] || Object.values(actions)[0];
    if (anim) anim.reset().setLoop(2201, Infinity).play(); // THREE.LoopRepeat = 2201
  }, [actions]);

  useFrame((_, delta) => {
    mixer?.update(Math.min(delta, 0.1));
  });

  return (
    <group ref={groupRef} position={position} rotation={[0, rotationY, 0]} scale={scale}>
      <primitive object={clone} />
    </group>
  );
}

export default AnimalNPCInstance;
