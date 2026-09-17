import * as THREE from 'three';
import { RACE_BALANCE } from '@velocity-island/shared';
import type { VehicleController } from '../vehicles/VehicleController';
import type { BuiltTrack, CheckpointTransform } from '../tracks/TrackBuilder';
import type { EventBus } from '../core/EventBus';
import type { GameEventMap } from './GameEvents';
import { clamp } from '../vehicles/vehicleMath';

export type RacePhase = 'lobby' | 'countdown' | 'racing' | 'finished';

export interface RacerRuntime {
  playerId: string;
  controller: VehicleController;
  isBot: boolean;
  lap: number;
  nextCheckpointIndex: number;
  lastCheckpointPassedAtMs: number;
  raceProgress: number;
  position: number;
  totalTimeMs: number;
  bestLapMs: number;
  currentLapStartMs: number;
  lapTimesMs: number[];
  finished: boolean;
  finishTimeMs: number | null;
  driftDistanceMeters: number;
  powerUpsUsedCount: number;
  collisionCount: number;
  wrongWaySec: number;
  offTrackSec: number;
  stuckSec: number;
  invulnerableSec: number;
  isPerfectLapSoFar: boolean;
}

/** Owns countdown → race → finish state, checkpoint/lap validation, wrong-way and
 * off-track detection, and live position ranking. Framework-agnostic: it only reads
 * VehicleController state and calls teleportTo() for respawns, so it works the same in
 * single-player and (driven by server snapshots) in multiplayer playback. */
export class RaceManager {
  phase: RacePhase = 'lobby';
  countdownValue: number | null = null;
  private countdownElapsedSec = 0;
  private racers = new Map<string, RacerRuntime>();
  private raceClockMs = 0;

  constructor(
    private readonly track: BuiltTrack,
    readonly totalLaps: number,
    private readonly events: EventBus<GameEventMap>,
  ) {}

  addRacer(playerId: string, controller: VehicleController, isBot: boolean, startIndex: number): void {
    const grid = this.track.startGrid[startIndex % this.track.startGrid.length]!;
    controller.teleportTo(grid.position.clone(), grid.yawRad);
    this.racers.set(playerId, {
      playerId,
      controller,
      isBot,
      lap: 0,
      nextCheckpointIndex: 0,
      lastCheckpointPassedAtMs: 0,
      raceProgress: 0,
      position: this.racers.size + 1,
      totalTimeMs: 0,
      bestLapMs: Infinity,
      currentLapStartMs: 0,
      lapTimesMs: [],
      finished: false,
      finishTimeMs: null,
      driftDistanceMeters: 0,
      powerUpsUsedCount: 0,
      collisionCount: 0,
      wrongWaySec: 0,
      offTrackSec: 0,
      stuckSec: 0,
      invulnerableSec: RACE_BALANCE.respawn.invulnerabilitySec,
      isPerfectLapSoFar: true,
    });
  }

  getRacer(playerId: string): RacerRuntime | undefined {
    return this.racers.get(playerId);
  }

  getAllRacers(): RacerRuntime[] {
    return Array.from(this.racers.values());
  }

  startCountdown(): void {
    this.phase = 'countdown';
    this.countdownElapsedSec = 0;
    this.countdownValue = RACE_BALANCE.countdown.steps[0] ?? 3;
    this.events.emit('raceCountdownTick', { value: this.countdownValue });
  }

  update(deltaSec: number): void {
    if (this.phase === 'countdown') {
      this.updateCountdown(deltaSec);
      return;
    }
    if (this.phase !== 'racing') return;

    this.raceClockMs += deltaSec * 1000;
    for (const racer of this.racers.values()) {
      if (racer.finished) continue;
      racer.totalTimeMs += deltaSec * 1000;
      this.updateRacer(racer, deltaSec);
    }
    this.updatePositions();
  }

  private updateCountdown(deltaSec: number): void {
    this.countdownElapsedSec += deltaSec;
    const steps = RACE_BALANCE.countdown.steps;
    const stepDuration = 1;
    const stepIndex = Math.floor(this.countdownElapsedSec / stepDuration);
    if (stepIndex < steps.length) {
      const value = steps[stepIndex] ?? null;
      if (value !== this.countdownValue) {
        this.countdownValue = value;
        this.events.emit('raceCountdownTick', { value });
      }
    } else if (this.countdownElapsedSec < steps.length * stepDuration + RACE_BALANCE.countdown.goDisplaySec) {
      if (this.countdownValue !== 0) {
        this.countdownValue = 0; // 0 signals "GO!" to the HUD
        this.events.emit('raceCountdownTick', { value: 0 });
      }
    } else {
      this.phase = 'racing';
      this.countdownValue = null;
      for (const racer of this.racers.values()) racer.currentLapStartMs = 0;
      this.events.emit('raceStarted', {});
    }
  }

  private updateRacer(racer: RacerRuntime, deltaSec: number): void {
    if (racer.invulnerableSec > 0) racer.invulnerableSec -= deltaSec;

    const checkpoint = this.track.checkpoints[racer.nextCheckpointIndex]!;
    const position = racer.controller.getWorldPosition();
    const toCheckpoint = position.clone().sub(checkpoint.position);
    const alongForward = toCheckpoint.dot(checkpoint.forward);
    const lateral = toCheckpoint.dot(checkpoint.right);

    if (alongForward > 0 && Math.abs(lateral) < checkpoint.width / 2 + 2) {
      this.advanceCheckpoint(racer, checkpoint);
    }

    this.updateWrongWay(racer, checkpoint, deltaSec);
    this.updateOffTrackAndStuck(racer, checkpoint, deltaSec);

    if (racer.controller.state.isDrifting) {
      racer.driftDistanceMeters += Math.abs(racer.controller.state.forwardSpeedMs) * deltaSec;
    }

    racer.raceProgress = racer.lap * this.track.checkpoints.length + racer.nextCheckpointIndex + clamp(alongForward / 20, 0, 0.99);
  }

