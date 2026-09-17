import { getTrackById } from '@velocity-island/shared';
import type { TrackRuntimeDefinition } from './TrackTypes';
import { SUNSET_BAY } from './data/sunsetBay';
import { VOLCANO_RUN } from './data/volcanoRun';
import { JUNGLE_TEMPLE } from './data/jungleTemple';
import { SKY_BRIDGE } from './data/skyBridge';
import { NEON_HARBOR } from './data/neonHarbor';
import { STORM_ISLAND } from './data/stormIsland';

const RUNTIME_TRACKS: Record<string, TrackRuntimeDefinition> = {
  'sunset-bay': SUNSET_BAY,
  'volcano-run': VOLCANO_RUN,
  'jungle-temple': JUNGLE_TEMPLE,
  'sky-bridge': SKY_BRIDGE,
  'neon-harbor': NEON_HARBOR,
  'storm-island': STORM_ISLAND,
};

export function getTrackRuntimeDefinition(id: string): TrackRuntimeDefinition {
  const def = RUNTIME_TRACKS[id];
  if (!def) throw new Error(`Unknown track runtime definition: ${id}`);
  return def;
}

export function getTrackSkyPresetId(trackId: string): string {
  return getTrackById(trackId).weather;
}

export function listPlayableTrackIds(): string[] {
  return Object.keys(RUNTIME_TRACKS);
}
