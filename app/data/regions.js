/**
 * The journey. Each region is one chapter of the chase after Fisi and the Heart Seed:
 * across Tanzania (plains, crater, lakeshore, baobab country, the mountain, the wild south and
 * the coast), north into Kenya and west to the misty mountains of Uganda.
 * Everything that makes a place feel different — ground, flora, fauna, hazards,
 * weather, music — is data here, so new regions are cheap to add.
 */

export const COUNTRIES = {
  tz: { name: 'Tanzania', flag: '🇹🇿', color: '#1eb53a' },
  ke: { name: 'Kenya', flag: '🇰🇪', color: '#bb0000' },
  ug: { name: 'Uganda', flag: '🇺🇬', color: '#fcdc04' },
};

/** Scenery factories the world knows how to build (see world.js). */
export const PROP_TYPES = [
  'acacia', 'baobab', 'kopje', 'mound', 'bush', 'grass', 'fever', 'groundsel', 'lobelia', 'montane',
  'snowrock', 'palm', 'doum', 'papyrus', 'hut', 'stonehouse', 'banana', 'jungle', 'fern', 'treefern', 'flowers',
  'ngalawa', 'banda', 'parasol', 'mangrove', 'coralrock', 'seaweed', 'fishrack', 'lighthouse',
];
export const HERD_TYPES = [
  'zebra', 'giraffe', 'elephant', 'wildebeest', 'buffalo', 'flamingo', 'hippo', 'gorilla', 'lion', 'rhino', 'dolphin', 'crab',
  'gazelle', 'warthog', 'wilddog',
];

