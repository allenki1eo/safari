import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGameStore } from './store/gameStore';
import { useGameLoop } from './hooks/useGameLoop';
import { CHARACTERS } from './utils/assetManifest';

// UI components
import LoadingScreen from './components/ui/LoadingScreen';
import MainMenu from './components/ui/MainMenu';
import CharacterSelect from './components/ui/CharacterSelect';
import HUD from './components/ui/HUD';
import GameOver from './components/ui/GameOver';
import Leaderboard from './components/ui/Leaderboard';

// 3D game components
import Runner from './components/game/Runner';
import Track from './components/game/Track';
import ObstacleManager from './components/game/ObstacleManager';
import CollectibleManager from './components/game/CollectibleManager';
import NatureProps from './components/game/NatureProps';
import GameEnvironment from './components/game/Environment';
import Camera from './components/game/Camera';

// Effects
import DustParticles from './components/effects/DustParticles';
import CoinBurst from './components/effects/CoinBurst';

function GameScene() {
  const gameState = useGameStore(s => s.gameState);
  const selectedCharacterId = useGameStore(s => s.selectedCharacterId);

  const character = CHARACTERS.find(c => c.id === selectedCharacterId) || CHARACTERS[0];
  const isActive = gameState === 'playing' || gameState === 'paused';

  useGameLoop();

  return (
    <>
      <Camera />
      <GameEnvironment />
      <Track />

      {/* Player */}
      <Suspense fallback={null}>
        <Runner modelPath={character.path} />
      </Suspense>

      {/* Active game systems */}
      {isActive && (
        <Suspense fallback={null}>
          <ObstacleManager />
          <CollectibleManager />
          <NatureProps />
          <DustParticles />
          <CoinBurst />
        </Suspense>
      )}

      {/* Nature scenery in menu too */}
      {gameState === 'menu' && (
        <Suspense fallback={null}>
          <NatureProps />
        </Suspense>
      )}
    </>
  );
}

function App() {
  const gameState = useGameStore(s => s.gameState);
  const showCanvas = gameState !== 'loading';

  return (
    <div style={{ width: '100vw', height: '100dvh', position: 'relative', overflow: 'hidden', background: '#0A0A0A' }}>

      {/* Loading screen — no Canvas needed */}
      {gameState === 'loading' && <LoadingScreen />}

      {/* 3D Canvas */}
      {showCanvas && (
        <Canvas
          shadows
          gl={{ antialias: true, powerPreference: 'high-performance' }}
          // Camera starts behind the player (positive Z)
          camera={{ position: [0, 4.5, 9], fov: 60, near: 0.1, far: 400 }}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        >
          <Suspense fallback={null}>
            <GameScene />
          </Suspense>
        </Canvas>
      )}

      {/* UI overlays */}
      {gameState === 'menu'             && <MainMenu />}
      {gameState === 'character_select' && <CharacterSelect />}
      {gameState === 'gameover'         && <GameOver />}
      {gameState === 'leaderboard'      && <Leaderboard />}
      <HUD />
    </div>
  );
}

export default App;
