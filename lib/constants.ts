// Shared constants for the Imposter Architect game.
// Single source of truth — import from here, never redeclare.

export const COLORS = [
    '#ef4444', // Red
    '#3b82f6', // Blue
    '#eab308', // Yellow
    '#a855f7', // Purple
    '#f97316', // Orange
    '#4ade80', // Green
    '#ffffff', // White
] as const;

export type BlockColor = (typeof COLORS)[number];

export const SHAPES = ['cube', 'sphere', 'cylinder'] as const;
export type BlockShape = (typeof SHAPES)[number];

/** Secret build-target words assigned each round */
export const WORDS = [
    'Castle',
    'Spaceship',
    'Pyramid',
    'Treehouse',
    'Bridge',
    'Robot',
    'Lighthouse',
    'Cathedral',
    'Submarine',
    'Windmill',
    'Igloo',
    'Volcano',
] as const;

// Player physics
export const SPEED = 5;
export const JUMP_FORCE = 8;

// Selector color palette (first 5 for keyboard shortcut 1-5)
export const SELECTOR_COLORS = COLORS.slice(0, 5) as unknown as string[];

// Timer durations (seconds)
export const BUILD_DURATION = 60;
export const DISCUSSION_DURATION = 30;

// Sabotage cooldown (ms)
export const SABOTAGE_COOLDOWN_MS = 5000;

// Sabotage blast radius (world units)
export const SABOTAGE_RADIUS = 3;

// Max chat messages kept in client memory
export const MAX_CHAT_MESSAGES = 200;

// Minimum players required to start a game.
// Set to 1 so a single player can start (useful for solo testing).
// With 2+ players, one is randomly selected as the imposter.
export const MIN_PLAYERS_TO_START = 1;

// Position/rotation epsilon for network sync — don't send if delta is below this
export const SYNC_POSITION_THRESHOLD = 0.01;
export const SYNC_ROTATION_THRESHOLD = 0.005;
