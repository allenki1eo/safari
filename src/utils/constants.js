export const LANE_WIDTH = 3;
export const LANE_COUNT = 3;
export const LANES = [-LANE_WIDTH, 0, LANE_WIDTH]; // left, center, right x positions
export const LANE_LEFT = 0;
export const LANE_CENTER = 1;
export const LANE_RIGHT = 2;

export const TRACK_SEGMENT_LENGTH = 40;
export const TRACK_WIDTH = LANE_WIDTH * LANE_COUNT; // 9
export const SEGMENTS_AHEAD = 5;
export const SEGMENT_POOL_SIZE = 8;

export const STARTING_SPEED = 8;
export const SPEED_INCREMENT = 0.5;
export const SPEED_INCREMENT_INTERVAL = 200; // every N meters

export const MAX_LIVES = 3;
export const INVINCIBILITY_DURATION = 2.0; // seconds
export const SLIDE_DURATION = 0.8; // seconds

export const JUMP_VELOCITY = 12;
export const GRAVITY = -25;
export const GROUND_Y = 0;

export const COIN_SCORE = 10;
export const METER_SCORE = 1;
export const COIN_CHAIN_THRESHOLD = 10;
export const COIN_CHAIN_MULTIPLIER = 2;
export const COIN_CHAIN_DURATION = 5; // seconds

export const BIOME_TRANSITION_METERS = 500;
export const BIOMES = ['serengeti', 'kilimanjaro', 'zanzibar'];

export const ANIMATION_NAMES = {
  run: 'run',
  jump: 'jump',
  slide: 'slide',
  hit: 'hit',
  idle: 'idle',
  celebrate: 'celebrate',
};

export const ANIMATION_CROSSFADE = 0.2;

export const PLAYER_HEIGHT = 1.8;
export const PLAYER_RADIUS = 0.35;
export const SLIDE_HEIGHT = 0.9;

export const OBSTACLE_SPAWN_MIN_DISTANCE = 15;
export const OBSTACLE_SPAWN_MAX_DISTANCE = 35;

export const COIN_ARC_COUNT = 8;
export const GEM_SCORE = 50;

export const POWER_UP_DURATION = 8; // seconds

export const CAMERA_OFFSET = { x: 0, y: 4, z: -8 };
export const CAMERA_LERP = 0.1;

export const COLORS = {
  gold: '#D4A853',
  deepRed: '#8B2500',
  forestGreen: '#1A472A',
  sand: '#F5E6C8',
  darkBg: '#0A0A0A',
  coin: '#FFD700',
  gem: '#00BFFF',
};

export const BIOME_CONFIGS = {
  serengeti: {
    fogColor: '#D4813A',
    fogNear: 40,
    fogFar: 120,
    groundColor: '#C4883C',
    ambientColor: '#FF8C42',
    skyPreset: 'sunset',
  },
  kilimanjaro: {
    fogColor: '#8B9BAA',
    fogNear: 30,
    fogFar: 100,
    groundColor: '#7A6B5A',
    ambientColor: '#9AABB8',
    skyPreset: 'dawn',
  },
  zanzibar: {
    fogColor: '#87CEEB',
    fogNear: 50,
    fogFar: 150,
    groundColor: '#E8D5A3',
    ambientColor: '#87CEEB',
    skyPreset: 'warehouse',
  },
};
