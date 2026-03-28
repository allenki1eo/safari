import { Suspense, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGameStore } from './store/gameStore';
import { useGameLoop } from './hooks/useGameLoop';
import { CHARACTERS, OUTFITS } from './utils/assetManifest';

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
  const runnerRef = useRef();

  const character = CHARACTERS.find(c => c.id === selectedCharacterId) || CHARACTERS[0];

  // Game loop hook (runs inside Canvas context)
  useGameLoop();

  const isActive = gameState === 'playing' || gameState === 'paused';

  return (
    <>
      <Camera />
      <GameEnvironment />
      <Track />

      <Suspense fallback={null}>
        <Runner modelPath={character.path} ref={runnerRef} />
      </Suspense>

      {isActive && (
        <>
          <ObstacleManager runnerRef={runnerRef} />
          <CollectibleManager />
          <NatureProps />
          <DustParticles />
          <CoinBurst />
        </>
      )}
    </>
  );
}

function App() {
  const gameState = useGameStore(s => s.gameState);

  return (
    <div className="w-full h-full relative overflow-hidden bg-black"
         style={{ width: '100vw', height: '100dvh' }}>

      {/* Loading Screen (DOM overlay, no Canvas needed) */}
      {gameState === 'loading' && <LoadingScreen />}

      {/* 3D Canvas — rendered for all states except loading */}
      {gameState !== 'loading' && (
        <Canvas
          shadows
          gl={{ antialias: true, powerPreference: 'high-performance' }}
          camera={{ position: [0, 4, 8], fov: 60, near: 0.1, far: 300 }}
          className="w-full h-full"
          style={{ position: 'absolute', inset: 0 }}
        >
          <Suspense fallback={null}>
            <GameScene />
          </Suspense>
        </Canvas>
      )}

      {/* UI Overlays */}
      {gameState === 'menu' && <MainMenu />}
      {gameState === 'character_select' && <CharacterSelect />}
      {gameState === 'gameover' && <GameOver />}
      {gameState === 'leaderboard' && <Leaderboard />}

      {/* HUD (shown during play and pause) */}
      <HUD />
    </div>
  );
}

export default App;
