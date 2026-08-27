// AoE2 timing constants. All values are GAME seconds at 1x speed.
// Game speed never changes these — it only changes how fast the clock ticks
// in real time, exactly like the in-game clock.

export const VILL_TRAIN_SECONDS = 25;
export const LOOM_SECONDS = 25;
export const STARTING_VILLAGERS = 3;

// Age research times. Cross-checked against Toaster226's Fast Imperial, which
// states a 12:27 Castle click and "~18:00" Imperial: 747 + 160 + 190 = 18:17.
export const AGE_RESEARCH_SECONDS = {
  feudal: 130,
  castle: 160,
  imperial: 190,
};

export const GAME_SPEEDS = [
  { multiplier: 1.0, label: 'Slow', hint: '1.0× — single player' },
  { multiplier: 1.5, label: 'Normal', hint: '1.5×' },
  { multiplier: 1.7, label: 'Fast', hint: '1.7× — DE multiplayer' },
];

export const DEFAULT_SPEED = 1.7;

export const RESOURCES = [
  { key: 'food', label: 'Food', icon: '🍖' },
  { key: 'wood', label: 'Wood', icon: '🪵' },
  { key: 'gold', label: 'Gold', icon: '🪙' },
  { key: 'stone', label: 'Stone', icon: '🪨' },
  { key: 'builder', label: 'Building', icon: '🔨' },
];

export const PHASES = {
  dark: { label: 'Dark Age' },
  'uptime-feudal': { label: 'Up to Feudal' },
  feudal: { label: 'Feudal Age' },
  'uptime-castle': { label: 'Up to Castle' },
  castle: { label: 'Castle Age' },
  'uptime-imperial': { label: 'Up to Imperial' },
  imperial: { label: 'Imperial Age' },
};

export const STORAGE_KEYS = {
  speed: 'aoe2helper.speed',
  lastBuild: 'aoe2helper.lastBuild',
};
