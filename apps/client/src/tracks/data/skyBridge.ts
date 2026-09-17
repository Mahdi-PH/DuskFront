import { authorTrack, generateLoopPoints, generateShortcutBranch, pointOnLoopAt } from '../TrackAuthoring';
import type { TrackRuntimeDefinition } from '../TrackTypes';

const CHECKPOINT_COUNT = 17;

const mainLoop = generateLoopPoints({
  pointCount: 21,
  radiusX: 90,
  radiusZ: 64,
  wiggleAmp: 0.12,
  wiggleFreq: 5,
  elevationFn: (angle) => 14 + 3 * Math.sin(angle * 2.5),
  widthFn: (angle) => 1 - 0.4 * Math.exp(-Math.pow(angle - Math.PI * 1.1, 2) / (2 * 0.015)),
});

export const SKY_BRIDGE: TrackRuntimeDefinition = authorTrack({
  id: 'sky-bridge',
  mainLoop,
  baseWidth: 10,
  checkpointCount: CHECKPOINT_COUNT,
  shortcut: generateShortcutBranch(mainLoop, 0.6, 0.72, CHECKPOINT_COUNT, 0.6, 'broken-span-jump', 0.4),
  hazards: [
    {
      id: 'platform-sway-1',
      kind: 'platform-sway',
      position: pointOnLoopAt(mainLoop, 0.4),
      radius: 9,
      telegraphSec: 2.0,
      cycleSec: 6,
      damageSpeedPenalty: 0.3,
      stunSec: 0.2,
    },
  ],
  propPalette: 'sky',
  terrainColor: 0x274a6b,
  terrainSize: 360,
  hasWater: false,
  waterLevelY: -40,
  propDensity: 30,
});
