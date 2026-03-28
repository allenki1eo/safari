import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { formatDistance, formatScore } from '../../utils/helpers';
import { MAX_LIVES } from '../../utils/constants';

function CoinPop({ amount, id, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 800);
    return () => clearTimeout(t);
  }, []);

  return (
    <span
      className="absolute text-[#FFD700] font-black text-sm pointer-events-none"
      style={{
        animation: 'coinPop 0.8s ease-out forwards',
        top: 0, right: 0,
      }}
    >
      +{amount}
    </span>
  );
}

function HUD() {
  const {
    score, distance, coins, lives, activePowerUp,
    powerUpEndTime, chainMultiplierActive, hasSeenSwipeHint,
    setHasSeenSwipeHint, setGameState, gameState,
  } = useGameStore();

  const [coinPops, setCoinPops] = useState([]);
  const prevCoinsRef = useRef(coins);
  const [showHint, setShowHint] = useState(false);
  const [powerUpProgress, setPowerUpProgress] = useState(1);

  // Show swipe hint on first play
  useEffect(() => {
    if (!hasSeenSwipeHint) {
      setShowHint(true);
      const t = setTimeout(() => {
        setShowHint(false);
        setHasSeenSwipeHint();
      }, 3000);
      return () => clearTimeout(t);
    }
  }, []);

  // Coin pop animation
  useEffect(() => {
    const diff = coins - prevCoinsRef.current;
    if (diff > 0) {
      const id = Date.now();
      setCoinPops(p => [...p, { id, amount: diff }]);
    }
    prevCoinsRef.current = coins;
  }, [coins]);

  // Power-up timer
  useEffect(() => {
    if (!activePowerUp) return;
    const interval = setInterval(() => {
      const remaining = (powerUpEndTime - Date.now()) / 8000;
      setPowerUpProgress(Math.max(0, remaining));
    }, 100);
    return () => clearInterval(interval);
  }, [activePowerUp, powerUpEndTime]);

  if (gameState !== 'playing' && gameState !== 'paused') return null;

  const powerUpLabel = { magnet: '🧲 MAGNET', shield: '🛡️ SHIELD', boost: '⚡ BOOST' };

  return (
    <div className="fixed inset-0 pointer-events-none z-30 select-none">
      {/* Top bar */}
      <div className="flex items-start justify-between px-4 pt-4">
        {/* Coins (top left) */}
        <div className="relative flex items-center gap-2 bg-black/50 rounded-full px-3 py-2">
          <span className="text-lg">🪙</span>
          <span className="text-[#FFD700] font-black text-base">{coins}</span>
          {coinPops.map(pop => (
            <CoinPop
              key={pop.id}
              amount={pop.amount}
              id={pop.id}
              onDone={() => setCoinPops(p => p.filter(x => x.id !== pop.id))}
            />
          ))}
        </div>

        {/* Score + Distance (top center) */}
        <div className="flex flex-col items-center gap-0.5 bg-black/50 rounded-xl px-4 py-2">
          <span className="text-[#D4A853] font-black text-xl leading-none">{formatScore(score)}</span>
          <span className="text-[#F5E6C8]/70 text-xs">{formatDistance(distance)}</span>
          {chainMultiplierActive && (
            <span className="text-[#FFD700] text-xs font-bold animate-pulse">×2 CHAIN!</span>
          )}
        </div>

        {/* Lives (top right) */}
        <div className="flex items-center gap-1 bg-black/50 rounded-full px-3 py-2">
          {Array.from({ length: MAX_LIVES }).map((_, i) => (
            <span key={i} className="text-lg" style={{ opacity: i < lives ? 1 : 0.2 }}>❤️</span>
          ))}
        </div>
      </div>

      {/* Power-up indicator (bottom center) */}
      {activePowerUp && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
          <span className="text-white font-bold text-sm bg-black/60 rounded-full px-4 py-1">
            {powerUpLabel[activePowerUp] || activePowerUp}
          </span>
          <div className="w-32 h-1.5 bg-black/40 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#D4A853] rounded-full transition-all duration-100"
              style={{ width: `${powerUpProgress * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Pause button */}
      <button
        className="absolute top-4 right-4 pointer-events-auto text-white/60 text-xl bg-black/30
                   rounded-full w-10 h-10 flex items-center justify-center hover:bg-black/50"
        onClick={() => setGameState('paused')}
        style={{ zIndex: 40 }}
      >
        ⏸
      </button>

      {/* Pause overlay */}
      {gameState === 'paused' && (
        <div className="fixed inset-0 bg-black/70 flex flex-col items-center justify-center pointer-events-auto z-50">
          <h2 className="text-[#D4A853] font-black text-4xl mb-8">PAUSED</h2>
          <div className="flex flex-col gap-4 w-48">
            <button
              onClick={() => setGameState('playing')}
              className="py-3 bg-[#D4A853] text-black font-black rounded-xl tracking-widest"
            >
              ▶ RESUME
            </button>
            <button
              onClick={() => setGameState('menu')}
              className="py-3 border-2 border-[#D4A853] text-[#D4A853] font-bold rounded-xl tracking-widest"
            >
              MAIN MENU
            </button>
          </div>
        </div>
      )}

      {/* Swipe hint overlay */}
      {showHint && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="bg-black/60 rounded-2xl px-8 py-6 flex flex-col items-center gap-3">
            <p className="text-white text-base font-bold">Swipe to run!</p>
            <div className="flex gap-6 text-3xl">
              <span>👆 Jump</span>
              <span>👇 Slide</span>
            </div>
            <div className="flex gap-6 text-3xl">
              <span>👈 Left</span>
              <span>👉 Right</span>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes coinPop {
          0% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-24px) scale(1.3); }
        }
      `}</style>
    </div>
  );
}

export default HUD;
