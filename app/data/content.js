/* All narrative + tuning content lives here so the story can grow without touching the engine. */

export const RUNNERS = [
  {
    id: 'zuri', name: 'Zuri', title: 'The Young Ranger', cost: 0, emoji: '🧒🏾',
    bio: 'Raised at the edge of the plains, Zuri can name every bird by its song.',
    skin: 0x6b4226, shirt: 0xc9a46a, pants: 0x5b4a32, shoes: 0x3b2a1c, hair: 0x1a120c,
    accent: 0xd7263d, head: 'wrap', scarf: 0xd7263d, scarfPattern: 0x1b2a6b, backpack: 0x8a5a2b, sleeves: true, wristband: 0xf4d35e,
  },
  {
    id: 'juma', name: 'Juma', title: 'Striker of Arusha', cost: 600, emoji: '⚽',
    bio: 'Fastest feet in the village league. Has never once lost a race to a goat.',
    skin: 0x5a3620, shirt: 0xf4d35e, pants: 0x1b4f9c, shoes: 0xffffff, hair: 0x120c08,
    accent: 0x1b998b, head: 'cap', socks: 0x1b998b, shorts: true, wristband: 0x1b998b,
  },
  {
    id: 'neema', name: 'Neema', title: 'Keeper of Beads', cost: 1500, emoji: '📿',
    bio: 'Her beadwork tells the story of the migration. She means to finish it.',
    skin: 0x4a2c18, shirt: 0x6a2c91, pants: 0x4a2c18, shoes: 0x7a4a22, hair: 0x120c08,
    accent: 0xd7263d, head: 'beads', necklace: true, dress: 0x6a2c91, scarf: 0xe94f37, scarfPattern: 0xf4d35e, shorts: true,
  },
  {
    id: 'baraka', name: 'Baraka', title: 'The Explorer', cost: 3000, emoji: '🧭',
    bio: 'Maps every kopje, names every baobab. Carries far too many snacks.',
    skin: 0x7a4a2a, shirt: 0xe8dcc0, pants: 0x6b5a3a, shoes: 0x4a3420, hair: 0x2a1a10,
    accent: 0xb38b4d, head: 'hat', backpack: 0x3f6b3a, sleeves: true, scarf: 0x1b998b,
  },
  {
    id: 'amani', name: 'Amani', title: 'Night Runner', cost: 6000, emoji: '🌙',
    bio: 'Runs by starlight. The fireflies follow her home.',
    skin: 0x3e2414, shirt: 0x1b2a6b, pants: 0x101828, shoes: 0x4de1ff, hair: 0x0a0806,
    accent: 0x4de1ff, head: 'braids', scarf: 0x4de1ff, scarfPattern: 0xffffff, wristband: 0x4de1ff, necklace: true,
  },
  {
    id: 'kito', name: 'Kito', title: 'Little Legend', cost: 12000, emoji: '👑',
    bio: 'The youngest runner ever to outpace Fisi. Nobody knows how. Kito won\'t say.',
    skin: 0x6b4226, shirt: 0xff7a2f, pants: 0x2b1a0e, shoes: 0xf4d35e, hair: 0x120c08,
    accent: 0xf4d35e, head: 'mohawk', scarf: 0xf4d35e, scarfPattern: 0xd7263d, wristband: 0xd7263d, shorts: true,
  },
];

/** Wearable clothes. One choice for the device, worn by whichever runner is selected. */
export const OUTFITS = [
  { id: 'kit', name: 'Kit', line: 'A running singlet, split shorts and racing flats.' },
  { id: 'jersey', name: 'Jersey', line: 'A striped football shirt, socks and boots.' },
  { id: 'kanga', name: 'Kanga', line: 'A kitenge wrap and a bordered kanga at the waist.' },
  { id: 'vest', name: 'Vest', line: 'A collared shirt under a pocketed ranger vest.' },
  { id: 'journey', name: 'Cloak', line: 'A tunic and a shuka for the long road.' },
];

export const outfitId = (id) => (OUTFITS.some((o) => o.id === id) ? id : OUTFITS[0].id);

