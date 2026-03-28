// Central source of truth for all game asset paths
// Generated from /public/assets/ folder scan

export const CHARACTERS = [
  { id: 'adventurer', name: 'Adventurer', path: '/assets/characters/adventurer.glb', free: true },
  { id: 'casual', name: 'Casual Runner', path: '/assets/characters/casual.glb', free: true },
  { id: 'farmer', name: 'Farmer', path: '/assets/characters/farmer.glb', unlockCoins: 300 },
  { id: 'hoodie', name: 'Hoodie', path: '/assets/characters/hoodie.glb', unlockCoins: 200 },
  { id: 'worker', name: 'Worker', path: '/assets/characters/worker.glb', unlockCoins: 400 },
  { id: 'beach', name: 'Beach Runner', path: '/assets/characters/beach.glb', unlockCoins: 500 },
  { id: 'punk', name: 'Punk', path: '/assets/characters/punk.glb', unlockCoins: 800 },
  { id: 'businessman', name: 'Business Man', path: '/assets/characters/businessman.glb', unlockCoins: 1000 },
  { id: 'swat', name: 'SWAT', path: '/assets/characters/swat.glb', unlockCoins: 1500 },
  { id: 'astronaut', name: 'Astronaut', path: '/assets/characters/astronaut.glb', unlockCoins: 2000 },
  { id: 'king', name: 'King', path: '/assets/characters/king.glb', unlockCoins: 3000 },
];

export const OUTFITS = [
  { id: 'male_peasant', name: 'Peasant', path: '/assets/outfits/male_peasant.gltf', free: true },
  { id: 'female_peasant', name: 'Peasant (F)', path: '/assets/outfits/female_peasant.gltf', unlockCoins: 100 },
  { id: 'male_ranger', name: 'Ranger', path: '/assets/outfits/male_ranger.gltf', unlockCoins: 200 },
  { id: 'female_ranger', name: 'Ranger (F)', path: '/assets/outfits/female_ranger.gltf', unlockCoins: 300 },
];

export const ANIMALS = [
  // Available in assets folder — mapped to safari equivalents
  { id: 'bull', name: 'Buffalo', path: '/assets/animals/bull.gltf', size: 'large', role: ['obstacle', 'npc'] },
  { id: 'horse', name: 'Zebra', path: '/assets/animals/horse.gltf', size: 'large', role: ['npc'] },
  { id: 'stag', name: 'Gazelle', path: '/assets/animals/stag.gltf', size: 'medium', role: ['obstacle', 'npc'] },
  { id: 'deer', name: 'Impala', path: '/assets/animals/deer.gltf', size: 'medium', role: ['obstacle', 'npc'] },
  { id: 'wolf', name: 'Wild Dog', path: '/assets/animals/wolf.gltf', size: 'medium', role: ['obstacle', 'npc'] },
  { id: 'husky', name: 'Jackal', path: '/assets/animals/husky.gltf', size: 'small', role: ['npc'] },
  { id: 'shibainu', name: 'Meerkat', path: '/assets/animals/shibainu.gltf', size: 'small', role: ['npc'] },
];

// Animals classified as obstacles (by size behavior)
export const OBSTACLE_ANIMALS = ANIMALS.filter(a => a.role.includes('obstacle'));
export const NPC_ANIMALS = ANIMALS.filter(a => a.role.includes('npc'));
export const LARGE_OBSTACLE_ANIMALS = OBSTACLE_ANIMALS.filter(a => a.size === 'large');
export const MEDIUM_OBSTACLE_ANIMALS = OBSTACLE_ANIMALS.filter(a => a.size === 'medium');

