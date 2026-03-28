import { useGameStore } from '../../store/gameStore';
import { formatScore, formatDistance } from '../../utils/helpers';
import { submitScore } from '../../utils/supabase';
import { useState } from 'react';

function GameOver() {
  const {
    score, distance, coins, highScore, isNewHighScore,
    setGameState, startGame, playerName, setPlayerName,
  } = useGameStore();

  const [nameInput, setNameInput] = useState(playerName || '');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const selectedCharacterId = useGameStore(s => s.selectedCharacterId);

  const handleSubmitScore = async () => {
    if (!nameInput.trim()) return;
    setSubmitting(true);
    setPlayerName(nameInput.trim());
    try {
      await submitScore({
        player_name: nameInput.trim(),
        score,
        distance: Math.floor(distance),
        coins,
        character_id: selectedCharacterId,
      });
      setSubmitted(true);
    } catch (e) {
      console.warn('Score submission failed:', e);
      setSubmitted(true); // Don't block the user
    }
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6"
         style={{ background: 'linear-gradient(180deg, #200000 0%, #0A0A0A 100%)' }}>

      {/* Title */}
      <div className="text-center mb-6">
        <div className="text-5xl mb-3">💀</div>
        <h1 className="text-4xl font-black text-[#D4A853] tracking-widest mb-1">
          Mchezo Umisha!
        </h1>
        <p className="text-[#F5E6C8]/60 text-sm">Game Over</p>
        {isNewHighScore && (
          <p className="text-[#FFD700] font-bold mt-2 animate-bounce">🏆 NEW BEST SCORE!</p>
        )}
      </div>

      {/* Stats */}
      <div className="w-full max-w-sm bg-black/40 rounded-2xl p-5 mb-6 border border-[#D4A853]/20">
        <div className="grid grid-cols-2 gap-4">
          <StatBlock label="SCORE" value={formatScore(score)} icon="⭐" highlight />
          <StatBlock label="DISTANCE" value={formatDistance(distance)} icon="📏" />
          <StatBlock label="COINS" value={coins} icon="🪙" />
          <StatBlock label="BEST" value={formatScore(highScore)} icon="🏆" />
        </div>
      </div>

      {/* Leaderboard submission */}
      {!submitted ? (
        <div className="w-full max-w-sm mb-4 flex flex-col gap-2">
          <p className="text-[#F5E6C8]/60 text-xs text-center">Submit your score to the leaderboard</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={nameInput}
              onChange={e => setNameInput(e.target.value.slice(0, 20))}
              placeholder="Your name..."
              maxLength={20}
              className="flex-1 bg-black/60 border border-[#D4A853]/30 text-white rounded-lg px-3 py-2
                         text-sm focus:outline-none focus:border-[#D4A853] placeholder-white/30"
            />
            <button
              onClick={handleSubmitScore}
              disabled={!nameInput.trim() || submitting}
              className="px-4 py-2 bg-[#D4A853] text-black font-bold rounded-lg text-sm
                         disabled:opacity-40 hover:bg-[#F5E6C8] active:scale-95 transition-all"
            >
              {submitting ? '...' : '↑'}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-[#D4A853] text-sm mb-4">✓ Score submitted!</p>
      )}

      {/* Action buttons */}
      <div className="w-full max-w-sm flex flex-col gap-3">
        <button
          onClick={() => startGame()}
          className="w-full py-4 bg-[#D4A853] text-black font-black text-xl rounded-xl
                     tracking-widest hover:bg-[#F5E6C8] active:scale-95 transition-all"
        >
          CHEZA TENA ↺
        </button>
        <div className="flex gap-3">
          <button
            onClick={() => setGameState('character_select')}
            className="flex-1 py-3 border-2 border-[#D4A853] text-[#D4A853] font-bold rounded-xl
                       tracking-widest hover:bg-[#D4A853]/10 active:scale-95 transition-all"
          >
            CHANGE
          </button>
          <button
            onClick={() => setGameState('leaderboard')}
            className="flex-1 py-3 border-2 border-[#1A472A] text-[#F5E6C8] font-bold rounded-xl
                       tracking-widest hover:bg-[#1A472A]/20 active:scale-95 transition-all"
          >
            SCORES
          </button>
        </div>
      </div>
    </div>
  );
}

function StatBlock({ label, value, icon, highlight }) {
  return (
    <div className={`flex flex-col items-center p-3 rounded-xl ${highlight ? 'bg-[#D4A853]/10' : 'bg-white/5'}`}>
      <span className="text-xl mb-1">{icon}</span>
      <span className={`font-black text-xl ${highlight ? 'text-[#D4A853]' : 'text-white'}`}>{value}</span>
      <span className="text-[#F5E6C8]/40 text-xs tracking-widest">{label}</span>
    </div>
  );
}

export default GameOver;
