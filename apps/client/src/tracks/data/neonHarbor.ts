import { authorTrack, generateLoopPoints, generateShortcutBranch, pointOnLoopAt } from '../TrackAuthoring';
import type { TrackRuntimeDefinition } from '../TrackTypes';

const CHECKPOINT_COUNT = 14;

const mainLoop = generateLoopPoints({
  pointCount: 18,
  radiusX: 80,
  radiusZ: 52,
  wiggleAmp: 0.2,
  wiggleFreq: 3,
  elevationFn: (angle) => 1.2 * Math.sin(angle * 3) + 0.5,
  widthFn: (angle) => 1 - 0.3 * Math.exp(-Math.pow(angle - Math.PI * 0.8, 2) / (2 * 0.02)),
});

export const NEON_HARBOR: TrackRuntimeDefinition = authorTrack({
  id: 'neon-harbor',
  mainLoop,
  baseWidth: 12,
  checkpointCount: CHECKPOINT_COUNT,
  shortcut: generateShortcutBranch(mainLoop, 0.28, 0.4, CHECKPOINT_COUNT, 0.55, 'container-gap', 0.5),
  hazards: [
    {
      id: 'crane-sweep-1',
      kind: 'crane-sweep',
      position: pointOnLoopAt(mainLoop, 0.5),
      radius: 8,
      telegraphSec: 1.4,
      cycleSec: 7,
      damageSpeedPenalty: 0.4,
      stunSec: 0.4,
    },
    {
      id: 'moving-ship-1',
      kind: 'moving-ships',
      position: pointOnLoopAt(mainLoop, 0.85),
      radius: 10,
      telegraphSec: 2.0,
      cycleSec: 12,
      damageSpeedPenalty: 0.6,
      stunSec: 0.7,
    },
  ],
  propPalette: 'harbor',
  terrainColor: 0x0e1c2e,
  terrainSize: 330,
  hasWater: true,
  waterLevelY: -1.2,
});
