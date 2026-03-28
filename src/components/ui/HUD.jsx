import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { formatDistance, formatScore } from '../../utils/helpers';
import { MAX_LIVES } from '../../utils/constants';

/* ── floating +N pop ──────────────────────────────────── */
function CoinPop({ amount, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 700);
    return () => clearTimeout(t);
  }, []);
  return (
    <span className="absolute right-0 top-0 text-yellow-300 font-black text-xs pointer-events-none"
          style={{ animation: 'coinPop 0.7s ease-out forwards' }}>
      +{amount}
    </span>
  );
}

/* ── top pill badge ───────────────────────────────────── */
function Pill({ children, className = '' }) {
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-sm
                     bg-black/50 border border-white/10 shadow-lg ${className}`}>
      {children}
    </div>
  );
}

/* ── main HUD ─────────────────────────────────────────── */
function HUD() {
  const {
    score, distance, coins, lives,
    activePowerUp, powerUpEndTime,
    chainMultiplierActive, coinChain,
    hasSeenSwipeHint, setHasSeenSwipeHint,
    setGameState, gameState,
  } = useGameStore();

  const [coinPops, setCoinPops] = useState([]);
  const prevCoinsRef = useRef(coins);
  const [showHint, setShowHint] = useState(false);
  const [puProgress, setPuProgress] = useState(1);

  /* swipe hint */
  useEffect(() => {
    if (!hasSeenSwipeHint) {
      setShowHint(true);
      const t = setTimeout(() => { setShowHint(false); setHasSeenSwipeHint(); }, 3500);
      return () => clearTimeout(t);
    }
  }, []);

  /* coin pop */
  useEffect(() => {
    const diff = coins - prevCoinsRef.current;
    if (diff > 0) setCoinPops(p => [...p, { id: Date.now(), amount: diff }]);
    prevCoinsRef.current = coins;
  }, [coins]);

  /* power-up progress */
  useEffect(() => {
    if (!activePowerUp) { setPuProgress(1); return; }
    const iv = setInterval(() => {
      const r = Math.max(0, (powerUpEndTime - Date.now()) / 8000);
      setPuProgress(r);
    }, 80);
    return () => clearInterval(iv);
  }, [activePowerUp, powerUpEndTime]);

  const isVisible = gameState === 'playing' || gameState === 'paused';
  if (!isVisible) return null;

  const puLabel  = { magnet: '🧲 Magnet', shield: '🛡️ Shield', boost: '⚡ Boost' };
  const puColors = { magnet: '#FF69B4', shield: '#00FF7F', boost: '#FF8C00' };

  return (
    <div className="fixed inset-0 pointer-events-none z-30 select-none">

      {/* ── top row ── */}
      <div className="absolute top-0 left-0 right-0 flex items-start justify-between p-3 gap-2">

        {/* COINS ─ left */}
        <Pill>
          <span className="text-base leading-none">🪙</span>
          <span className="text-yellow-300 font-black text-sm tabular-nums min-w-[28px]">{coins}</span>
          {coinPops.map(p => (
            <CoinPop key={p.id} amount={p.amount} onDone={() => setCoinPops(q => q.filter(x => x.id !== p.id))} />
          ))}
        </Pill>

        {/* SCORE ─ center */}
        <div className="flex flex-col items-center gap-0.5">
          <div className="px-4 py-1.5 rounded-2xl bg-black/50 border border-white/10 backdrop-blur-sm shadow-lg
                          flex flex-col items-center">
            <span className="text-white font-black text-2xl leading-none tabular-nums"
                  style={{ textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>
              {formatScore(score)}
            </span>
            <span className="text-white/50 text-xs leading-none mt-0.5">{formatDistance(distance)}</span>
          </div>
          {chainMultiplierActive && (
            <div className="px-2 py-0.5 rounded-full bg-orange-500/80 border border-orange-300/30 mt-1">
              <span className="text-white font-black text-xs">×2 CHAIN {coinChain}</span>
            </div>
          )}
        </div>

        {/* LIVES ─ right */}
        <Pill>
          {Array.from({ length: MAX_LIVES }).map((_, i) => (
            <span key={i} className="text-base leading-none transition-all"
                  style={{ opacity: i < lives ? 1 : 0.2, filter: i < lives ? 'none' : 'grayscale(1)' }}>
              ❤️
            </span>
          ))}
        </Pill>
      </div>

      {/* ── power-up bar ─ bottom center ── */}
      {activePowerUp && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5">
          <div className="px-4 py-1.5 rounded-full bg-black/60 border border-white/10 backdrop-blur-sm">
            <span className="text-white font-bold text-sm">{puLabel[activePowerUp] || activePowerUp}</span>
          </div>
          {/* Arc progress bar */}
          <div className="w-28 h-2 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-100"
                 style={{ width: `${puProgress * 100}%`, background: puColors[activePowerUp] || '#fff' }} />
          </div>
        </div>
      )}

      {/* ── pause button ── */}
      <button
        className="absolute top-3 right-3 pointer-events-auto w-9 h-9 rounded-full
                   bg-black/50 border border-white/10 flex items-center justify-center
                   text-white/70 text-sm hover:bg-black/70 active:scale-90 transition-all"
        onClick={() => setGameState(gameState === 'paused' ? 'playing' : 'paused')}
      >
        {gameState === 'paused' ? '▶' : '⏸'}
      </button>

      {/* ── pause overlay ── */}
      {gameState === 'paused' && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center
                        pointer-events-auto z-50">
          <div className="flex flex-col items-center gap-5 w-56">
            <h2 className="text-[#D4A853] font-black text-5xl tracking-wider">⏸</h2>
            <h3 className="text-white font-black text-2xl tracking-widest">PAUSED</h3>
            <button
              onClick={() => setGameState('playing')}
              className="w-full py-3.5 bg-[#D4A853] text-black font-black text-base rounded-2xl
                         tracking-widest hover:bg-yellow-300 active:scale-95 transition-all shadow-lg"
            >
              ▶ RESUME
            </button>
            <button
              onClick={() => setGameState('menu')}
              className="w-full py-3 border-2 border-white/20 text-white/80 font-bold rounded-2xl
                         tracking-widest hover:border-white/40 active:scale-95 transition-all"
            >
              MAIN MENU
            </button>
          </div>
        </div>
      )}

      {/* ── swipe hint ── */}
      {showHint && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/70 rounded-3xl px-8 py-6 flex flex-col items-center gap-4
                          border border-white/10 backdrop-blur-sm"
               style={{ animation: 'fadeInOut 3.5s ease-in-out forwards' }}>
            <p className="text-white font-bold text-base tracking-wide">How to play</p>
            <div className="grid grid-cols-2 gap-4">
              {[['👆', 'Swipe Up', 'Jump'], ['👇', 'Swipe Down', 'Slide'],
                ['👈', 'Swipe Left', 'Lane left'], ['👉', 'Swipe Right', 'Lane right']].map(([icon, label, sub]) => (
                <div key={label} className="flex flex-col items-center gap-1">
                  <span className="text-3xl">{icon}</span>
                  <span className="text-white text-xs font-bold">{label}</span>
                  <span className="text-white/40 text-xs">{sub}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes coinPop {
          0%   { opacity:1; transform: translateY(0)   scale(1); }
          100% { opacity:0; transform: translateY(-20px) scale(1.2); }
        }
        @keyframes fadeInOut {
          0%   { opacity:0; transform: scale(0.9); }
          15%  { opacity:1; transform: scale(1); }
          80%  { opacity:1; }
          100% { opacity:0; }
        }
      `}</style>
    </div>
  );
}

export default HUD;
