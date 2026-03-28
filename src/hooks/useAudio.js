import { useRef, useEffect, useCallback } from 'react';
import { Howl, Howler } from 'howler';

// Singleton audio instances
const audioCache = {};

function getOrCreate(key, config) {
  if (!audioCache[key]) {
    try {
      audioCache[key] = new Howl(config);
    } catch (e) {
      console.warn(`Audio failed to load: ${key}`);
    }
  }
  return audioCache[key];
}

export function useAudio() {
  const bgMusicRef = useRef(null);

  const playBgMusic = useCallback((biome = 'serengeti') => {
    // Stub — actual music files would go in /public/audio/music/
    // We create silent placeholder Howls to avoid errors when files are absent
    if (bgMusicRef.current) {
      bgMusicRef.current.stop();
    }
    // No music files in the project yet — silently skip
  }, []);

  const stopBgMusic = useCallback(() => {
    bgMusicRef.current?.stop();
  }, []);

  const playSfx = useCallback((name) => {
    // SFX stubs — will play if files exist in /public/audio/sfx/
    const sfxMap = {
      coin: '/audio/sfx/coin.mp3',
      jump: '/audio/sfx/jump.mp3',
      hit: '/audio/sfx/hit.mp3',
      powerup: '/audio/sfx/powerup.mp3',
      gameover: '/audio/sfx/gameover.mp3',
    };
    const path = sfxMap[name];
    if (!path) return;
    // Only attempt if file might exist (suppress errors gracefully)
    try {
      const sfx = getOrCreate(name, { src: [path], volume: 0.4, preload: false });
      sfx?.play();
    } catch (e) { /* silent fail */ }
  }, []);

  const setMasterVolume = useCallback((vol) => {
    Howler.volume(vol);
  }, []);

  return { playBgMusic, stopBgMusic, playSfx, setMasterVolume };
}
