import { useEffect, useRef } from 'react';
import { useGLTF, useTexture } from '@react-three/drei';
import { useGameStore } from '../../store/gameStore';
import { ALL_GLTF_PATHS, ALL_TEXTURE_PATHS } from '../../utils/assetManifest';

// Trigger preloads at module level
ALL_GLTF_PATHS.forEach(path => {
  try { useGLTF.preload(path); } catch (e) { /* ignore */ }
});

function LoadingScreen() {
  const { loadingProgress, setLoadingProgress, setGameState } = useGameStore();
  const loadedRef = useRef(0);
  const totalRef = useRef(ALL_GLTF_PATHS.length + ALL_TEXTURE_PATHS.length);

  useEffect(() => {
    let isMounted = true;
    const total = totalRef.current;

    const onLoad = () => {
      if (!isMounted) return;
      loadedRef.current++;
      const pct = Math.round((loadedRef.current / total) * 100);
      setLoadingProgress(Math.min(pct, 99));
    };

    const promises = [];

    // Load GLTFs
    for (const path of ALL_GLTF_PATHS) {
      promises.push(
        new Promise(resolve => {
          useGLTF.preload(path);
          // Poll for load using a tiny timeout chain
          const check = () => {
            const cached = useGLTF.cache?.get?.(path);
            if (cached) { onLoad(); resolve(); }
            else setTimeout(check, 100);
          };
          setTimeout(check, 200);
          // Fallback resolve after 5s per asset
          setTimeout(() => { onLoad(); resolve(); }, 5000);
        })
      );
    }

    // Load textures
    for (const path of ALL_TEXTURE_PATHS) {
      promises.push(
        new Promise(resolve => {
          const img = new Image();
          img.onload = () => { onLoad(); resolve(); };
          img.onerror = () => { onLoad(); resolve(); };
          img.src = path;
        })
      );
    }

    Promise.all(promises).then(() => {
      if (!isMounted) return;
      setLoadingProgress(100);
      setTimeout(() => {
        if (isMounted) setGameState('menu');
      }, 600);
    });

    // Hard cap: 15s max loading time
    const maxTimer = setTimeout(() => {
      if (isMounted) {
        setLoadingProgress(100);
        setGameState('menu');
      }
    }, 15000);

    return () => {
      isMounted = false;
      clearTimeout(maxTimer);
    };
  }, []);

  const animalSilhouettes = ['🦬', '🦌', '🐺', '🐕', '🐴'];

  return (
    <div className="fixed inset-0 bg-[#0A0A0A] flex flex-col items-center justify-center z-50">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#1A0A00] via-[#0A0A0A] to-[#001A0A] opacity-90" />

      {/* Animal silhouettes */}
      <div className="absolute bottom-0 left-0 right-0 h-24 flex items-end justify-around px-8 opacity-20">
        {animalSilhouettes.map((emoji, i) => (
          <span
            key={i}
            className="text-5xl"
            style={{
              filter: 'brightness(0)',
              animation: `bounce 1.5s ease-in-out ${i * 0.2}s infinite`,
              transform: `scale(${0.8 + i * 0.1})`,
            }}
          >
            {emoji}
          </span>
        ))}
      </div>

      <div className="relative z-10 flex flex-col items-center gap-8 px-8 w-full max-w-md">
        {/* Logo */}
        <div className="text-center">
          <h1 className="text-7xl font-black tracking-wider text-[#D4A853] drop-shadow-2xl"
              style={{ textShadow: '0 0 30px rgba(212,168,83,0.5), 0 4px 8px rgba(0,0,0,0.8)' }}>
            SAFARI
          </h1>
          <p className="text-[#F5E6C8] text-lg mt-2 tracking-widest opacity-80">
            Kimbia! Usisimame.
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-full">
          <div className="flex justify-between text-xs text-[#D4A853] mb-2 font-mono">
            <span>Inapakia...</span>
            <span>{loadingProgress}%</span>
          </div>
          <div className="w-full h-3 bg-[#1A1A1A] rounded-full overflow-hidden border border-[#D4A853]/30">
            <div
              className="h-full bg-gradient-to-r from-[#8B2500] via-[#D4A853] to-[#F5E6C8] rounded-full transition-all duration-300"
              style={{ width: `${loadingProgress}%` }}
            />
          </div>
        </div>

        {/* Flavor text */}
        <p className="text-[#F5E6C8]/50 text-sm text-center">
          {loadingProgress < 30 && 'Preparing the Serengeti...'}
          {loadingProgress >= 30 && loadingProgress < 60 && 'Waking the wildlife...'}
          {loadingProgress >= 60 && loadingProgress < 90 && 'Packing your safari gear...'}
          {loadingProgress >= 90 && 'Ready to run!'}
        </p>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
      `}</style>
    </div>
  );
}

export default LoadingScreen;
