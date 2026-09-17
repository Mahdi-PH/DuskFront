export interface Vector3Like {
  x: number;
  y: number;
  z: number;
}

export interface QuaternionLike {
  x: number;
  y: number;
  z: number;
  w: number;
}

/** Input sent from client to server every fixed tick. Server is authoritative over the resulting state. */
export interface RaceInputPayload {
  seq: number;
  clientTimeMs: number;
  throttle: number;
  brake: number;
  steer: number;
  drift: boolean;
  boost: boolean;
  usePowerUp: boolean;
}

/** Authoritative per-vehicle state snapshot broadcast from server. */
export interface VehicleSnapshot {
  playerId: string;
  lastProcessedInputSeq: number;
  position: Vector3Like;
  rotation: QuaternionLike;
  velocity: Vector3Like;
  speedKmh: number;
  lap: number;
  checkpointIndex: number;
  position_race: number;
  isDrifting: boolean;
  driftLevel: 0 | 1 | 2 | 3;
  boostCharge: number;
  heldPowerUp: string | null;
  isInvulnerable: boolean;
  isBot: boolean;
  finished: boolean;
  finishTimeMs: number | null;
}

export interface RaceStateSnapshot {
  serverTimeMs: number;
  phase: 'lobby' | 'countdown' | 'racing' | 'finished';
  countdownValue: number | null;
  trackId: string;
  totalLaps: number;
  vehicles: VehicleSnapshot[];
}