export const NATURE = [
  // Trees — scenery + some obstacles
  { id: 'commontree_1', path: '/assets/nature/commontree_1.gltf', type: 'scenery', instanced: false, biomes: ['serengeti', 'kilimanjaro'] },
  { id: 'commontree_2', path: '/assets/nature/commontree_2.gltf', type: 'scenery', instanced: false, biomes: ['serengeti', 'kilimanjaro'] },
  { id: 'commontree_3', path: '/assets/nature/commontree_3.gltf', type: 'scenery', instanced: false, biomes: ['serengeti', 'kilimanjaro'] },
  { id: 'commontree_4', path: '/assets/nature/commontree_4.gltf', type: 'scenery', instanced: false, biomes: ['serengeti'] },
  { id: 'commontree_5', path: '/assets/nature/commontree_5.gltf', type: 'scenery', instanced: false, biomes: ['serengeti', 'zanzibar'] },
  { id: 'twistedtree_1', path: '/assets/nature/twistedtree_1.gltf', type: 'obstacle', instanced: false, biomes: ['serengeti', 'kilimanjaro'] },
  { id: 'twistedtree_2', path: '/assets/nature/twistedtree_2.gltf', type: 'obstacle', instanced: false, biomes: ['serengeti'] },
  { id: 'twistedtree_3', path: '/assets/nature/twistedtree_3.gltf', type: 'obstacle', instanced: false, biomes: ['kilimanjaro'] },
  { id: 'twistedtree_4', path: '/assets/nature/twistedtree_4.gltf', type: 'scenery', instanced: false, biomes: ['serengeti'] },
  { id: 'twistedtree_5', path: '/assets/nature/twistedtree_5.gltf', type: 'scenery', instanced: false, biomes: ['kilimanjaro'] },
  { id: 'deadtree_1', path: '/assets/nature/deadtree_1.gltf', type: 'scenery', instanced: false, biomes: ['kilimanjaro'] },
  { id: 'deadtree_2', path: '/assets/nature/deadtree_2.gltf', type: 'scenery', instanced: false, biomes: ['kilimanjaro'] },
  { id: 'deadtree_3', path: '/assets/nature/deadtree_3.gltf', type: 'obstacle', instanced: false, biomes: ['kilimanjaro'] },
  { id: 'deadtree_4', path: '/assets/nature/deadtree_4.gltf', type: 'scenery', instanced: false, biomes: ['kilimanjaro'] },
  { id: 'deadtree_5', path: '/assets/nature/deadtree_5.gltf', type: 'scenery', instanced: false, biomes: ['kilimanjaro'] },
  { id: 'pine_1', path: '/assets/nature/pine_1.gltf', type: 'scenery', instanced: false, biomes: ['kilimanjaro'] },
  { id: 'pine_2', path: '/assets/nature/pine_2.gltf', type: 'scenery', instanced: false, biomes: ['kilimanjaro'] },
  { id: 'pine_3', path: '/assets/nature/pine_3.gltf', type: 'scenery', instanced: false, biomes: ['kilimanjaro'] },
  { id: 'pine_4', path: '/assets/nature/pine_4.gltf', type: 'scenery', instanced: false, biomes: ['kilimanjaro'] },
  { id: 'pine_5', path: '/assets/nature/pine_5.gltf', type: 'scenery', instanced: false, biomes: ['kilimanjaro'] },
  // Rocks — obstacles
  { id: 'rock_medium_1', path: '/assets/nature/rock_medium_1.gltf', type: 'obstacle', instanced: false, biomes: ['kilimanjaro'] },
  { id: 'rock_medium_2', path: '/assets/nature/rock_medium_2.gltf', type: 'obstacle', instanced: false, biomes: ['kilimanjaro'] },
  { id: 'rock_medium_3', path: '/assets/nature/rock_medium_3.gltf', type: 'obstacle', instanced: false, biomes: ['kilimanjaro', 'zanzibar'] },
  // Pebbles — scenery (instanced)
  { id: 'pebble_round_1', path: '/assets/nature/pebble_round_1.gltf', type: 'scenery', instanced: true, biomes: ['kilimanjaro', 'zanzibar'] },
  { id: 'pebble_square_1', path: '/assets/nature/pebble_square_1.gltf', type: 'scenery', instanced: true, biomes: ['kilimanjaro'] },
  // Grass — scenery (instanced)
  { id: 'grass_common_short', path: '/assets/nature/grass_common_short.gltf', type: 'scenery', instanced: true, biomes: ['serengeti', 'zanzibar'] },
  { id: 'grass_common_tall', path: '/assets/nature/grass_common_tall.gltf', type: 'scenery', instanced: true, biomes: ['serengeti'] },
  { id: 'grass_wispy_short', path: '/assets/nature/grass_wispy_short.gltf', type: 'scenery', instanced: true, biomes: ['serengeti', 'kilimanjaro'] },
  { id: 'grass_wispy_tall', path: '/assets/nature/grass_wispy_tall.gltf', type: 'scenery', instanced: true, biomes: ['serengeti'] },
  // Bushes — scenery
  { id: 'bush_common', path: '/assets/nature/bush_common.gltf', type: 'scenery', instanced: false, biomes: ['serengeti', 'kilimanjaro'] },
  { id: 'bush_common_flowers', path: '/assets/nature/bush_common_flowers.gltf', type: 'scenery', instanced: false, biomes: ['zanzibar'] },
  // Plants — scenery
  { id: 'plant_1', path: '/assets/nature/plant_1.gltf', type: 'scenery', instanced: true, biomes: ['zanzibar'] },
  { id: 'plant_1_big', path: '/assets/nature/plant_1_big.gltf', type: 'scenery', instanced: false, biomes: ['zanzibar'] },
  { id: 'plant_7', path: '/assets/nature/plant_7.gltf', type: 'scenery', instanced: true, biomes: ['zanzibar'] },
  { id: 'plant_7_big', path: '/assets/nature/plant_7_big.gltf', type: 'scenery', instanced: false, biomes: ['zanzibar'] },
  // Flowers — scenery (instanced)
  { id: 'flower_3_group', path: '/assets/nature/flower_3_group.gltf', type: 'scenery', instanced: true, biomes: ['serengeti', 'zanzibar'] },
  { id: 'flower_4_group', path: '/assets/nature/flower_4_group.gltf', type: 'scenery', instanced: true, biomes: ['zanzibar'] },
  { id: 'clover_1', path: '/assets/nature/clover_1.gltf', type: 'scenery', instanced: true, biomes: ['serengeti'] },
  { id: 'clover_2', path: '/assets/nature/clover_2.gltf', type: 'scenery', instanced: true, biomes: ['serengeti'] },
  { id: 'fern_1', path: '/assets/nature/fern_1.gltf', type: 'scenery', instanced: true, biomes: ['kilimanjaro', 'zanzibar'] },
];

export const NATURE_OBSTACLES = NATURE.filter(n => n.type === 'obstacle');
export const NATURE_SCENERY = NATURE.filter(n => n.type === 'scenery');

export const GROUND_TEXTURES = {
  serengeti: '/assets/serengeti_ground.png',
  kilimanjaro: '/assets/serengeti_ground.png', // rocky tint applied via material color
  zanzibar: '/assets/zanzibar_sand.png',
};

// All paths that need preloading
export const ALL_GLTF_PATHS = [
  ...CHARACTERS.map(c => c.path),
  ...OUTFITS.map(o => o.path),
  ...ANIMALS.map(a => a.path),
  // Load a curated subset of nature for performance
  ...NATURE.filter(n => !n.instanced).slice(0, 20).map(n => n.path),
  ...NATURE.filter(n => n.instanced).slice(0, 6).map(n => n.path),
];

export const ALL_TEXTURE_PATHS = Object.values(GROUND_TEXTURES);
