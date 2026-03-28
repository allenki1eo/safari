import { useGameStore } from '../../store/gameStore';
import { formatScore } from '../../utils/helpers';

/* Animated acacia silhouette */
function AcaciaSvg({ x, size, opacity, delay }) {
  return (
    <svg width={size} height={size * 0.8} viewBox="0 0 100 80" fill="none"
         style={{ position: 'absolute', bottom: 0, left: `${x}%`, opacity,
                  animation: `sway 4s ease-in-out ${delay}s infinite` }}>
      {/* trunk */}
      <rect x="46" y="45" width="8" height="35" fill="#2A1A08" />
      {/* flat canopy */}
      <ellipse cx="50" cy="42" rx="38" ry="14" fill="#1A4A1A" />
      <ellipse cx="50" cy="35" rx="28" ry="10" fill="#1E5A1E" />
    </svg>
  );
}

export default function MainMenu() {
  const { setGameState, startGame, highScore } = useGameStore();

  const acacias = [
    { x: 0, size: 120, opacity: 0.35, delay: 0 },
    { x: 12, size: 90, opacity: 0.25, delay: 0.8 },
    { x: 72, size: 110, opacity: 0.30, delay: 0.4 },
    { x: 85, size: 80, opacity: 0.20, delay: 1.2 },
  ];

  return (
    <div className="fixed inset-0 z-40 overflow-hidden"
         style={{ background: 'linear-gradient(180deg, #0D1A08 0%, #1A2A08 40%, #3A2800 75%, #5A3C00 100%)' }}>

      {/* Stars */}
      {Array.from({ length: 40 }).map((_, i) => (
        <div key={i} className="absolute rounded-full bg-white"
             style={{
               width: `${1 + Math.random() * 2}px`, height: `${1 + Math.random() * 2}px`,
               left: `${Math.random() * 100}%`, top: `${Math.random() * 55}%`,
               opacity: 0.3 + Math.random() * 0.5,
               animation: `twinkle ${2 + Math.random() * 4}s ease-in-out ${Math.random() * 3}s infinite`,
             }}
        />
      ))}

      {/* Moon */}
      <div className="absolute top-8 right-12 w-16 h-16 rounded-full"
           style={{ background: 'radial-gradient(circle at 35% 35%, #FFF8DC, #D4A853)', boxShadow: '0 0 30px #D4A85380' }} />

      {/* Silhouette ground strip */}
      <div className="absolute bottom-0 left-0 right-0 h-32"
           style={{ background: 'linear-gradient(0deg, #0A0A00 0%, #1A1400 60%, transparent 100%)' }}>
        {acacias.map((a, i) => <AcaciaSvg key={i} {...a} />)}
        {/* Giraffe silhouette */}
        <svg width="60" height="100" viewBox="0 0 60 100" fill="#1A1400"
             style={{ position: 'absolute', bottom: 0, right: '25%', opacity: 0.4 }}>
          <rect x="20" y="0" width="8" height="40" />   {/* neck */}
          <rect x="18" y="0" width="12" height="10" />  {/* head */}
          <rect x="10" y="38" width="38" height="22" /> {/* body */}
          <rect x="10" y="58" width="8" height="42" />  {/* leg */}
          <rect x="20" y="58" width="8" height="42" />
          <rect x="30" y="58" width="8" height="42" />
          <rect x="40" y="58" width="8" height="42" />
        </svg>
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full gap-2 pb-16">
        {/* Title */}
        <div className="flex flex-col items-center mb-6">
          <span className="text-6xl mb-1">🌍</span>
          <h1 className="text-8xl font-black tracking-[0.15em] leading-none"
              style={{
                color: '#D4A853',
                textShadow: '0 0 60px rgba(212,168,83,0.4), 0 4px 16px rgba(0,0,0,0.9)',
                fontFamily: 'Georgia, serif',
              }}>
            SAFARI
          </h1>
          <p className="text-[#F5E6C8]/60 text-lg tracking-[0.3em] mt-2 uppercase">
            Kimbia! Usisimame.
          </p>
          {highScore > 0 && (
            <div className="mt-3 px-4 py-1 rounded-full bg-[#D4A853]/10 border border-[#D4A853]/30">
              <span className="text-[#D4A853] text-sm font-bold">🏆 Best: {formatScore(highScore)}</span>
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex flex-col gap-3 w-64">
          <button
            onClick={() => startGame()}
            className="w-full py-4 rounded-2xl font-black text-xl tracking-widest
                       active:scale-95 transition-all duration-100 shadow-xl"
            style={{
              background: 'linear-gradient(135deg, #D4A853 0%, #FF8C00 100%)',
              color: '#0A0A0A',
              boxShadow: '0 8px 24px rgba(212,168,83,0.4)',
            }}
          >
            ▶ PLAY
          </button>

          <button
            onClick={() => setGameState('character_select')}
            className="w-full py-3 rounded-2xl font-bold text-sm tracking-widest
                       border-2 border-[#D4A853]/50 text-[#D4A853] bg-[#D4A853]/5
                       hover:bg-[#D4A853]/15 active:scale-95 transition-all duration-100"
          >
            👤 CHARACTERS
          </button>

          <button
            onClick={() => setGameState('leaderboard')}
            className="w-full py-3 rounded-2xl font-bold text-sm tracking-widest
                       border-2 border-white/10 text-white/60 bg-white/5
                       hover:bg-white/10 active:scale-95 transition-all duration-100"
          >
            🏆 LEADERBOARD
          </button>
        </div>

        <p className="text-white/20 text-xs tracking-[0.4em] mt-4 uppercase">
          Tanzania Wildlife Runner
        </p>
      </div>

      <style>{`
        @keyframes twinkle {
          0%,100% { opacity:.15; transform:scale(1); }
          50% { opacity:.7; transform:scale(1.4); }
        }
        @keyframes sway {
          0%,100% { transform: rotate(-1deg); }
          50% { transform: rotate(1deg); }
        }
      `}</style>
    </div>
  );
}