export const ALLIES = {
  tembo: {
    id: 'tembo', name: 'Tembo', species: 'Elephant', emoji: '🐘', ring: '#ffb347', color: '#ffb347',
    power: 'Stampede Ride', desc: 'Ride Tembo and smash straight through anything in your path.',
    base: 8, perLevel: 1.5,
    lines: ['Climb aboard, little one!', 'Nothing stands before Tembo!', 'Hold my ears — and hold on tight!'],
  },
  tai: {
    id: 'tai', name: 'Tai', species: 'Martial Eagle', emoji: '🦅', ring: '#7fd1ff', color: '#7fd1ff',
    power: 'Sky Lift', desc: 'Tai carries you over the savanna along a river of golden seeds.',
    base: 6, perLevel: 1.2,
    lines: ['To the clouds!', 'The plains look small from up here!', 'Mind my feathers!'],
  },
  duma: {
    id: 'duma', name: 'Duma', species: 'Cheetah', emoji: '🐆', ring: '#ffd34d', color: '#ffd34d',
    power: 'Lightning Dash', desc: 'Match Duma stride for stride — blistering speed, untouchable.',
    base: 5, perLevel: 1.0,
    lines: ['Try to keep up!', 'Zero to ninety, baby!', 'Faster! FASTER!'],
  },
  twiga: {
    id: 'twiga', name: 'Twiga', species: 'Giraffe', emoji: '🦒', ring: '#9be15d', color: '#9be15d',
    power: 'Sky-High Spring', desc: 'Twiga lends you her long legs. Jumps soar twice as high.',
    base: 10, perLevel: 2,
    lines: ['Reach for the acacia tops!', 'Up, up and away, dear!', 'Long legs, big leaps!'],
  },
  hondo: {
    id: 'hondo', name: 'Hondo', species: 'Hornbill', emoji: '🐦', ring: '#ff6b6b', color: '#ff6b6b',
    power: 'Seed Magnet', desc: 'Hondo swoops for every seed nearby and drops them in your bag.',
    base: 10, perLevel: 2,
    lines: ['Shiny! Mine! Er… yours!', 'Hondo sees ALL the seeds!', 'Leave the collecting to me!'],
  },
  simba: {
    id: 'simba', name: 'Mfalme', species: 'Lion', emoji: '🦁', ring: '#ff9f1c', color: '#ff9f1c',
    power: 'Royal Roar', desc: 'The lion king\'s roar doubles every point you earn.',
    base: 10, perLevel: 2,
    lines: ['ROOOAAARRR!', 'The plains bow to us!', 'Run, cub — the pride is with you!'],
  },
};
export const ALLY_IDS = Object.keys(ALLIES);
export const UPGRADE_COSTS = [250, 600, 1200, 2500, 5000];

/* -------------------------------------------------------------------------- */
export const INTRO = [
  {
    art: 'dawn', speaker: 'The Serengeti', emoji: '🌅',
    text: 'Every year, two million hooves follow an ancient melody across the plains — the Song of the Savanna.',
  },
  {
    art: 'heart', speaker: 'The Heart Seed', emoji: '✨',
    text: 'The song lives in the Heart Seed, a golden seed that has bloomed beneath the great baobab for a thousand years.',
  },
  {
    art: 'fisi', speaker: 'Fisi, King of Hyenas', emoji: '😈',
    text: '“Hehehe! With the Heart Seed, every herd will march where FISI says!” Last night, Fisi and his Rustmaw gang stole it.',
  },
  {
    art: 'scatter', speaker: 'The Plains', emoji: '🌾',
    text: 'As their trucks roared away, golden seeds spilled across the land. Without the song, the herds are lost.',
  },
  {
    art: 'elder', speaker: 'Bibi Tembo', emoji: '🐘',
    text: '“You, child. Fisi is fleeing across Tanzania — maybe all the way to Kenya and Uganda. The animals will help those who help them. Run — and don\'t stop!”',
  },
];

export const TUTORIAL = [
  { at: 25, text: 'Swipe ← → to switch lanes', icon: '↔️' },
  { at: 75, text: 'Swipe ↑ to jump logs', icon: '⬆️' },
  { at: 125, text: 'Swipe ↓ to slide under branches', icon: '⬇️' },
  { at: 175, text: 'Grab glowing totems to call an animal ally!', icon: '🐾' },
];

/* -------------------------------------------------------------------------- */
// Missions come in sets of three. Completing a set raises your permanent multiplier.
export const MISSION_POOL = [
  { id: 'seeds', text: 'Collect {n} seeds in one run', stat: 'seeds', n: [80, 200, 400, 700, 1000] },
  { id: 'dist', text: 'Run {n}m in one run', stat: 'distance', n: [500, 1200, 2500, 4000, 6000] },
  { id: 'jumps', text: 'Jump {n} times in one run', stat: 'jumps', n: [15, 30, 50, 80, 120] },
  { id: 'slides', text: 'Slide {n} times in one run', stat: 'slides', n: [10, 20, 35, 55, 80] },
  { id: 'allies', text: 'Call {n} animal allies in one run', stat: 'allies', n: [1, 2, 4, 6, 9] },
  { id: 'score', text: 'Score {n} points in one run', stat: 'score', n: [3000, 10000, 25000, 60000, 120000] },
  { id: 'roofs', text: 'Run across {n} Rustmaw trucks', stat: 'roofs', n: [2, 5, 10, 18, 30] },
  { id: 'smash', text: 'Smash {n} obstacles riding Tembo', stat: 'smash', n: [3, 8, 15, 25, 40] },
  { id: 'nearmiss', text: 'Pull off {n} close calls', stat: 'nearMiss', n: [3, 8, 15, 25, 40] },
  { id: 'regions', text: 'Cross into {n} new regions in one run', stat: 'regions', n: [1, 2, 3, 4, 6] },
  { id: 'combo', text: 'Reach a ×{n} seed combo', stat: 'bestCombo', n: [15, 30, 50, 80, 120] },
  { id: 'boxes', text: 'Open {n} Zawadi prize boxes in one run', stat: 'boxes', n: [1, 2, 3, 5, 8] },
  { id: 'words', text: 'Finish the word hunt {n}× in one run', stat: 'words', n: [1, 1, 1, 2, 2] },
];

