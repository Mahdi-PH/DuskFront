import { authorTrack, generateLoopPoints, generateShortcutBranch, pointOnLoopAt } from '../TrackAuthoring';
import type { TrackRuntimeDefinition } from '../TrackTypes';

const CHECKPOINT_COUNT = 14;

const mainLoop = generateLoopPoints({
  pointCount: 18,
  radiusX: 78,
  radiusZ: 54,
  wiggleAmp: 0.18,
  wiggleFreq: 2,
  elevationFn: (angle) => {
    const jumpCenter = Math.PI * 0.55;
    const jump = 3.2 * Math.exp(-Math.pow(angle - jumpCenter, 2) / (2 * 0.08));
    return jump;
  },
  widthFn: (angle) => {
    const pinchCenter = Math.PI * 1.5;
    const pinch = 1 - 0.35 * Math.exp(-Math.pow(angle - pinchCenter, 2) / (2 * 0.02));
    return pinch;
  },
});

export const SUNSET_BAY: TrackRuntimeDefinition = authorTrack({
  id: 'sunset-bay',
  mainLoop,
  baseWidth: 12,
  checkpointCount: CHECKPOINT_COUNT,
  shortcut: generateShortcutBranch(mainLoop, 0.78, 0.92, CHECKPOINT_COUNT, 0.55, 'pier-cut', 0.55),
  hazards: [
    {
      id: 'tide-surge-1',
      kind: 'tide-surge',
      position: pointOnLoopAt(mainLoop, 0.35),
      radius: 8,
      telegraphSec: 1.5,
      cycleSec: 9,
      damageSpeedPenalty: 0.4,
      stunSec: 0.3,
    },
  ],
  propPalette: 'tropical',
  terrainColor: 0xd8c48a,
  terrainSize: 320,
  hasWater: true,
  waterLevelY: -1.6,
});
