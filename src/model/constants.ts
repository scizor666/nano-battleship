export const BOARD_SIZE = 10;

export const FLEET_SPECS = [
  { id: 'carrier', name: 'Carrier', length: 5 },
  { id: 'battleship', name: 'Battleship', length: 4 },
  { id: 'cruiser', name: 'Cruiser', length: 3 },
  { id: 'submarine', name: 'Submarine', length: 3 },
  { id: 'destroyer', name: 'Destroyer', length: 2 },
] as const;

export const FRESH_SESSION_AFTER_CONSECUTIVE_INVALID = 2;
export const MAX_ATTEMPTS_PER_MOVE = 5;

export const AI_UNAVAILABLE_REASON =
  'Requires official Google Chrome 148+ on desktop with the on-device AI model.';
