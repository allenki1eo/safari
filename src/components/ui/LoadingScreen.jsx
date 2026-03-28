import { useEffect, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { useGameStore } from '../../store/gameStore';
import { ALL_GLTF_PATHS, ALL_TEXTURE_PATHS } from '../../utils/assetManifest';

// Kick off preloads immediately at module load
ALL_GLTF_PATHS.forEach(p => { try { useGLTF.preload(p); } catch (_) {} });

function LoadingScreen() {
  const { loadingProgress, setLoadingProgress, setGameState } = useGameStore();
  const doneRef = useRef(false);

  useEffect(() => {
    if (doneRef.current) return;
    doneRef.current = true;

    const total = ALL_GLTF_PATHS.length + ALL_TEXTURE_PATHS.length;
    let loaded = 0;

    const onOne = () => {
      loaded++;
      setLoadingProgress(Math.min(Math.round((loaded / total) * 100), 99));
      if (loaded >= total) finish();
    };

    const finish = () => {
      setLoadingProgress(100);
      setTimeout(() => setGameState('menu'), 500);
    };

    // Texture loads (Image elements — fast)
    ALL_TEXTURE_PATHS.forEach(path => {
      const img = new Image();
      img.onload = img.onerror = onOne;
      img.src = path;
    });

    // GLTF loads — use fetch to detect when file is cached by browser
    ALL_GLTF_PATHS.forEach(path => {
      fetch(path, { method: 'HEAD' })
        .then(onOne)
        .catch(onOne);
    });

    // Hard cap — never leave user stuck
    const cap = setTimeout(finish, 12000);
    return () => clearTimeout(cap);
  }, []);

  const messages = [
    'Preparing the Serengeti...',
    'Waking the wildlife...',
    'Packing safari gear...',
    'Almost ready!',
  ];
  const msgIdx = Math.min(Math.floor(loadingProgress / 25), messages.length - 1);

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center z-50"
         style={{ background: 'linear-gradient(180deg, #0D1A08 0%, #1A2A08 40%, #3A2800 80%, #5A3C00 100%)' }}>

      {/* Stars */}
      {Array.from({ length: 30 }).map((_, i) => (
        <div key={i} className="absolute rounded-full bg-white"
             style={{
               width: `${1 + (i % 3)}px`, height: `${1 + (i % 3)}px`,
               left: `${(i * 37) % 100}%`, top: `${(i * 23) % 60}%`,
               opacity: 0.2 + (i % 5) * 0.1,
               animation: `twinkle ${2 + (i % 4)}s ease-in-out ${(i % 3) * 0.5}s infinite`,
             }}
        />
      ))}

      {/* Moon */}
      <div className="absolute top-8 right-16 w-12 h-12 rounded-full"
           style={{ background: 'radial-gradient(circle at 35% 35%, #FFF8DC, #D4A853)', boxShadow: '0 0 20px #D4A85350' }} />

      {/* Animal silhouettes at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-20 flex items-end justify-around px-12 pointer-events-none">
        {['🦬','🦌','🐺','🐴','🐕'].map((e, i) => (
          <span key={i} className="text-4xl"
                style={{
                  filter: 'brightness(0)',
                  opacity: 0.3,
                  animation: `bounce 1.4s ease-in-out ${i * 0.18}s infinite`,
                }}>
            {e}
          </span>
        ))}
      </div>

      {/* Logo + bar */}
      <div className="relative z-10 flex flex-col items-center gap-6 w-full max-w-xs px-8">
        <div className="text-center">
          <div className="text-5xl mb-2">🌍</div>
          <h1 className="text-7xl font-black tracking-widest"
              style={{ color: '#D4A853', textShadow: '0 0 40px rgba(212,168,83,0.5)', fontFamily: 'Georgia,serif' }}>
            SAFARI
          </h1>
          <p className="text-[#F5E6C8]/60 tracking-widest mt-1 text-sm">Kimbia! Usisimame.</p>
        </div>

        <div className="w-full">
          <div className="flex justify-between text-xs mb-1.5" style={{ color: '#D4A853' }}>
            <span>Inapakia...</span>
            <span>{loadingProgress}%</span>
          </div>
          <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div className="h-full rounded-full transition-all duration-300"
                 style={{
                   width: `${loadingProgress}%`,
                   background: 'linear-gradient(90deg, #8B2500, #D4A853, #F5E6C8)',
                 }} />
          </div>
          <p className="text-center text-xs mt-2" style={{ color: 'rgba(245,230,200,0.4)' }}>
            {messages[msgIdx]}
          </p>
        </div>
      </div>

      <style>{`
        @keyframes twinkle { 0%,100%{opacity:.1} 50%{opacity:.6} }
        @keyframes bounce  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
      `}</style>
    </div>
  );
}

export default LoadingScreen;
