import { useRef, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../store/gameStore';

/**
 * Core game loop — runs every frame, updates distance/score,
 * checks timed states (invincibility, power-ups, coin chain).
 */
export function useGameLoop() {
  const store = useGameStore;
  const lastTimeRef = useRef(null);

  useFrame((state, delta) => {
    const { gameState, speed, addDistance, clearInvincibility,
            clearPowerUp, isInvincible, invincibilityEndTime,
            activePowerUp, powerUpEndTime,
            chainMultiplierActive, chainMultiplierEndTime } = useGameStore.getState();

    if (gameState !== 'playing') {
      lastTimeRef.current = null;
      return;
    }

    const now = Date.now();

    // Clamp delta to avoid spiral-of-death after tab switch
    const dt = Math.min(delta, 0.1);

    // Advance distance
    addDistance(speed * dt);

    // Clear invincibility
    if (isInvincible && now > invincibilityEndTime) {
      clearInvincibility();
    }

    // Clear power-up
    if (activePowerUp && now > powerUpEndTime) {
      clearPowerUp();
    }

    // Clear coin chain multiplier
    if (chainMultiplierActive && now > chainMultiplierEndTime) {
      useGameStore.setState({ chainMultiplierActive: false, coinChain: 0 });
    }
  });
}
