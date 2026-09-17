import { getTrackById, getVehicleById } from '@velocity-island/shared';

/** Validates checkpoint-crossing reports without needing the full 3D track geometry
 * server-side: checkpoints must arrive in strict sequential order (mod checkpoint
 * count) and no faster than physically possible given the track's length and the
 * player's vehicle top speed. This catches lap/checkpoint skipping and time
 * manipulation without duplicating the client's spline/collision system. */
export class CheckpointValidator {
  private nextExpectedIndex = 0;
  private lap = 0;
  private lastCrossingAtMs: number | null = null;
  private readonly checkpointCount: number;
  private readonly minMsBetweenCheckpoints: number;

  constructor(trackId: string, vehicleId: string) {
    const track = getTrackById(trackId);
    const vehicle = getVehicleById(vehicleId);
    this.checkpointCount = track.checkpointCount;
    const segmentLengthMeters = track.lengthMeters / track.checkpointCount;
    const maxSpeedMs = vehicle.physics.topSpeed * 1.6; // allow for boost
    this.minMsBetweenCheckpoints = (segmentLengthMeters / maxSpeedMs) * 1000 * 0.5; // 50% safety margin
  }

  /** Returns { accepted, lapCompleted } — rejects out-of-order or implausibly-fast
   * checkpoint reports without throwing, so a single bad packet just gets ignored. */
  reportCheckpoint(checkpointIndex: number, atMs: number): { accepted: boolean; lapCompleted: boolean } {
    if (checkpointIndex !== this.nextExpectedIndex) {
      return { accepted: false, lapCompleted: false };
    }
    if (this.lastCrossingAtMs !== null && atMs - this.lastCrossingAtMs < this.minMsBetweenCheckpoints) {
      return { accepted: false, lapCompleted: false };
    }

    this.lastCrossingAtMs = atMs;
    const wasLastCheckpoint = this.nextExpectedIndex === this.checkpointCount - 1;
    this.nextExpectedIndex = (this.nextExpectedIndex + 1) % this.checkpointCount;

    if (wasLastCheckpoint) {
      this.lap += 1;
      return { accepted: true, lapCompleted: true };
    }
    return { accepted: true, lapCompleted: false };
  }

  get currentLap(): number {
    return this.lap;
  }
}