/**
 * The word hunt: golden letters turn up on the trail, one word at a time. Each day deals the
 * words in a fresh order (daily.js huntWord); spell one and the next begins. Places, parks
 * and Swahili, each with a line for the prize card.
 */
export const HUNT_WORDS = [
  { word: 'SERENGETI', line: 'From the Maa for “endless plains”: home of the Great Migration' },
  { word: 'NGORONGORO', line: 'A collapsed volcano, now a crater brimming with wildlife' },
  { word: 'TANZANIA', line: 'Tanganyika + Zanzibar, joined in 1964' },
  { word: 'RUAHA', line: 'Wild, remote and named for the Great Ruaha River' },
  { word: 'KILIMANJARO', line: 'Africa’s highest mountain: 5,895 m of snow above the savanna' },
  { word: 'ZANZIBAR', line: 'The Spice Island: cloves, carved doors and turquoise sea' },
  { word: 'TARANGIRE', line: 'Ancient baobabs and some of Africa’s biggest elephant herds' },
  { word: 'MANYARA', line: 'A lake of flamingos, and lions that climb trees' },
  { word: 'MIKUMI', line: 'Open plains by the Uluguru Mountains, a little Serengeti' },
  { word: 'GOMBE', line: 'The forest where Jane Goodall lived among chimpanzees' },
  { word: 'KATAVI', line: 'Remote rivers packed shoulder to shoulder with hippos' },
  { word: 'SAADANI', line: 'Where the bush runs right down to the beach' },
  { word: 'NYERERE', line: 'Africa’s largest park, named for the nation’s founding father' },
  { word: 'KIMBIA', line: 'Swahili for “run!”' },
  { word: 'PUNDAMILIA', line: 'Swahili for zebra: the “striped donkey”' },
  { word: 'TWIGA', line: 'Swahili for giraffe' },
  { word: 'TEMBO', line: 'Swahili for elephant' },
  { word: 'SIMBA', line: 'Swahili for lion' },
];
/** Seeds paid per letter of a finished word, plus a shield charm. */
export const HUNT_PER_LETTER = 150;
/** After a word is spelled the hunt rests this long before the next word's letters appear. */
export const HUNT_COOLDOWN = 10 * 60 * 1000;

/**
 * Trail powerups: glowing gems that turn up in the prize-box slots (and now and then inside a
 * box). `dur` 0 means instant.
 */
export const BOOSTS = {
  // `tag` labels the HUD chip; `intro` is said once, the first time a player finds it
  gold: {
    id: 'gold', name: 'Dhahabu', emoji: '🌟', color: '#ffc940', dur: 12, tag: '×3', line: 'Golden seeds: every seed is worth 3',
    intro: 'Dhahabu means gold. For 12 seconds every seed you grab is worth three!',
  },
  score: {
    id: 'score', name: 'Pointi ×2', emoji: '⚡', color: '#7ad7ff', dur: 15, tag: '×2', line: 'Every step scores double',
    intro: 'Double points for 15 seconds. Keep running and watch your score fly!',
  },
  slow: {
    id: 'slow', name: 'Pole Pole', emoji: '🐢', color: '#7bd389', dur: 8, tag: 'slow', line: 'The chase slows right down',
    intro: 'Pole pole — slowly, slowly. The trail eases off for 8 seconds so you can breathe.',
  },
  wind: {
    id: 'wind', name: 'Kimbunga', emoji: '🌪️', color: '#c9b8ff', dur: 0, tag: '', line: 'A whirlwind sweeps the trail ahead',
    intro: 'A kimbunga is a whirlwind! It blows every obstacle just ahead clean off the trail.',
  },
};
export const BOOST_IDS = Object.keys(BOOSTS);

export const SHOUTS = ['Hakuna shida!', 'Safi sana!', 'Pole pole? Never!', 'Kimbia!', 'Poa!', 'Hatari!', 'Mambo poa!'];

/**
 * Seeds for the top ten of each Dar es Salaam day, week and month (index 0 = 1st place).
 * Sized against the shop: a week's win buys Amani, a month's win buys Kito.
 */
const podium = (gold, silver, bronze, rest) => [gold, silver, bronze, ...Array(7).fill(rest)];
export const PRIZES = {
  day: podium(1000, 600, 400, 100),
  week: podium(6000, 3000, 1500, 400),
  month: podium(12000, 6000, 3000, 1000),
};
