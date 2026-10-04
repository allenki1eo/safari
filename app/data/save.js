import { MISSION_POOL, ALLY_IDS, outfitId } from './content.js';
import { regionIndexAt } from './regions.js';

const KEY = 'kimbia.save.v1';

const defaults = () => ({
  seeds: 0,
  best: 0,
  bestDistance: 0,
  runs: 0,
  name: '',
  runner: 'zuri',
  outfit: 'kit',
  owned: ['zuri'],
  upgrades: Object.fromEntries(ALLY_IDS.map((id) => [id, 0])),
  missionLevel: 0, // completed sets → multiplier = 1 + missionLevel
  missions: null,
  chapterSeen: 0,
  regionMax: 0, // furthest region reached — unlocks it on the journey map
  startRegion: 0,
  charms: 1, // Ngao shield charms (one on the house)
  introSeen: false,
  tutorialDone: false,
  sound: true,
  music: true,
  haptics: true,
  quality: 'auto', // graphics: auto | high | low
  lastDaily: '',
  streak: 0,
  hunt: { day: '', done: 0, got: 0 }, // word hunt: words spelled today, letters of the current one
});

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = { ...defaults(), ...JSON.parse(raw) };
      data.outfit = outfitId(data.outfit);
      // v1 saves tracked distance-based chapters; translate to journey regions once
      if (data.chapterSeen && !data.regionMax) {
        const OLD = [0, 700, 1700, 3000, 4500, 6500];
        data.regionMax = regionIndexAt(OLD[Math.min(data.chapterSeen, OLD.length - 1)]).index;
      }
      return data;
    }
  } catch {
    /* private mode / blocked storage — play on with defaults */
  }
  return defaults();
}

export const save = read();

export function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    /* ignore */
  }
}

/* ---------------------------------------------------------------- missions */
function buildMission(def, level) {
  const tier = Math.min(def.n.length - 1, Math.floor(level / 2));
  const n = def.n[tier];
  return { id: def.id, stat: def.stat, n, text: def.text.replace('{n}', n.toLocaleString()), done: false };
}

export function ensureMissions() {
  if (save.missions && save.missions.length === 3) return save.missions;
  const pool = [...MISSION_POOL].sort(() => Math.random() - 0.5).slice(0, 3);
  save.missions = pool.map((d) => buildMission(d, save.missionLevel));
  persist();
  return save.missions;
}

/** Checks live run stats against missions; returns newly completed missions. */
export function checkMissions(stats) {
  const fresh = [];
  for (const m of ensureMissions()) {
    if (!m.done && (stats[m.stat] ?? 0) >= m.n) {
      m.done = true;
      fresh.push(m);
    }
  }
  if (fresh.length) persist();
  return fresh;
}

/** If all three missions are complete, level up and roll a new set. */
export function claimMissionSet() {
  const ms = ensureMissions();
  if (!ms.every((m) => m.done)) return false;
  save.missionLevel = Math.min(29, save.missionLevel + 1);
  save.missions = null;
  save.seeds += 250 * save.missionLevel;
  ensureMissions();
  persist();
  return true;
}

export const multiplier = () => 1 + save.missionLevel;

/* ------------------------------------------------------------------- daily */
export function claimDaily() {
  const today = new Date().toISOString().slice(0, 10);
  if (save.lastDaily === today) return null;
  const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  save.streak = save.lastDaily === yesterday ? Math.min(7, save.streak + 1) : 1;
  save.lastDaily = today;
  const reward = 50 * save.streak + (save.streak === 7 ? 500 : 0);
  save.seeds += reward;
  persist();
  return { streak: save.streak, reward };
}
