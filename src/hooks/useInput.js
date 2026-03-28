import { useEffect, useRef, useCallback } from 'react';

/**
 * Handles keyboard + touch/swipe input for game controls.
 * Returns a ref with the current input state, and calls
 * onLane(delta), onJump(), onSlide() callbacks.
 */
export function useInput({ onLaneChange, onJump, onSlide, enabled = true }) {
  const touchStartRef = useRef(null);
  const enabledRef = useRef(enabled);

  useEffect(() => { enabledRef.current = enabled; }, [enabled]);

  const handleKeyDown = useCallback((e) => {
    if (!enabledRef.current) return;
    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        e.preventDefault();
        onLaneChange?.(-1);
        break;
      case 'ArrowRight':
      case 'KeyD':
        e.preventDefault();
        onLaneChange?.(1);
        break;
      case 'ArrowUp':
      case 'KeyW':
      case 'Space':
        e.preventDefault();
        onJump?.();
        break;
      case 'ArrowDown':
      case 'KeyS':
        e.preventDefault();
        onSlide?.();
        break;
    }
  }, [onLaneChange, onJump, onSlide]);

  const handleTouchStart = useCallback((e) => {
    if (!enabledRef.current) return;
    const touch = e.changedTouches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
  }, []);

  const handleTouchEnd = useCallback((e) => {
    if (!enabledRef.current || !touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const dt = Date.now() - touchStartRef.current.time;
    touchStartRef.current = null;

    // Minimum swipe distance
    const minSwipe = 40;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (dt > 500) return; // too slow — not a swipe

    if (absDx > absDy && absDx > minSwipe) {
      onLaneChange?.(dx > 0 ? 1 : -1);
    } else if (absDy > absDx && absDy > minSwipe) {
      if (dy < 0) onJump?.();
      else onSlide?.();
    }
  }, [onLaneChange, onJump, onSlide]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleKeyDown, handleTouchStart, handleTouchEnd]);
}
