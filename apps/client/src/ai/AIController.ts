import * as THREE from 'three';
import type { AIDifficulty } from '@velocity-island/shared';
import type { BuiltTrack } from '../tracks/TrackBuilder';
import type { RacerRuntime } from '../game/RaceManager';
import type { VehicleInputState } from '../vehicles/VehicleController';
import { AI_DIFFICULTY_PROFILES, type AIDifficultyProfile } from './AIDifficultyProfiles';
import { clamp, lerp } from '../vehicles/vehicleMath';

export interface AIObstacle {
  position: THREE.Vector3;
  radius: number;
}

export interface AIDecision {
  input: VehicleInputState;
  usePowerUp: boolean;
}

/** Waypoint-following bot: aims at a lookahead point on the track spline, steers toward
 * it with a reaction-time low-pass filter, brakes for sharp turns, drifts through them
 * when skilled enough, nudges around nearby obstacles, and occasionally uses its held
 * power-up. Mistakes are modeled as decaying steering noise rather than random speed
 * loss, so a bot that messes up still looks like it's driving, not teleporting. */
export class AIController {
  private readonly profile: AIDifficultyProfile;
  private smoothedSteer = 0;
  private mistakeNoise = 0;
  private mistakeNoiseDecaySec = 0;
  private powerUpHoldTimerSec = 0;
  private trackLength: number;

  constructor(
    private readonly track: BuiltTrack,
    difficulty: AIDifficulty,
  ) {
    this.profile = AI_DIFFICULTY_PROFILES[difficulty];
    this.trackLength = track.curve.getLength();
  }

  update(deltaSec: number, racer: RacerRuntime, obstacles: AIObstacle[], hasHeldPowerUp: boolean): AIDecision {
    const profile = this.profile;
    const controller = racer.controller;
    const position = controller.getWorldPosition();
    const quaternion = controller.getWorldQuaternion();
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion);

    const checkpointCount = this.track.checkpoints.length;
    const baseT = racer.nextCheckpointIndex / checkpointCount;
    const lookaheadT = profile.lookaheadMeters / Math.max(1, this.trackLength);
    const aimPoint = this.track.curve.getPointAt((baseT + lookaheadT) % 1);

    let toAim = aimPoint.clone().sub(position);
    toAim.y = 0;
    if (toAim.lengthSq() < 0.0001) toAim = forward.clone();
    toAim.normalize();

    const flatForward = forward.clone().setY(0).normalize();
    const cross = flatForward.x * toAim.z - flatForward.z * toAim.x;
    const dot = clamp(flatForward.dot(toAim), -1, 1);
    let angle = Math.atan2(-cross, dot);

    angle += this.applyObstacleAvoidance(position, flatForward, obstacles, profile);

    // Occasionally inject a mistake: a temporary steering bias that decays back to zero.
    if (this.mistakeNoiseDecaySec <= 0 && Math.random() < profile.mistakeChancePerSec * deltaSec) {
      this.mistakeNoise = (Math.random() * 2 - 1) * profile.mistakeSteerNoise;
      this.mistakeNoiseDecaySec = 0.4 + Math.random() * 0.4;
    }
    if (this.mistakeNoiseDecaySec > 0) {
      this.mistakeNoiseDecaySec -= deltaSec;
      this.mistakeNoise = lerp(this.mistakeNoise, 0, deltaSec / Math.max(0.01, this.mistakeNoiseDecaySec));
    }

    const targetSteer = clamp(angle * profile.steerGain + this.mistakeNoise, -1, 1);
    const reactionRate = 1 - Math.pow(0.001, deltaSec / Math.max(0.02, profile.reactionDelaySec));
    this.smoothedSteer = lerp(this.smoothedSteer, targetSteer, reactionRate);

    const turnSeverity = Math.min(1, Math.abs(angle) / 0.9);
    const throttle = clamp(1 - turnSeverity * 0.65, 0.35, 1);
    const brake = turnSeverity > 0.85 && controller.state.forwardSpeedMs > 12 ? 0.4 : 0;

    const speedMs = Math.abs(controller.state.forwardSpeedMs);
    const wantsDrift =
      Math.abs(angle) > profile.driftAngleThresholdRad &&
      speedMs > 10 &&
      controller.state.isGrounded &&
      Math.random() < profile.driftSkill + 0.3;

    const clearAhead = turnSeverity < 0.25;
    const wantsBoost =
      controller.state.boostCharge >= 0.6 && clearAhead && Math.random() < profile.boostUseChance * deltaSec;

    let usePowerUp = false;
    if (hasHeldPowerUp) {
      this.powerUpHoldTimerSec += deltaSec;
      if (this.powerUpHoldTimerSec > profile.powerUpReactionDelaySec) {
        usePowerUp = Math.random() < deltaSec * 2;
      }
    } else {
      this.powerUpHoldTimerSec = 0;
    }

    return {
      input: {
        throttle,
        brake,
        steer: this.smoothedSteer,
        drift: wantsDrift,
        boost: wantsBoost,
      },
      usePowerUp,
    };
  }

  private applyObstacleAvoidance(
    position: THREE.Vector3,
    flatForward: THREE.Vector3,
    obstacles: AIObstacle[],
    profile: AIDifficultyProfile,
  ): number {
    let avoidance = 0;
    const right = new THREE.Vector3(-flatForward.z, 0, flatForward.x);
    for (const obstacle of obstacles) {
      const toObstacle = obstacle.position.clone().sub(position);
      const forwardDist = toObstacle.dot(flatForward);
      if (forwardDist <= 0 || forwardDist > 14) continue;
      const lateralDist = toObstacle.dot(right);
      if (Math.abs(lateralDist) > obstacle.radius + 2.5) continue;
      const closeness = 1 - forwardDist / 14;
      avoidance += -Math.sign(lateralDist || 1) * closeness * profile.obstacleAvoidanceGain * 0.6;
    }
    return clamp(avoidance, -1, 1);
  }
}
