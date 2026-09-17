import { authorTrack, generateLoopPoints, generateShortcutBranch, pointOnLoopAt } from '../TrackAuthoring';
import type { TrackRuntimeDefinition } from '../TrackTypes';

const CHECKPOINT_COUNT = 15;

const mainLoop = generateLoopPoints({
  pointCount: 19,
  radiusX: 76,
  radiusZ: 56,
  wiggleAmp: 0.25,
  wiggleFreq: 4,
  elevationFn: (angle) => {
    const jumpCenter = Math.PI * 0.9;
    return 2.8 * Math.exp(-Math.pow(angle - jumpCenter, 2) / (2 * 0.06));
  },
  widthFn: (angle) => 1 - 0.28 * Math.exp(-Math.pow(angle - Math.PI * 1.6, 2) / (2 * 0.02)),
});

export const STORM_ISLAND: TrackRuntimeDefinition = authorTrack({
  id: 'storm-island',
  mainLoop,
  baseWidth: 11,
  checkpointCount: CHECKPOINT_COUNT,
  shortcut: generateShortcutBranch(mainLoop, 0.45, 0.58, CHECKPOINT_COUNT, 0.55, 'flooded-culvert', 0.5),
  hazards: [
    {
      id: 'lightning-1',
      kind: 'lightning-strikes',
      position: pointOnLoopAt(mainLoop, 0.18),
      radius: 6,
      telegraphSec: 1.5,
      cycleSec: 6,
      damageSpeedPenalty: 0.5,
      stunSec: 0.6,
    },
    {
      id: 'lightning-2',
      kind: 'lightning-strikes',
      position: pointOnLoopAt(mainLoop, 0.68),
      radius: 6,
      telegraphSec: 1.5,
      cycleSec: 7,
      damageSpeedPenalty: 0.5,
      stunSec: 0.6,
    },
  ],
  propPalette: 'storm',
  terrainColor: 0x2c3140,
  terrainSize: 320,
  hasWater: true,
  waterLevelY: -1.0,
});
