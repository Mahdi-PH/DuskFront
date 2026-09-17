import { authorTrack, generateLoopPoints, generateShortcutBranch, pointOnLoopAt } from '../TrackAuthoring';
import type { TrackRuntimeDefinition } from '../TrackTypes';

const CHECKPOINT_COUNT = 16;

const mainLoop = generateLoopPoints({
  pointCount: 20,
  radiusX: 85,
  radiusZ: 60,
  wiggleAmp: 0.28,
  wiggleFreq: 3,
  elevationFn: (angle) => {
    const climb = 6 * Math.max(0, Math.sin(angle - Math.PI * 0.2));
    const jumpCenter = Math.PI * 1.15;
    const jump = 4 * Math.exp(-Math.pow(angle - jumpCenter, 2) / (2 * 0.06));
    return climb * 0.4 + jump;
  },
  widthFn: (angle) => 1 - 0.25 * Math.exp(-Math.pow(angle - Math.PI * 0.6, 2) / (2 * 0.03)),
});

export const VOLCANO_RUN: TrackRuntimeDefinition = authorTrack({
  id: 'volcano-run',
  mainLoop,
  baseWidth: 11,
  checkpointCount: CHECKPOINT_COUNT,
  shortcut: generateShortcutBranch(mainLoop, 0.55, 0.68, CHECKPOINT_COUNT, 0.5, 'lava-tube', 0.5),
  hazards: [
    {
      id: 'eruption-1',
      kind: 'falling-rocks',
      position: pointOnLoopAt(mainLoop, 0.15),
      radius: 10,
      telegraphSec: 1.8,
      cycleSec: 11,
      damageSpeedPenalty: 0.55,
      stunSec: 0.6,
    },
    {
      id: 'eruption-2',
      kind: 'falling-rocks',
      position: pointOnLoopAt(mainLoop, 0.62),
      radius: 9,
      telegraphSec: 1.8,
      cycleSec: 13,
      damageSpeedPenalty: 0.5,
      stunSec: 0.5,
    },
  ],
  propPalette: 'volcanic',
  terrainColor: 0x3a2a24,
  terrainSize: 340,
  hasWater: false,
  waterLevelY: 0,
});
