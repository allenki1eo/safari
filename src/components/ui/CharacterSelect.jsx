import { Suspense, useRef, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF, OrbitControls, Environment, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../../store/gameStore';
import { CHARACTERS, OUTFITS } from '../../utils/assetManifest';

// ─── 3-D rotating preview ────────────────────────────────────────────────────
function ModelPreview({ path }) {
  const { scene, animations } = useGLTF(path);
  const groupRef = useRef();
  const { actions, mixer } = useAnimations(animations, groupRef);
  const scaledRef = useRef(false);

  // Play idle once actions are ready
  useEffect(() => {
    if (!actions || Object.keys(actions).length === 0) return;
    const priority = ['Idle', 'idle', 'idle_loop', 'T-Pose', 'Walk', 'Run'];
    const name = priority.find(n => actions[n]) ?? Object.keys(actions)[0];
    if (name) {
      actions[name].reset().setLoop(THREE.LoopRepeat, Infinity).play();
    }
  }, [actions]);

  // Auto-scale to ~1.8 units tall
  useEffect(() => {
    if (scaledRef.current || !groupRef.current) return;
    const box = new THREE.Box3().setFromObject(groupRef.current);
    const h = box.max.y - box.min.y;
    if (h > 0.01) {
      const s = 1.8 / h;
      groupRef.current.scale.setScalar(s);
      groupRef.current.position.y = -box.min.y * s;
      scaledRef.current = true;
    }
  });

  // Tick mixer manually
  useEffect(() => {
    let raf;
    let last = performance.now();
    const tick = (now) => {
      mixer?.update((now - last) / 1000);
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mixer]);

  return (
    <group ref={groupRef}>
      <primitive object={scene} rotation={[0, Math.PI, 0]} />
    </group>
  );
}

function PreviewCanvas({ path }) {
  return (
    <Canvas camera={{ position: [0, 1.0, 3.2], fov: 52 }} className="w-full h-full">
      <ambientLight intensity={0.8} />
      <directionalLight position={[3, 6, 3]} intensity={1.3} />
      <directionalLight position={[-2, 3, -2]} intensity={0.4} />
      <Environment preset="sunset" />
      <Suspense fallback={null}>
        <ModelPreview path={path} />
      </Suspense>
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        target={[0, 0.9, 0]}
        minPolarAngle={Math.PI / 5}
        maxPolarAngle={Math.PI / 2}
        autoRotate
        autoRotateSpeed={2.5}
      />
    </Canvas>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────
function CharacterSelect() {
  const {
    setGameState,
    selectedCharacterId, selectCharacter,
    selectedOutfitId, selectOutfit,
    unlockedCharacters, unlockedOutfits,
    totalCoinsEver,
  } = useGameStore();

  const [previewId, setPreviewId] = useState(selectedCharacterId);
  const previewChar = CHARACTERS.find(c => c.id === previewId) || CHARACTERS[0];

  const handleConfirm = () => {
    selectCharacter(previewId);
    setGameState('menu');
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col"
         style={{ background: 'linear-gradient(180deg, #0A0A0A 0%, #0A1208 100%)' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <button onClick={() => setGameState('menu')}
                className="text-[#D4A853] text-2xl w-10 h-10 flex items-center justify-center">
          ←
        </button>
        <h2 className="text-[#D4A853] font-black text-lg tracking-widest">CHARACTERS</h2>
        <div className="flex items-center gap-1 text-yellow-300 text-sm font-bold">
          <span>🪙</span><span>{totalCoinsEver}</span>
        </div>
      </div>

      {/* 3D Preview */}
      <div className="relative h-72 border-b border-white/10 bg-gradient-to-b from-[#1A2A10] to-[#0A0A0A]">
        <PreviewCanvas path={previewChar.path} />
        <div className="absolute bottom-2 left-0 right-0 text-center">
          <span className="text-[#D4A853] font-bold text-sm tracking-widest">{previewChar.name}</span>
          {!unlockedCharacters.includes(previewChar.id) && (
            <span className="ml-2 text-xs text-white/40">🪙 {previewChar.unlockCoins} to unlock</span>
          )}
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">

        {/* Character grid */}
        <div className="p-4">
          <p className="text-white/30 text-xs tracking-widest uppercase mb-3">Select Character</p>
          <div className="grid grid-cols-3 gap-2.5">
            {CHARACTERS.map(char => {
              const unlocked = unlockedCharacters.includes(char.id);
              const isPreviewed = char.id === previewId;
              const isSelected  = char.id === selectedCharacterId;
              return (
                <button
                  key={char.id}
                  onClick={() => setPreviewId(char.id)}
                  className={`
                    relative flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2
                    transition-all duration-150 active:scale-95
                    ${isPreviewed
                      ? 'border-[#D4A853] bg-[#D4A853]/15'
                      : unlocked
                        ? 'border-white/10 bg-white/5 hover:border-white/25'
                        : 'border-white/5 bg-white/3 opacity-55'}
                  `}
                >
                  <span className="text-2xl">{charEmoji(char.id)}</span>
                  <span className="text-[#F5E6C8] text-xs text-center leading-tight font-medium">{char.name}</span>
                  {!unlocked && (
                    <span className="text-[#D4A853] text-xs font-bold">🪙 {char.unlockCoins}</span>
                  )}
                  {unlocked && isSelected && (
                    <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#D4A853] flex items-center justify-center">
                      <span className="text-black text-xs font-black">✓</span>
                    </div>
                  )}
                  {!unlocked && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/20">
                      <span className="text-lg">🔒</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Outfit selector */}
        <div className="px-4 pb-4">
          <p className="text-white/30 text-xs tracking-widest uppercase mb-3">Outfit</p>
          <div className="flex gap-2.5 overflow-x-auto pb-1">
            {OUTFITS.map(outfit => {
              const unlocked = unlockedOutfits.includes(outfit.id);
              const isSelected = outfit.id === selectedOutfitId;
              return (
                <button
                  key={outfit.id}
                  onClick={() => unlocked && selectOutfit(outfit.id)}
                  className={`
                    flex-shrink-0 min-w-[76px] flex flex-col items-center gap-1.5 px-3 py-3
                    rounded-2xl border-2 transition-all duration-150 active:scale-95
                    ${isSelected
                      ? 'border-[#D4A853] bg-[#D4A853]/15'
                      : unlocked
                        ? 'border-white/10 bg-white/5 hover:border-white/25'
                        : 'border-white/5 bg-white/3 opacity-55'}
                  `}
                >
                  <span className="text-2xl">{outfitEmoji(outfit.id)}</span>
                  <span className="text-[#F5E6C8] text-xs font-medium">{outfit.name}</span>
                  {!unlocked && <span className="text-[#D4A853] text-xs">🪙 {outfit.unlockCoins}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Confirm */}
      <div className="p-4 border-t border-white/10">
        <button
          onClick={handleConfirm}
          disabled={!unlockedCharacters.includes(previewId)}
          className="w-full py-4 rounded-2xl font-black text-lg tracking-widest transition-all active:scale-95
                     disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg,#D4A853,#FF8C00)', color: '#000' }}
        >
          {unlockedCharacters.includes(previewId) ? 'THIBITISHA ✓' : '🔒 LOCKED'}
        </button>
      </div>
    </div>
  );
}

function charEmoji(id) {
  return {
    adventurer: '🧭', casual: '🚶', farmer: '👨‍🌾', hoodie: '🧥',
    worker: '👷', beach: '🏖️', punk: '🎸', businessman: '💼',
    swat: '🛡️', astronaut: '🚀', king: '👑',
  }[id] || '🧑';
}
function outfitEmoji(id) {
  return { male_peasant: '👘', female_peasant: '👗', male_ranger: '🥾', female_ranger: '🎽' }[id] || '👕';
}

export default CharacterSelect;
