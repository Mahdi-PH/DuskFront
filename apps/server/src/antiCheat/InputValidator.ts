import type { VehicleDefinition } from '@velocity-island/shared';

export interface PositionSample {
  x: number;
  y: number;
  z: number;
  atMs: number;
}

/** Server-side movement sanity checks. The client remains responsible for the actual
 * physics feel (see apps/client's Rapier simulation); the server does not re-simulate
 * full physics, but it DOES reject state that is physically impossible for the
 * player's vehicle, so a modified client can't just claim arbitrary speed or teleport
 * across the map. */
export class InputValidator {
  private lastSample: PositionSample | null = null;
  private flaggedCount = 0;

  constructor(private readonly vehicle: VehicleDefinition) {}

  get isFlaggedForReview(): boolean {
    return this.flaggedCount >= 5;
  }

  /** Returns false (and increments a flag counter) if this new sample implies an
   * impossible speed or an outright teleport since the last sample. */
  validateSample(sample: PositionSample): boolean {
    if (!this.lastSample) {
      this.lastSample = sample;
      return true;
    }

    const dtSec = (sample.atMs - this.lastSample.atMs) / 1000;
    if (dtSec <= 0) return true; // out-of-order packet, ignore rather than flag

    const dx = sample.x - this.lastSample.x;
    const dy = sample.y - this.lastSample.y;
    const dz = sample.z - this.lastSample.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const impliedSpeedMs = distance / dtSec;

    // Generous margin over top speed + boost to absorb network jitter, collision
    // knockback and jump arcs — this catches teleports and speed hacks, not normal play.
    const maxPlausibleSpeed = this.vehicle.physics.topSpeed * 2.2 + 15;

    this.lastSample = sample;

    if (impliedSpeedMs > maxPlausibleSpeed) {
      this.flaggedCount += 1;
      return false;
    }
    return true;
  }
}
