import type { DriftLevel } from '../vehicles/vehicleMath';
import type { WeaponId } from '@velocity-island/shared';

export type GameEventMap = {
  raceCountdownTick: { value: number | null };
  raceStarted: Record<string, never>;
  lapCompleted: { playerId: string; lap: number; totalLaps: number; lapTimeMs: number; isPerfect: boolean };
  checkpointPassed: { playerId: string; checkpointIndex: number };
  positionsUpdated: { order: string[] };
  driftLevelChanged: { playerId: string; level: DriftLevel };
  boostActivated: { playerId: string };
  vehicleCollision: { playerId: string; strength: number; worldPoint: [number, number, number] };
  powerUpPickedUp: { playerId: string; weaponId: WeaponId };
  powerUpUsed: { playerId: string; weaponId: WeaponId };
  raceFinished: { playerId: string; position: number; totalTimeMs: number };
  playerRespawned: { playerId: string };
  wrongWayChanged: { playerId: string; wrongWay: boolean };
  hudSpeedUpdate: { playerId: string; speedKmh: number; boostCharge: number; driftLevel: DriftLevel };
};
