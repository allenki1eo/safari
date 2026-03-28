import { useEffect, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { getTopScores } from '../../utils/supabase';
import { formatScore, formatDistance } from '../../utils/helpers';

function Leaderboard() {
  const { setGameState, playerName, highScore } = useGameStore();
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    getTopScores()
      .then(data => { setScores(data || []); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  return (
    <div className="fixed inset-0 z-40 flex flex-col"
         style={{ background: 'linear-gradient(180deg, #0A0A0A 0%, #0A100A 100%)' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#D4A853]/20">
        <button onClick={() => setGameState('menu')} className="text-[#D4A853] text-2xl px-2">←</button>
        <h2 className="text-[#D4A853] font-black text-xl tracking-widest">LEADERBOARD</h2>
        <div className="w-8" />
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading && (
          <div className="flex justify-center mt-20">
            <div className="text-[#D4A853] animate-pulse text-lg">Inapakia...</div>
          </div>
        )}

        {error && (
          <div className="text-center mt-20">
            <p className="text-[#F5E6C8]/50 text-sm">Could not load leaderboard</p>
            <p className="text-[#F5E6C8]/30 text-xs mt-1">Check your connection</p>
          </div>
        )}

        {!loading && !error && scores.length === 0 && (
          <div className="text-center mt-20">
            <p className="text-[#F5E6C8]/50 text-sm">No scores yet. Be the first!</p>
          </div>
        )}

        {!loading && scores.length > 0 && (
          <div className="flex flex-col gap-2">
            {scores.map((entry, index) => {
              const isPlayer = entry.player_name === playerName;
              const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : null;
              return (
                <div
                  key={entry.id || index}
                  className={`
                    flex items-center gap-3 p-3 rounded-xl border
                    ${isPlayer ? 'border-[#D4A853] bg-[#D4A853]/10' : 'border-[#222] bg-black/30'}
                  `}
                >
                  <div className="w-8 text-center">
                    {medal ? (
                      <span className="text-xl">{medal}</span>
                    ) : (
                      <span className="text-[#F5E6C8]/40 text-sm font-mono">#{index + 1}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold truncate text-sm ${isPlayer ? 'text-[#D4A853]' : 'text-white'}`}>
                      {entry.player_name}
                      {isPlayer && <span className="text-xs ml-1 opacity-70">(you)</span>}
                    </p>
                    <p className="text-[#F5E6C8]/40 text-xs">{formatDistance(entry.distance)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[#D4A853] font-black text-base">{formatScore(entry.score)}</p>
                    <p className="text-[#F5E6C8]/40 text-xs">🪙 {entry.coins}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Local high score */}
        <div className="mt-6 p-4 bg-[#1A472A]/20 border border-[#1A472A]/40 rounded-xl text-center">
          <p className="text-[#F5E6C8]/50 text-xs mb-1">YOUR BEST</p>
          <p className="text-[#D4A853] font-black text-2xl">{formatScore(highScore)}</p>
        </div>
      </div>
    </div>
  );
}

export default Leaderboard;
