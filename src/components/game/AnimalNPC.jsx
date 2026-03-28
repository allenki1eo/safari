import { useRef, useEffect } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';

function AnimalNPCInstance({ path, position, scale, rotationY = 0 }) {
  const { scene, animations } = useGLTF(path);
  const groupRef = useRef();
  const { actions, mixer } = useAnimations(animations, groupRef);

  useEffect(() => {
    const anim = actions['walk'] || actions['Walk'] || actions['idle'] || actions['Idle'] || Object.values(actions)[0];
    if (anim) anim.reset().play();
  }, [actions]);

  useFrame((_, delta) => {
    mixer?.update(Math.min(delta, 0.1));
  });

  const clone = scene.clone(true);

  return (
    <group ref={groupRef} position={position} rotation={[0, rotationY, 0]} scale={scale}>
      <primitive object={clone} />
    </group>
  );
}

export default AnimalNPCInstance;
