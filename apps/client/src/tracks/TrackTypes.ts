export interface TrackControlPoint {
  x: number;
  y: number;
  z: number;
  /** Multiplies the track's base width at this point — used to pinch shortcuts/hazard gaps. */
  widthMul?: number;
}

export interface ShortcutBranch {
  id: string;
  /** Index of the main-loop checkpoint the branch leaves from. */
  fromCheckpointIndex: number;
  /** Index of the main-loop checkpoint the branch rejoins at (must be > from + 1). */
  toCheckpointIndex: number;
  points: TrackControlPoint[];
  widthMul: number;
}

export type HazardKind =
  | 'falling-rocks'
  | 'falling-trees'
  | 'moving-ships'
  | 'lightning-strikes'
  | 'tide-surge'
  | 'crane-sweep'
  | 'platform-sway';

export interface HazardZone {
  id: string;
  kind: HazardKind;
  position: [number, number, number];
  radius: number;
  telegraphSec: number;
  cycleSec: number;
  damageSpeedPenalty: number;
  stunSec: number;
}

export type PropPaletteId = 'tropical' | 'volcanic' | 'jungle' | 'sky' | 'harbor' | 'storm';

export interface PropPlacement {
  type: 'palm' | 'rock' | 'barrier' | 'sign' | 'crate' | 'lamp' | 'pillar' | 'ruin' | 'container';
  position: [number, number, number];
  rotationY: number;
  scale: number;
}

export interface TrackRuntimeDefinition {
  id: string;
  mainLoop: TrackControlPoint[];
  baseWidth: number;
  closed: true;
  checkpointCount: number;
  shortcut: ShortcutBranch;
  hazards: HazardZone[];
  propPalette: PropPaletteId;
  props: PropPlacement[];
  terrainColor: number;
  terrainSize: number;
  hasWater: boolean;
  waterLevelY: number;
  elevatedSections: Array<{ startIndex: number; endIndex: number }>;
}