export const REGIONS = [
  {
    id: 'serengeti', country: 'tz', name: 'Serengeti', len: 700,
    title: 'The Stolen Song', speaker: 'Bibi Tembo', emoji: '🐘',
    line: 'Run, child! Gather the scattered golden seeds — the herds will follow their song.',
    blurb: 'Endless golden plains where two million hooves follow the Song of the Savanna.',
    ground: { grass: '#d4b05a', path: '#c28c55' },
    hill: '#c9a86a', fog: null,
    kili: { x: -260, y: -26, z: -720, s: 1 },
    props: [['acacia', 5], ['baobab', 1.4], ['kopje', 1.2], ['mound', 2], ['bush', 3.5], ['grass', 7]],
    herd: [['zebra', 'walk', 3], ['giraffe', 'walk', 2], ['elephant', 'walk', 1.2], ['wildebeest', 'idle', 2.5], ['gazelle', 'idle', 2], ['warthog', 'idle', 0.8]],
    blocks: ['boulder', 'mound'], style: { log: 'log', gate: 'branch', rock: 'rock' },
    trucks: true, specials: { rhino: 1.6 },
    music: { transpose: 0, tempo: 116, scale: 'major' },
  },
  {
    id: 'ngorongoro', country: 'tz', name: 'Ngorongoro Crater', len: 800,
    title: 'Crater of Giants', speaker: 'Kifaru the Rhino', emoji: '🦏',
    line: 'Fisi\'s trucks rolled down the crater road. Mind the buffalo — they don\'t share the path!',
    blurb: 'A lost world inside an ancient volcano: soda lakes, flamingos and the last black rhinos.',
    ground: { grass: '#8fae4a', path: '#a8683e', water: '#9ec9c4', waterSide: 1 },
    hill: '#6f8f45', fog: { tint: '#cfe0c0', amount: 0.18 }, crater: true,
    kili: { x: -300, y: -60, z: -760, s: 0.8 },
    props: [['fever', 4], ['acacia', 2], ['bush', 4], ['grass', 7], ['flowers', 2], ['kopje', 0.8]],
    herd: [['buffalo', 'idle', 2.5], ['flamingo', 'idle', 4], ['rhino', 'walk', 0.8], ['zebra', 'walk', 1.5], ['lion', 'idle', 0.8]],
    blocks: ['boulder', 'mound'], style: { log: 'log', gate: 'branch', rock: 'rock' },
    trucks: true, specials: { buffalo: 2 },
    music: { transpose: 2, tempo: 118, scale: 'major' },
  },
  {
    id: 'manyara', country: 'tz', name: 'Lake Manyara', len: 800,
    title: 'Lake of Flamingos', speaker: 'Heroe the Flamingo', emoji: '🦩',
    line: 'Fisi slipped along the lakeshore! The lions here nap up in the trees — don\'t look up, just run!',
    blurb: 'A pink-fringed soda lake under the Rift Valley wall, ringed by groundwater forest.',
    ground: { grass: '#9fb456', path: '#a8703f', water: '#a9d3cc', waterSide: -1 },
    hill: '#5f7f3a', fog: { tint: '#d6e6c8', amount: 0.14 },
    kili: { x: -260, y: -200, z: -720, s: 1 },
    props: [['jungle', 1.6], ['fever', 2.5], ['acacia', 3], ['papyrus', 2], ['bush', 3], ['grass', 6], ['flowers', 1.5], ['doum', 1]],
    herd: [['flamingo', 'idle', 4], ['elephant', 'walk', 1.2], ['giraffe', 'walk', 1], ['zebra', 'walk', 1], ['buffalo', 'idle', 1], ['lion', 'idle', 0.6]],
    blocks: ['boulder', 'mound'], style: { log: 'log', gate: 'branch', rock: 'rock' },
    trucks: true, specials: { river: 1.6, lion: 1.2 },
    music: { transpose: 4, tempo: 118, scale: 'major' },
  },
  {
    id: 'tarangire', country: 'tz', name: 'Tarangire', len: 800,
    title: 'Baobab Kingdom', speaker: 'Mzee Mbuyu the Baobab', emoji: '🌳',
    line: 'I have watched elephants pass for a thousand years. Fisi ran south — mind the herds crossing!',
    blurb: 'Ancient baobabs and termite towers, where elephant families gather by the hundred.',
    ground: { grass: '#c9a85a', path: '#b8794a' },
    hill: '#b8975e', fog: { tint: '#f0dfb8', amount: 0.12 },
    kili: { x: 200, y: -80, z: -950, s: 1.4 },
    props: [['baobab', 4.5], ['acacia', 3], ['mound', 2.8], ['bush', 3], ['grass', 7], ['kopje', 0.6]],
    herd: [['elephant', 'walk', 4.5], ['giraffe', 'walk', 1.2], ['zebra', 'walk', 1.2], ['wildebeest', 'idle', 1], ['warthog', 'idle', 1.4], ['gazelle', 'idle', 1]],
    blocks: ['boulder', 'mound'], style: { log: 'log', gate: 'branch', rock: 'rock' },
    trucks: true, specials: { crossing: 2.2 },
    music: { transpose: 1, tempo: 116, scale: 'major' },
  },
  {
    id: 'kilimanjaro', country: 'tz', name: 'Mount Kilimanjaro', len: 800,
    title: 'Roof of Africa', speaker: 'Tai the Eagle', emoji: '🦅',
    line: 'Fisi is climbing to the glaciers! Watch the skies — the mountain throws rocks!',
    blurb: 'Africa\'s highest peak: cloud forest, giant groundsels and snow on the equator.',
    ground: { grass: '#d9dde4', path: '#8a8a92' },
    hill: '#9aa3b2', fog: { tint: '#dfe6f2', amount: 0.42, far: 150 }, weather: 'snow', blades: false,
    kili: { x: -60, y: -70, z: -1050, s: 2.0 },
    props: [['groundsel', 4], ['lobelia', 3], ['snowrock', 4], ['montane', 2.5], ['grass', 2]],
    herd: [['buffalo', 'idle', 0.6]],
    blocks: ['boulder'], style: { log: 'log', gate: 'branch', rock: 'snow' },
    trucks: false, specials: { rockfall: 3 },
    music: { transpose: -3, tempo: 112, scale: 'minor' },
  },
  {
    id: 'ruaha', country: 'tz', name: 'Ruaha', len: 800,
    title: 'Land of Painted Wolves', speaker: 'Mbwa Mwitu the Wild Dog', emoji: '🐕',
    line: 'My pack saw Fisi sneaking toward the Rufiji. Run with us — and keep clear of the lions!',
    blurb: 'Wild, rocky country cut by the Great Ruaha River: baobabs, big prides and painted wolves.',
    ground: { grass: '#c4a062', path: '#a5603a', water: '#6f8d74', waterSide: 1 },
    hill: '#a88456', fog: { tint: '#efcf9e', amount: 0.14 },
    kili: { x: -260, y: -200, z: -720, s: 1 },
    props: [['baobab', 3.5], ['kopje', 2.2], ['acacia', 2.5], ['doum', 1.4], ['bush', 3], ['grass', 6]],
    herd: [['wilddog', 'walk', 1.6], ['elephant', 'walk', 1.6], ['giraffe', 'walk', 1], ['gazelle', 'idle', 1.4], ['warthog', 'idle', 1], ['lion', 'idle', 0.8], ['buffalo', 'idle', 0.6]],
    blocks: ['boulder', 'mound'], style: { log: 'log', gate: 'branch', rock: 'rock' },
    trucks: true, specials: { lion: 2, greatRiver: 2.6 },
    music: { transpose: -1, tempo: 120, scale: 'minor' },
  },
  {
    id: 'selous', country: 'tz', name: 'Selous · Nyerere', len: 800,
    title: 'River of Kings', speaker: 'Kiboko the Hippo', emoji: '🦛',
    line: 'The Rufiji runs fast here. Crocodiles nap on the trail — hop over, don\'t wake them!',
    blurb: 'Africa\'s largest wilderness, braided by the mighty Rufiji River.',
    ground: { grass: '#9bb04e', path: '#b5844e', water: '#5d7f63', waterSide: -1 },
    hill: '#7d9446', fog: { tint: '#d8e4b8', amount: 0.15 },
    kili: { x: -260, y: -200, z: -720, s: 1 },
    props: [['doum', 4], ['palm', 1.5], ['papyrus', 3], ['bush', 3], ['grass', 5], ['baobab', 1]],
    herd: [['hippo', 'idle', 3], ['elephant', 'walk', 1], ['giraffe', 'walk', 1], ['buffalo', 'idle', 1], ['wilddog', 'walk', 0.8], ['warthog', 'idle', 0.6]],
    blocks: ['boulder', 'mound'], style: { log: 'log', gate: 'branch', rock: 'rock' },
    trucks: true, specials: { croc: 2.4 },
    music: { transpose: 5, tempo: 118, scale: 'major' },
  },
  {
    id: 'zanzibar', country: 'tz', name: 'Zanzibar', len: 800,
    title: 'The Spice Island', speaker: 'Kima the Colobus', emoji: '🐒',
    line: 'Fisi\'s sneaking onto a dhow bound for Kenya! Through the spice market — quick!',
    blurb: 'White sand, turquoise water, carved doors and the scent of cloves on the breeze.',
    ground: { grass: '#efe2bd', path: '#f6edd2', water: '#3fc1c9', waterSide: -1, beach: true },
    hill: '#d9cfa8', fog: { tint: '#c5ebe8', amount: 0.08, near: 150, far: 440 }, ocean: true, blades: false,
    // an island: no Kilimanjaro on the horizon, just the Indian Ocean
    kili: { x: -260, y: -520, z: -720, s: 1 },
    props: [
      ['palm', 6], ['stonehouse', 1.8], ['banda', 1.4], ['parasol', 1.6], ['coralrock', 1.6], ['mangrove', 1.2],
      ['fishrack', 0.9], ['hut', 0.8], ['bush', 1.2], ['flowers', 1.4], ['ngalawa', 1.4], ['seaweed', 0.8], ['lighthouse', 0.12],
    ],
    herd: [['dolphin', 'idle', 3], ['crab', 'idle', 2]],
    blocks: ['cart', 'canoe'], style: { log: 'palm', gate: 'net', rock: 'rock', fall: 'coconut' },
    // a beach, not the bush: no lions or wildebeest; coconuts, scooters and the market instead
    wild: false, trucks: false, specials: { market: 2.4, coconuts: 2.2, boda: 2 },
    music: { transpose: 2, tempo: 120, scale: 'taarab' },
  },
  {
    id: 'mara', country: 'ke', name: 'Maasai Mara', len: 800,
    title: 'The Great Crossing', speaker: 'Nyumbu the Wildebeest', emoji: '🦬',
    line: 'A million of us cross the Mara each year. Weave through the stampede, little runner!',
    blurb: 'Red-oat grasslands where the Great Migration thunders across the Mara River.',
    ground: { grass: '#c99a52', path: '#9c5a36' },
    hill: '#b58552', fog: null,
    kili: { x: -260, y: -200, z: -720, s: 1 },
    props: [['acacia', 5], ['bush', 3], ['grass', 8], ['mound', 1.5], ['kopje', 0.6]],
    herd: [['wildebeest', 'walk', 6], ['zebra', 'walk', 2], ['lion', 'idle', 1], ['giraffe', 'walk', 1], ['gazelle', 'idle', 1.5], ['warthog', 'idle', 0.6]],
    blocks: ['boulder', 'mound'], style: { log: 'log', gate: 'branch', rock: 'rock' },
    trucks: true, specials: { stampede: 2.6, rhino: 0.6 },
    music: { transpose: 0, tempo: 122, scale: 'major' },
  },
  {
    id: 'amboseli', country: 'ke', name: 'Amboseli', len: 800,
    title: 'Under the Snowy Mountain', speaker: 'Shangazi Tembo', emoji: '🐘',
    line: 'My herd saw Fisi heading west, to the misty forests. Careful — we cross where we please!',
    blurb: 'Dusty flats and swamps beneath Kilimanjaro, home of Africa\'s great tuskers.',
    ground: { grass: '#d8c79a', path: '#c9a878', water: '#7fa98d', waterSide: 1 },
    hill: '#c4b28a', fog: { tint: '#efe4cc', amount: 0.2 },
    kili: { x: 140, y: -45, z: -980, s: 1.7 },
    props: [['fever', 2], ['acacia', 3], ['bush', 2], ['grass', 5], ['papyrus', 1.5]],
    herd: [['elephant', 'walk', 4], ['zebra', 'walk', 1.5], ['wildebeest', 'idle', 1.5]],
    blocks: ['boulder', 'mound'], style: { log: 'log', gate: 'branch', rock: 'rock' },
    trucks: true, specials: { crossing: 2.4 },
    music: { transpose: 3, tempo: 120, scale: 'major' },
  },
  {
    id: 'bwindi', country: 'ug', name: 'Bwindi Forest', len: 900,
    title: 'The Impenetrable Forest', speaker: 'Sokwe the Silverback', emoji: '🦍',
    line: 'The Heart Seed\'s song echoes in these hills. My family will guard you — run!',
    blurb: 'Ancient misty rainforest, home to half of the world\'s mountain gorillas.',
    ground: { grass: '#3f6b2e', path: '#6b4a2e' },
    hill: '#2f5a2c', fog: { tint: '#a9c2a6', amount: 0.55, near: 18, far: 115 }, weather: 'mist', forest: true,
    kili: { x: -260, y: -200, z: -720, s: 1 },
    props: [['jungle', 5], ['treefern', 3], ['banana', 2], ['fern', 6], ['bush', 2]],
    herd: [['gorilla', 'idle', 3]],
    blocks: ['gorilla', 'boulder'], style: { log: 'mossy', gate: 'vine', rock: 'moss' },
    trucks: false, specials: {},
    music: { transpose: -2, tempo: 114, scale: 'minor' },
  },
];

// absolute journey start distance for every region
let acc = 0;
for (const r of REGIONS) {
  r.at = acc;
  acc += r.len;
}
export const JOURNEY_LEN = acc;

/** Region index for a journey distance (loops after Bwindi into a "legend lap"). */
export function regionIndexAt(J) {
  const lap = Math.floor(J / JOURNEY_LEN);
  const d = J - lap * JOURNEY_LEN;
  let i = 0;
  while (i < REGIONS.length - 1 && REGIONS[i + 1].at <= d) i++;
  return { index: i, lap, local: d - REGIONS[i].at };
}

export const regionAt = (J) => REGIONS[regionIndexAt(J).index];
