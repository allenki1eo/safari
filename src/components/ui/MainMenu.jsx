import { useGameStore } from '../../store/gameStore';
import { formatScore } from '../../utils/helpers';

function MainMenu() {
  const { setGameState, highScore } = useGameStore();

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center z-40"
         style={{ background: 'linear-gradient(180deg, #1A0800 0%, #0A1A0A 50%, #001A10 100%)' }}>

      {/* Animated background dots */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i}
            className="absolute rounded-full bg-[#D4A853] opacity-10"
            style={{
              width: `${Math.random() * 4 + 1}px`,
              height: `${Math.random() * 4 + 1}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `twinkle ${2 + Math.random() * 3}s ease-in-out ${Math.random() * 2}s infinite`,
            }}
          />
        ))}
      </div>

      {/* Logo */}
      <div className="relative z-10 flex flex-col items-center gap-2 mb-10">
        <div className="text-6xl mb-2">🌍</div>
        <h1
          className="text-8xl font-black tracking-widest text-[#D4A853]"
          style={{ textShadow: '0 0 40px rgba(212,168,83,0.6), 0 4px 12px rgba(0,0,0,0.9)' }}
        >
          SAFARI
        </h1>
        <p className="text-[#F5E6C8] text-xl tracking-widest opacity-70 mt-1">
          Kimbia! Usisimame.
        </p>
        {highScore > 0 && (
          <p className="text-[#D4A853] text-sm mt-3 opacity-80">
            Best: {formatScore(highScore)}
          </p>
        )}
      </div>

      {/* Buttons */}
      <div className="relative z-10 flex flex-col gap-4 w-64">
        <button
          onClick={() => setGameState('playing')}
          className="w-full py-4 bg-[#D4A853] text-[#0A0A0A] font-black text-xl rounded-xl tracking-widest
                     hover:bg-[#F5E6C8] active:scale-95 transition-all duration-150 shadow-lg shadow-[#D4A853]/30"
        >
          CHEZA ▶
        </button>

        <button
          onClick={() => setGameState('character_select')}
          className="w-full py-3 border-2 border-[#D4A853] text-[#D4A853] font-bold text-base rounded-xl
                     tracking-widest hover:bg-[#D4A853]/10 active:scale-95 transition-all duration-150"
        >
          CHARACTERS
        </button>

        <button
          onClick={() => setGameState('leaderboard')}
          className="w-full py-3 border-2 border-[#1A472A] text-[#F5E6C8] font-bold text-base rounded-xl
                     tracking-widest hover:bg-[#1A472A]/20 active:scale-95 transition-all duration-150"
        >
          LEADERBOARD
        </button>
      </div>

      {/* Subtitle */}
      <p className="relative z-10 text-[#F5E6C8]/30 text-xs mt-10 tracking-widest">
        TANZANIA WILDLIFE RUNNER
      </p>

      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.05; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(1.5); }
        }
      `}</style>
    </div>
  );
}

export default MainMenu;