  private advanceCheckpoint(racer: RacerRuntime, checkpoint: CheckpointTransform): void {
    racer.lastCheckpointPassedAtMs = this.raceClockMs;
    this.events.emit('checkpointPassed', { playerId: racer.playerId, checkpointIndex: checkpoint.index });

    const isLastCheckpoint = racer.nextCheckpointIndex === this.track.checkpoints.length - 1;
    racer.nextCheckpointIndex = (racer.nextCheckpointIndex + 1) % this.track.checkpoints.length;

    if (isLastCheckpoint) {
      const lapTimeMs = this.raceClockMs - racer.currentLapStartMs;
      racer.currentLapStartMs = this.raceClockMs;
      racer.lap += 1;
      racer.lapTimesMs.push(lapTimeMs);
      racer.bestLapMs = Math.min(racer.bestLapMs, lapTimeMs);
      const isPerfect = racer.isPerfectLapSoFar;
      racer.isPerfectLapSoFar = true;
      this.events.emit('lapCompleted', {
        playerId: racer.playerId,
        lap: racer.lap,
        totalLaps: this.totalLaps,
        lapTimeMs,
        isPerfect,
      });

      if (racer.lap >= this.totalLaps) {
        racer.finished = true;
        racer.finishTimeMs = racer.totalTimeMs;
        const finishedCount = Array.from(this.racers.values()).filter((r) => r.finished).length;
        this.events.emit('raceFinished', { playerId: racer.playerId, position: finishedCount, totalTimeMs: racer.totalTimeMs });
      }
    }
  }

  private updateWrongWay(racer: RacerRuntime, checkpoint: CheckpointTransform, deltaSec: number): void {
    const velocity = racer.controller.body.linvel();
    const velocityVec = new THREE.Vector3(velocity.x, velocity.y, velocity.z);
    const speed = velocityVec.length();
    if (speed < 1) {
      if (racer.wrongWaySec > 0) {
        racer.wrongWaySec = 0;
        this.events.emit('wrongWayChanged', { playerId: racer.playerId, wrongWay: false });
      }
      return;
    }
    const movingAgainstTrack = velocityVec.normalize().dot(checkpoint.forward) < -0.3;
    const wasWrongWay = racer.wrongWaySec > RACE_BALANCE.wrongWay.warnAfterSec;
    racer.wrongWaySec = movingAgainstTrack ? racer.wrongWaySec + deltaSec : 0;
    const isWrongWay = racer.wrongWaySec > RACE_BALANCE.wrongWay.warnAfterSec;
    if (isWrongWay !== wasWrongWay) {
      this.events.emit('wrongWayChanged', { playerId: racer.playerId, wrongWay: isWrongWay });
    }
  }

  private updateOffTrackAndStuck(racer: RacerRuntime, checkpoint: CheckpointTransform, deltaSec: number): void {
    const position = racer.controller.getWorldPosition();
    const lateral = Math.abs(position.clone().sub(checkpoint.position).dot(checkpoint.right));
    const isOffTrack = lateral > checkpoint.width / 2 + 6;
    racer.offTrackSec = isOffTrack ? racer.offTrackSec + deltaSec : 0;

    const isStuck =
      racer.controller.state.isGrounded &&
      Math.abs(racer.controller.state.forwardSpeedMs) < RACE_BALANCE.respawn.stuckSpeedThreshold;
    racer.stuckSec = isStuck ? racer.stuckSec + deltaSec : 0;

    const isFlipped = racer.controller.state.flippedTimeSec > RACE_BALANCE.respawn.flipTimeoutSec;

    if (
      racer.offTrackSec > RACE_BALANCE.respawn.offTrackGraceSec ||
      racer.stuckSec > RACE_BALANCE.respawn.stuckTimeoutSec ||
      isFlipped
    ) {
      this.respawnRacer(racer);
    }
  }

  respawnRacer(racer: RacerRuntime): void {
    const checkpointIndex = (racer.nextCheckpointIndex - 1 + this.track.checkpoints.length) % this.track.checkpoints.length;
    const checkpoint = this.track.checkpoints[checkpointIndex]!;
    const yaw = Math.atan2(checkpoint.forward.x, checkpoint.forward.z);
    racer.controller.teleportTo(checkpoint.position.clone().add(new THREE.Vector3(0, 0.5, 0)), yaw);
    racer.offTrackSec = 0;
    racer.stuckSec = 0;
    racer.invulnerableSec = RACE_BALANCE.respawn.invulnerabilitySec;
    racer.isPerfectLapSoFar = false;
    this.events.emit('playerRespawned', { playerId: racer.playerId });
  }

  registerCollision(racer: RacerRuntime): void {
    racer.collisionCount += 1;
    racer.isPerfectLapSoFar = false;
  }

  private updatePositions(): void {
    const ordered = Array.from(this.racers.values()).sort((a, b) => {
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      if (a.finished && b.finished) return (a.finishTimeMs ?? 0) - (b.finishTimeMs ?? 0);
      return b.raceProgress - a.raceProgress;
    });
    let changed = false;
    ordered.forEach((racer, i) => {
      const newPosition = i + 1;
      if (racer.position !== newPosition) changed = true;
      racer.position = newPosition;
    });
    if (changed) {
      this.events.emit('positionsUpdated', { order: ordered.map((r) => r.playerId) });
    }
  }
}
