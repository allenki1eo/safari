import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CHARACTERS, OUTFITS } from '../utils/assetManifest';
import { MAX_LIVES, STARTING_SPEED } from '../utils/constants';

const getInitialCharacter = () => CHARACTERS.find(c => c.free) || CHARACTERS[0];
const getInitialOutfit = () => OUTFITS.find(o => o.free) || OUTFITS[0];

// Persisted slice (localStorage)
const persistedStore = (set, get) => ({
  highScore: 0,
  totalCoinsEver: 0,
  unlockedCharacters: [getInitialCharacter().id],
  unlockedOutfits: [getInitialOutfit().id],
  selectedCharacterId: getInitialCharacter().id,
  selectedOutfitId: getInitialOutfit().id,
  hasSeenSwipeHint: false,
  playerName: '',

  setPlayerName: (name) => set({ playerName: name }),
  setHasSeenSwipeHint: () => set({ hasSeenSwipeHint: true }),

  selectCharacter: (id) => {
    const { unlockedCharacters } = get();
    if (unlockedCharacters.includes(id)) set({ selectedCharacterId: id });
  },

  selectOutfit: (id) => {
    const { unlockedOutfits } = get();
    if (unlockedOutfits.includes(id)) set({ selectedOutfitId: id });
  },

  unlockCharacter: (id) => {
    const { unlockedCharacters } = get();
    if (!unlockedCharacters.includes(id)) {
      set({ unlockedCharacters: [...unlockedCharacters, id] });
    }
  },

  unlockOutfit: (id) => {
    const { unlockedOutfits } = get();
    if (!unlockedOutfits.includes(id)) {
      set({ unlockedOutfits: [...unlockedOutfits, id] });
    }
  },

  addTotalCoins: (amount) => {
    const { totalCoinsEver, unlockedCharacters, unlockedOutfits } = get();
    const newTotal = totalCoinsEver + amount;

    // Auto-unlock characters and outfits at milestones
    const newChars = [...unlockedCharacters];
    const newOutfits = [...unlockedOutfits];

    for (const c of CHARACTERS) {
      if (c.unlockCoins && newTotal >= c.unlockCoins && !newChars.includes(c.id)) {
        newChars.push(c.id);
      }
    }
    for (const o of OUTFITS) {
      if (o.unlockCoins && newTotal >= o.unlockCoins && !newOutfits.includes(o.id)) {
        newOutfits.push(o.id);
      }
    }

    set({ totalCoinsEver: newTotal, unlockedCharacters: newChars, unlockedOutfits: newOutfits });
  },

  updateHighScore: (score) => {
    const { highScore } = get();
    if (score > highScore) set({ highScore: score });
  },
});

// Session slice (not persisted)
const sessionSlice = (set, get) => ({
  gameState: 'loading', // 'loading' | 'menu' | 'character_select' | 'playing' | 'paused' | 'gameover'
  score: 0,
  distance: 0,
  coins: 0,
  lives: MAX_LIVES,
  speed: STARTING_SPEED,
  currentBiome: 'serengeti',
  activePowerUp: null,
  powerUpEndTime: 0,
  isInvincible: false,
  invincibilityEndTime: 0,
  coinChain: 0,
  chainMultiplierActive: false,
  chainMultiplierEndTime: 0,
  loadingProgress: 0,
  isNewHighScore: false,

  setGameState: (state) => set({ gameState: state }),
  setLoadingProgress: (p) => set({ loadingProgress: p }),

  startGame: () => set({
    gameState: 'playing',
    score: 0,
    distance: 0,
    coins: 0,
    lives: MAX_LIVES,
    speed: STARTING_SPEED,
    currentBiome: 'serengeti',
    activePowerUp: null,
    powerUpEndTime: 0,
    isInvincible: false,
    invincibilityEndTime: 0,
    coinChain: 0,
    chainMultiplierActive: false,
    chainMultiplierEndTime: 0,
    isNewHighScore: false,
  }),

  pauseGame: () => set({ gameState: 'paused' }),
  resumeGame: () => set({ gameState: 'playing' }),

  addScore: (points) => set(s => ({ score: s.score + points * (s.chainMultiplierActive ? 2 : 1) })),
  addDistance: (d) => {
    const state = get();
    const newDist = state.distance + d;
    const newScore = state.score + d; // 1 pt per meter

    // Speed increase every 200m
    const newSpeed = state.speed + Math.floor(newDist / 200) * 0.5 - Math.floor(state.distance / 200) * 0.5;

    // Biome transition every 500m
    const biomeIndex = Math.floor(newDist / 500) % 3;
    const biomes = ['serengeti', 'kilimanjaro', 'zanzibar'];
    const newBiome = biomes[biomeIndex];

    set({ distance: newDist, score: newScore, speed: Math.max(state.speed, newSpeed), currentBiome: newBiome });
  },

  collectCoin: () => {
    const state = get();
    const newChain = state.coinChain + 1;
    const isChaining = newChain >= 10;
    const now = Date.now();
    set({
      coins: state.coins + 1,
      score: state.score + 10 * (state.chainMultiplierActive ? 2 : 1),
      coinChain: newChain,
      chainMultiplierActive: isChaining || state.chainMultiplierActive,
      chainMultiplierEndTime: isChaining ? now + 5000 : state.chainMultiplierEndTime,
    });
  },

  collectGem: () => {
    set(s => ({ score: s.score + 50, coins: s.coins + 5 }));
  },

  takeDamage: () => {
    const { lives, isInvincible } = get();
    if (isInvincible) return;
    const newLives = lives - 1;
    if (newLives <= 0) {
      get().endGame();
    } else {
      set({
        lives: newLives,
        isInvincible: true,
        invincibilityEndTime: Date.now() + 2000,
        coinChain: 0,
        chainMultiplierActive: false,
      });
    }
  },

  clearInvincibility: () => set({ isInvincible: false }),

  activatePowerUp: (type) => {
    set({ activePowerUp: type, powerUpEndTime: Date.now() + 8000 });
  },

  clearPowerUp: () => set({ activePowerUp: null, powerUpEndTime: 0 }),

  endGame: () => {
    const { score, distance, coins } = get();
    get().updateHighScore(score);
    get().addTotalCoins(coins);
    const isNewHigh = score > get().highScore;
    set({ gameState: 'gameover', isNewHighScore: isNewHigh });
  },
});

export const useGameStore = create(
  persist(
    (set, get) => ({
      ...persistedStore(set, get),
      ...sessionSlice(set, get),
    }),
    {
      name: 'safari-game',
      partialize: (state) => ({
        highScore: state.highScore,
        totalCoinsEver: state.totalCoinsEver,
        unlockedCharacters: state.unlockedCharacters,
        unlockedOutfits: state.unlockedOutfits,
        selectedCharacterId: state.selectedCharacterId,
        selectedOutfitId: state.selectedOutfitId,
        hasSeenSwipeHint: state.hasSeenSwipeHint,
        playerName: state.playerName,
      }),
    }
  )
);
