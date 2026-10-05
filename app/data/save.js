import { MISSION_POOL, ALLY_IDS, outfitId } from './content.js';
import { REGIONS, regionIndexAt } from './regions.js';

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
  journey: 2, // region indexes refer to this journey's map (see JOURNEY_V1)
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

/** The journey before Lake Manyara, Tarangire and Ruaha joined it, by index. */
const JOURNEY_V1 = ['serengeti', 'ngorongoro', 'kilimanjaro', 'selous', 'zanzibar', 'mara', 'amboseli', 'bwindi'];

export function fromJourneyV1(index) {
  const id = JOURNEY_V1[Math.max(0, Math.min(JOURNEY_V1.length - 1, Math.floor(Number(index) || 0)))];
  return Math.max(0, REGIONS.findIndex((r) => r.id === id));
}

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const stored = JSON.parse(raw);
      const data = { ...defaults(), ...stored };
      data.outfit = outfitId(data.outfit);
      // saves from the 8-region journey hold indexes into that map; carry them over by region
      if (!stored.journey) {
        for (const k of ['regionMax', 'startRegion', 'mapSeen']) if (k in stored) data[k] = fromJourneyV1(stored[k]);
        data.journey = 2;
      }
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
/**
 * Every mission pays seeds of its own, collected on the results screen after the run that
 * finished it. A mission that's proving too hard can be skipped for a fee: it then counts
 * towards the set (and the multiplier) but pays nothing.
 */
export const missionReward = (level) => 100 + 50 * Math.min(level, 20);
export const skipCost = (m) => Math.round((m.reward * 1.5) / 50) * 50;
/** Seeds paid on top when all three missions of a set are done. */
export const setBonus = (level) => 250 * (level + 1);

function buildMission(def, level) {
  const tier = Math.min(def.n.length - 1, Math.floor(level / 2));
  const n = def.n[tier];
  return {
    id: def.id, stat: def.stat, n, text: def.text.replace('{n}', n.toLocaleString()),
    reward: missionReward(level), best: 0, done: false, claimed: false, skipped: false,
  };
}

export function ensureMissions() {
  if (save.missions && save.missions.length === 3) {
    // missions saved before rewards existed: price them now (finished ones can be collected)
    for (const m of save.missions) {
      m.reward ??= missionReward(save.missionLevel);
      m.best ??= m.done ? m.n : 0;
      m.claimed ??= false;
      m.skipped ??= false;
    }
    return save.missions;
  }
  const pool = [...MISSION_POOL].sort(() => Math.random() - 0.5).slice(0, 3);
  save.missions = pool.map((d) => buildMission(d, save.missionLevel));
  persist();
  return save.missions;
}

/** Checks live run stats against missions; returns newly completed missions. */
export function checkMissions(stats) {
  const fresh = [];
  for (const m of ensureMissions()) {
    if (m.done) continue;
    m.best = Math.max(m.best, Math.min(m.n, stats[m.stat] ?? 0));
    if ((stats[m.stat] ?? 0) >= m.n) {
      m.done = true;
      fresh.push(m);
    }
  }
  if (fresh.length) persist();
  return fresh;
}

/** Missions done but not yet paid out. */
export const uncollected = () => ensureMissions().filter((m) => m.done && !m.claimed);

/** Pays out a finished mission. Returns the seeds paid (0 if there was nothing to collect). */
export function collectMission(id) {
  const m = ensureMissions().find((x) => x.id === id);
  if (!m || !m.done || m.claimed) return 0;
  m.claimed = true;
  save.seeds += m.reward;
  persist();
  return m.reward;
}

/** Buys a skip on an unfinished mission. Returns false if it can't be skipped or afforded. */
export function skipMission(id) {
  const m = ensureMissions().find((x) => x.id === id);
  if (!m || m.done) return false;
  const cost = skipCost(m);
  if (save.seeds < cost) return false;
  save.seeds -= cost;
  Object.assign(m, { done: true, claimed: true, skipped: true, best: m.n });
  persist();
  return true;
}

/** True when the set's bonus is waiting: all three missions done and paid out. */
export const missionSetReady = () => ensureMissions().every((m) => m.done && m.claimed);

/** If all three missions are done and collected, level up and roll a new set. */
export function claimMissionSet() {
  if (!missionSetReady()) return false;
  const bonus = setBonus(save.missionLevel);
  save.missionLevel = Math.min(29, save.missionLevel + 1);
  save.missions = null;
  save.seeds += bonus;
  ensureMissions();
  persist();
  return bonus;
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
