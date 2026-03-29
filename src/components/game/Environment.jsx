import { useRef } from 'react';
import { Sky } from '@react-three/drei';
import { useGameStore } from '../../store/gameStore';
import { BIOME_CONFIGS } from '../../utils/constants';

// Sky presets per biome
const BIOME_SKY = {
  serengeti:   { sunPosition: [100, 8, -50],  turbidity: 8,  rayleigh: 3,   mieCoefficient: 0.005, mieDirectionalG: 0.8 },
  kilimanjaro: { sunPosition: [50,  3,  100], turbidity: 12, rayleigh: 2,   mieCoefficient: 0.003, mieDirectionalG: 0.7 },
  zanzibar:    { sunPosition: [100, 25, -80], turbidity: 4,  rayleigh: 1.5, mieCoefficient: 0.002, mieDirectionalG: 0.9 },
};

function BiomeFog({ biome }) {
  const config = BIOME_CONFIGS[biome] || BIOME_CONFIGS.serengeti;
  return <fog attach="fog" args={[config.fogColor, config.fogNear, config.fogFar]} />;
}

function SunLight({ biome }) {
  const config = BIOME_CONFIGS[biome] || BIOME_CONFIGS.serengeti;
  return (
    <>
      <ambientLight intensity={0.6} color={config.ambientColor} />
      <directionalLight
        position={[10, 20, -10]}
        intensity={1.3}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={0.1}
        shadow-camera-far={100}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />
      <hemisphereLight
        skyColor={config.ambientColor}
        groundColor={config.groundColor || '#552200'}
        intensity={0.4}
      />
    </>
  );
}

function GameEnvironment() {
  const currentBiome = useGameStore(s => s.currentBiome);
  const sky = BIOME_SKY[currentBiome] || BIOME_SKY.serengeti;

  return (
    <>
      <BiomeFog biome={currentBiome} />
      <SunLight biome={currentBiome} />

      {/* Procedural sky */}
      <Sky
        distance={450000}
        sunPosition={sky.sunPosition}
        turbidity={sky.turbidity}
        rayleigh={sky.rayleigh}
        mieCoefficient={sky.mieCoefficient}
        mieDirectionalG={sky.mieDirectionalG}
      />

      {/* Kilimanjaro distant mountain */}
      {currentBiome === 'kilimanjaro' && (
        <mesh position={[0, 15, -120]}>
          <coneGeometry args={[35, 40, 6]} />
          <meshLambertMaterial color="#8B9BAA" fog={false} />
        </mesh>
      )}

      {/* Zanzibar ocean */}
      {currentBiome === 'zanzibar' && (
        <mesh position={[50, -0.3, -40]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[100, 250]} />
          <meshLambertMaterial color="#006994" transparent opacity={0.75} />
        </mesh>
      )}
    </>
  );
}

export default GameEnvironment;
