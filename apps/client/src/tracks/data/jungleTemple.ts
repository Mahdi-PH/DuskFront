import { authorTrack, generateLoopPoints, generateShortcutBranch, pointOnLoopAt } from '../TrackAuthoring';
import type { TrackRuntimeDefinition } from '../TrackTypes';

const CHECKPOINT_COUNT = 15;

const mainLoop = generateLoopPoints({
  pointCount: 19,
  radiusX: 75,
  radiusZ: 58,
  wiggleAmp: 0.3,
  wiggleFreq: 4,
  elevationFn: (angle) => {
    const jumpCenter = Math.PI * 1.35;
    return 2.6 * Math.exp(-Math.pow(angle - jumpCenter, 2) / (2 * 0.07));
  },
  widthFn: (angle) => 1 - 0.3 * Math.exp(-Math.pow(angle - Math.PI * 0.9, 2) / (2 * 0.025)),
});

export const JUNGLE_TEMPLE: TrackRuntimeDefinition = authorTrack({
  id: 'jungle-temple',
  mainLoop,
  baseWidth: 11,
  checkpointCount: CHECKPOINT_COUNT,
  shortcut: generateShortcutBranch(mainLoop, 0.35, 0.48, CHECKPOINT_COUNT, 0.55, 'collapsed-wall', 0.5),
  hazards: [
    {
      id: 'falling-tree-1',
      kind: 'falling-trees',
      position: pointOnLoopAt(mainLoop, 0.22),
      radius: 7,
      telegraphSec: 1.2,
      cycleSec: 8,
      damageSpeedPenalty: 0.45,
      stunSec: 0.5,
    },
    {
      id: 'falling-tree-2',
      kind: 'falling-trees',
      position: pointOnLoopAt(mainLoop, 0.75),
      radius: 7,
      telegraphSec: 1.2,
      cycleSec: 10,
      damageSpeedPenalty: 0.45,
      stunSec: 0.5,
    },
  ],
  propPalette: 'jungle',
  terrainColor: 0x2c4a2e,
  terrainSize: 330,
  hasWater: false,
  waterLevelY: 0,
});
