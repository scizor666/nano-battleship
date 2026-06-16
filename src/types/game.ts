export type Orientation = 'horizontal' | 'vertical';

export type OpponentType = 'huntTarget' | 'probability' | 'aiNano';

export type GamePhase = 'setup' | 'playing' | 'finished';

export type TurnOwner = 'player' | 'opponent';

export type CellShotState = 'untouched' | 'miss' | 'hit';

export interface Coordinate {
  row: number;
  col: number;
}

export interface ShipSpec {
  id: string;
  name: string;
  length: number;
}

export interface Ship {
  spec: ShipSpec;
  orientation: Orientation;
  anchor: Coordinate;
  hits: Set<string>;
}

export interface ShotResultMiss {
  kind: 'miss';
}

export interface ShotResultHit {
  kind: 'hit';
  shipName: string;
}

export interface ShotResultSunk {
  kind: 'sunk';
  shipName: string;
  shipLength: number;
}

export type ShotResult = ShotResultMiss | ShotResultHit | ShotResultSunk;

export interface BotShotRecord {
  coord: Coordinate;
  result: ShotResult;
}

export interface SideStats {
  shots: number;
  hits: number;
  turns: number;
}

export type AvailabilityState =
  | 'available'
  | 'downloadable'
  | 'downloading'
  | 'unavailable';

export interface AiMove {
  row: number;
  col: number;
  reasoning: string;
  fromFallback?: boolean;
}

export interface TranscriptEntry {
  id: string;
  kind: 'ai-move' | 'ai-event' | 'bot-move' | 'system';
  text: string;
  timestamp: number;
}

export interface DebugLogEntry {
  id: string;
  level: 'info' | 'warn' | 'error';
  category: string;
  message: string;
  detail?: unknown;
  timestamp: number;
}
