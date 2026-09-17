import type { VehiclePhysicsConfig } from '@velocity-island/shared';

/** Pure, side-effect-free arcade vehicle math. Kept separate from VehicleController
 * (which drives Rapier) so the tuning curves can be unit tested without a physics world. */

const MS_TO_KMH = 3.6;

export function speedMsToKmh(speedMs: number): number {
  return speedMs * MS_TO_KMH;
}

/** Engine force falls off linearly from full acceleration at 0 speed to zero at topSpeed,
 * so the car naturally settles at its configured top speed instead of needing an artificial clamp. */
export function computeEngineForce(
  throttle: number,
  brake: number,
  forwardSpeedMs: number,
  physics: VehiclePhysicsConfig,
): number {
  const topSpeedMs = physics.topSpeed;
  const reverseSpeedMs = physics.reverseSpeed;

  if (throttle > 0) {
    const headroom = Math.max(0, 1 - forwardSpeedMs / topSpeedMs);
    return physics.acceleration * physics.mass * throttle * headroom;
  }
  if (brake > 0) {
    if (forwardSpeedMs > 0.3) {
      return -physics.braking * physics.mass * brake;
    }
    const headroom = Math.max(0, 1 - Math.abs(forwardSpeedMs) / reverseSpeedMs);
    return -physics.acceleration * physics.mass * 0.6 * brake * headroom;
  }
  return 0;
}

/** Steering authority reduces at higher speed so the kart doesn't snap-spin at top speed. */
export function computeSteerAngleRad(
  steerInput: number,
  forwardSpeedMs: number,
  physics: VehiclePhysicsConfig,
): number {
  const speedFactor = 1 - Math.min(0.7, (Math.abs(forwardSpeedMs) / physics.topSpeed) * physics.steerSpeedFactor);
  const maxAngle = (physics.steerAngleDeg * Math.PI) / 180;
  return steerInput * maxAngle * speedFactor;
}

export type DriftLevel = 0 | 1 | 2 | 3;

export interface DriftThresholds {
  superDriftSec: number;
  ultraDriftSec: number;
}

export const DEFAULT_DRIFT_THRESHOLDS: DriftThresholds = {
  superDriftSec: 1.2,
  ultraDriftSec: 2.4,
};

export function computeDriftLevel(driftHeldSec: number, thresholds: DriftThresholds = DEFAULT_DRIFT_THRESHOLDS): DriftLevel {
  if (driftHeldSec >= thresholds.ultraDriftSec) return 3;
  if (driftHeldSec >= thresholds.superDriftSec) return 2;
  if (driftHeldSec > 0) return 1;
  return 0;
}

/** Boost charge earned per second of drift, scaled by level so committing to a longer drift pays off more. */
export function computeDriftBoostChargeRate(driftLevel: DriftLevel): number {
  switch (driftLevel) {
    case 1:
      return 0.15;
    case 2:
      return 0.35;
    case 3:
      return 0.6;
    default:
      return 0;
  }
}

export function computeLateralGrip(isDrifting: boolean, physics: VehiclePhysicsConfig): number {
  return isDrifting ? physics.gripBase * physics.driftGripFactor : physics.gripBase;
}

export function computeBoostAcceleration(physics: VehiclePhysicsConfig, boostMultiplier = 1): number {
  return physics.boostForce * boostMultiplier;
}

/** Impact impulse scaling: heavier / higher-collisionResistance vehicles shrug off hits more. */
export function computeCollisionImpulseFactor(physics: VehiclePhysicsConfig): number {
  return 1 - physics.collisionResistance * 0.6;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}
