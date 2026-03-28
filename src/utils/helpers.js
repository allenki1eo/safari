import { LANES, LANE_LEFT, LANE_CENTER, LANE_RIGHT } from './constants';

export function getLaneX(laneIndex) {
  return LANES[laneIndex] ?? 0;
}

export function clampLane(lane) {
  return Math.max(LANE_LEFT, Math.min(LANE_RIGHT, lane));
}

export function randomInRange(min, max) {
  return Math.random() * (max - min) + min;
}

export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function formatDistance(meters) {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)}km`;
  }
  return `${Math.floor(meters)}m`;
}

export function formatScore(score) {
  if (score >= 1000000) return `${(score / 1000000).toFixed(1)}M`;
  if (score >= 1000) return `${(score / 1000).toFixed(1)}K`;
  return String(Math.floor(score));
}

// Generate a seeded pseudo-random sequence for reproducible segment layouts
export function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// Get 3D bounding box for a Three.js object
export function getObjectBounds(object) {
  const THREE = window.THREE;
  if (!THREE) return { width: 1, height: 2, depth: 1 };
  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  box.getSize(size);
  return { width: size.x, height: size.y, depth: size.z };
}

export function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

// Safe animation play with fallback
export function playAnimation(actions, name, fallbacks = [], crossfade = 0.2) {
  const names = [name, ...fallbacks];
  for (const n of names) {
    if (actions[n]) {
      actions[n].reset().fadeIn(crossfade).play();
      return n;
    }
  }
  // Play first available animation as last resort
  const firstKey = Object.keys(actions)[0];
  if (firstKey) {
    actions[firstKey].reset().fadeIn(crossfade).play();
    return firstKey;
  }
  return null;
}

export function stopAnimation(actions, name, fadeOut = 0.2) {
  if (actions[name]) {
    actions[name].fadeOut(fadeOut);
  }
}
