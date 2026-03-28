import { Suspense, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF, OrbitControls, Environment, useAnimations } from '@react-three/drei';
import { useGameStore } from '../../store/gameStore';
import { CHARACTERS, OUTFITS } from '../../utils/assetManifest';

function CharacterPreview({ path }) {
  const { scene, animations } = useGLTF(path);
  const groupRef = useRef();
  const { actions } = useAnimations(animations, groupRef);

  // Play idle or first animation
  useState(() => {
    const timer = setTimeout(() => {
      if (!actions) return;
      const idleAnim = actions['idle'] || actions['Idle'] || Object.values(actions)[0];
      idleAnim?.reset().play();
    }, 100);
    return () => clearTimeout(timer);
  });

  // Auto-scale to fit
  const clone = scene.clone(true);

  return (
    <group ref={groupRef} position={[0, -1, 0]}>
      <primitive object={clone} />
    </group>
  );
}

function PreviewCanvas({ path }) {
  return (
    <Canvas camera={{ position: [0, 1.5, 3], fov: 45 }} className="w-full h-full">
      <ambientLight intensity={0.6} />
      <directionalLight position={[2, 4, 2]} intensity={1} />
      <Environment preset="sunset" />
      <Suspense fallback={null}>
        <CharacterPreview path={path} />
      </Suspense>
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        minPolarAngle={Math.PI / 3}
        maxPolarAngle={Math.PI / 2}
        autoRotate
        autoRotateSpeed={3}
      />
    </Canvas>
  );
}

function CharacterSelect() {
  const {
    setGameState,
    selectedCharacterId, selectCharacter,
    selectedOutfitId, selectOutfit,
    unlockedCharacters, unlockedOutfits,
    totalCoinsEver,
  } = useGameStore();

  const [previewCharId, setPreviewCharId] = useState(selectedCharacterId);
  const previewChar = CHARACTERS.find(c => c.id === previewCharId) || CHARACTERS[0];
  const selectedOutfit = OUTFITS.find(o => o.id === selectedOutfitId) || OUTFITS[0];

  const handleConfirm = () => {
    selectCharacter(previewCharId);
    setGameState('menu');
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col"
         style={{ background: 'linear-gradient(180deg, #0A0A0A 0%, #0A1208 100%)' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#D4A853]/20">
        <button
          onClick={() => setGameState('menu')}
          className="text-[#D4A853] text-2xl px-2"
        >
          ←
        </button>
        <h2 className="text-[#D4A853] font-black text-xl tracking-widest">CHARACTERS</h2>
        <div className="text-[#F5E6C8] text-sm">
          🪙 {totalCoinsEver}
        </div>
      </div>

      {/* 3D Preview */}
      <div className="h-56 relative border-b border-[#D4A853]/10">
        <PreviewCanvas path={previewChar.path} />
        <div className="absolute bottom-2 left-0 right-0 text-center">
          <span className="text-[#D4A853] font-bold text-sm tracking-widest">
            {previewChar.name}
          </span>
        </div>
      </div>

      {/* Character grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <p className="text-[#F5E6C8]/50 text-xs mb-3 tracking-widest uppercase">Select Character</p>
        <div className="grid grid-cols-3 gap-3 mb-6">
          {CHARACTERS.map(char => {
            const unlocked = unlockedCharacters.includes(char.id);
            const isSelected = char.id === previewCharId;
            return (
              <button
                key={char.id}
                onClick={() => unlocked && setPreviewCharId(char.id)}
                className={`
                  relative p-3 rounded-xl border-2 flex flex-col items-center gap-1 transition-all duration-150
                  ${isSelected ? 'border-[#D4A853] bg-[#D4A853]/10' : 'border-[#333] bg-[#111]'}
                  ${!unlocked ? 'opacity-50' : 'hover:border-[#D4A853]/50 active:scale-95'}
                `}
              >
                <div className="text-2xl">{getCharEmoji(char.id)}</div>
                <span className="text-[#F5E6C8] text-xs text-center leading-tight">{char.name}</span>
                {!unlocked && (
                  <span className="text-[#D4A853] text-xs">🪙 {char.unlockCoins}</span>
                )}
                {unlocked && isSelected && (
                  <div className="absolute top-1 right-1 text-[#D4A853] text-xs">✓</div>
                )}
              </button>
            );
          })}
        </div>

        {/* Outfit selector */}
        <p className="text-[#F5E6C8]/50 text-xs mb-3 tracking-widest uppercase">Outfit</p>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {OUTFITS.map(outfit => {
            const unlocked = unlockedOutfits.includes(outfit.id);
            const isSelected = outfit.id === selectedOutfitId;
            return (
              <button
                key={outfit.id}
                onClick={() => unlocked && selectOutfit(outfit.id)}
                className={`
                  flex-shrink-0 px-4 py-3 rounded-xl border-2 flex flex-col items-center gap-1 min-w-[80px]
                  ${isSelected ? 'border-[#D4A853] bg-[#D4A853]/10' : 'border-[#333] bg-[#111]'}
                  ${!unlocked ? 'opacity-50' : 'hover:border-[#D4A853]/50 active:scale-95'}
                  transition-all duration-150
                `}
              >
                <div className="text-xl">{getOutfitEmoji(outfit.id)}</div>
                <span className="text-[#F5E6C8] text-xs">{outfit.name}</span>
                {!unlocked && (
                  <span className="text-[#D4A853] text-xs">🪙 {outfit.unlockCoins}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Confirm */}
      <div className="p-4 border-t border-[#D4A853]/20">
        <button
          onClick={handleConfirm}
          className="w-full py-4 bg-[#D4A853] text-[#0A0A0A] font-black text-lg rounded-xl
                     tracking-widest hover:bg-[#F5E6C8] active:scale-95 transition-all duration-150"
        >
          THIBITISHA ✓
        </button>
      </div>
    </div>
  );
}

function getCharEmoji(id) {
  const map = {
    adventurer: '🧭', casual: '🚶', farmer: '👨‍🌾', hoodie: '🧥',
    worker: '👷', beach: '🏖️', punk: '🎸', businessman: '💼',
    swat: '🛡️', astronaut: '🚀', king: '👑',
  };
  return map[id] || '🧑';
}

function getOutfitEmoji(id) {
  const map = {
    male_peasant: '👘', female_peasant: '👗', male_ranger: '🥾', female_ranger: '🎽',
  };
  return map[id] || '👕';
}

export default CharacterSelect;
