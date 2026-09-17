import { buildCurve, frameAt, widthAt } from './TrackBuilder';
import type { PropPaletteId, PropPlacement, TrackControlPoint, TrackRuntimeDefinition, HazardZone, ShortcutBranch } from './TrackTypes';

export interface LoopGenerationOptions {
  pointCount: number;
  radiusX: number;
  radiusZ: number;
  wiggleAmp?: number;
  wiggleFreq?: number;
  /** angle (radians, 0..2PI) -> elevation y. */
  elevationFn?: (angle: number) => number;
  /** angle (radians) -> width multiplier, for pinches/widenings around the loop. */
  widthFn?: (angle: number) => number;
}

/** Procedurally generates a closed-loop set of control points (a rounded, wiggling oval
 * with optional elevation/width profiles) so each track can be authored as a short config
 * instead of dozens of hand-typed coordinates, while still producing a distinct shape. */
export function generateLoopPoints(options: LoopGenerationOptions): TrackControlPoint[] {
  const { pointCount, radiusX, radiusZ, wiggleAmp = 0, wiggleFreq = 3, elevationFn, widthFn } = options;
  const points: TrackControlPoint[] = [];
  for (let i = 0; i < pointCount; i++) {
    const angle = (i / pointCount) * Math.PI * 2;
    const wiggle = wiggleAmp * Math.sin(angle * wiggleFreq);
    const r = 1;
    const x = Math.cos(angle) * (radiusX + wiggle * radiusX * 0.15);
    const z = Math.sin(angle) * (radiusZ + wiggle * radiusZ * 0.15) * r;
    const y = elevationFn ? elevationFn(angle) : 0;
    points.push({ x, y, z, widthMul: widthFn ? widthFn(angle) : 1 });
  }
  return points;
}

/** Builds a shortcut branch that cuts across the inside of the loop between two
 * fractional positions (0..1) along the main loop, reconnecting the path further ahead.
 * `checkpointCount` converts those fractions into the checkpoint indices the branch skips. */
export function generateShortcutBranch(
  mainLoop: TrackControlPoint[],
  tFrom: number,
  tTo: number,
  checkpointCount: number,
  insetFactor: number,
  id: string,
  widthMul: number,
): ShortcutBranch {
  const curve = buildCurve(mainLoop, true);
  const from = curve.getPointAt(tFrom);
  const to = curve.getPointAt(tTo);
  const mid = {
    x: ((from.x + to.x) / 2) * insetFactor,
    y: Math.min(from.y, to.y),
    z: ((from.z + to.z) / 2) * insetFactor,
  };
  return {
    id,
    fromCheckpointIndex: Math.round(tFrom * checkpointCount),
    toCheckpointIndex: Math.round(tTo * checkpointCount),
    points: [
      { x: from.x, y: from.y, z: from.z },
      mid,
      { x: to.x, y: to.y, z: to.z },
    ],
    widthMul,
  };
}

const PALETTE_PROP_TYPES: Record<PropPaletteId, PropPlacement['type'][]> = {
  tropical: ['palm', 'barrier', 'lamp', 'crate', 'sign'],
  volcanic: ['rock', 'barrier', 'sign', 'crate'],
  jungle: ['ruin', 'rock', 'palm', 'barrier'],
  sky: ['pillar', 'barrier', 'lamp'],
  harbor: ['container', 'crate', 'lamp', 'barrier'],
  storm: ['rock', 'barrier', 'lamp', 'crate'],
};

export interface TrackAuthoringConfig {
  id: string;
  mainLoop: TrackControlPoint[];
  baseWidth: number;
  checkpointCount: number;
  shortcut: ShortcutBranch;
  hazards: HazardZone[];
  propPalette: PropPaletteId;
  terrainColor: number;
  terrainSize: number;
  hasWater: boolean;
  waterLevelY: number;
  propDensity?: number;
}

export function pointOnLoopAt(mainLoop: TrackControlPoint[], t: number): [number, number, number] {
  const curve = buildCurve(mainLoop, true);
  const p = curve.getPointAt(t);
  return [p.x, p.y, p.z];
}

/** Scatters props evenly along the main loop, alternating sides, skipping the
 * start/finish straight so the grid stays clear. Prop type cycles through the
 * palette so each track reads as visually distinct but internally consistent. */
export function authorTrack(config: TrackAuthoringConfig): TrackRuntimeDefinition {
  const curve = buildCurve(config.mainLoop, true);
  const types = PALETTE_PROP_TYPES[config.propPalette];
  const density = config.propDensity ?? 26;
  const props: PropPlacement[] = [];

  for (let i = 0; i < density; i++) {
    const t = i / density;
    if (t < 0.04 || t > 0.97) continue; // keep the start/finish straight clear
    const { position, right, tangent } = frameAt(curve, t);
    const w = widthAt(config.mainLoop, t, config.baseWidth) / 2;
    const side = i % 2 === 0 ? -1 : 1;
    const margin = 1.4 + Math.random() * 1.6;
    const pos = position.clone().addScaledVector(right, side * (w + margin));
    pos.y = position.y;
    const type = types[i % types.length]!;
    props.push({
      type,
      position: [pos.x, pos.y, pos.z],
      rotationY: Math.atan2(tangent.x, tangent.z) + (Math.random() - 0.5) * 0.6,
      scale: 0.85 + Math.random() * 0.4,
    });
  }

  return {
    id: config.id,
    mainLoop: config.mainLoop,
    baseWidth: config.baseWidth,
    closed: true,
    checkpointCount: config.checkpointCount,
    shortcut: config.shortcut,
    hazards: config.hazards,
    propPalette: config.propPalette,
    props,
    terrainColor: config.terrainColor,
    terrainSize: config.terrainSize,
    hasWater: config.hasWater,
    waterLevelY: config.waterLevelY,
    elevatedSections: [],
  };
}
