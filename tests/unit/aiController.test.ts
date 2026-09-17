import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { getVehicleById } from '@velocity-island/shared';
import { initPhysics, PhysicsWorld } from '../../apps/client/src/physics/PhysicsWorld';
import { VehicleController } from '../../apps/client/src/vehicles/VehicleController';
import { AIController } from '../../apps/client/src/ai/AIController';
import type { BuiltTrack, CheckpointTransform } from '../../apps/client/src/tracks/TrackBuilder';
import type { RacerRuntime } from '../../apps/client/src/game/RaceManager';

function makeStraightTrack(): BuiltTrack {
  const points = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 40), new THREE.Vector3(0, 0, 80), new THREE.Vector3(0, 0, 120)];
  const curve = new THREE.CatmullRomCurve3(points, false);
  const checkpoints: CheckpointTransform[] = points.map((p, i) => ({
    index: i,
    position: p,
    forward: new THREE.Vector3(0, 0, 1),
    right: new THREE.Vector3(1, 0, 0),
    width: 10,
    skippableViaShortcut: null,
  }));
  return {
    definition: {} as never,
    curve,
    roadGroup: new THREE.Group(),
    terrainMesh: new THREE.Mesh(),
    checkpoints,
    startGrid: [{ position: new THREE.Vector3(0, 0, -5), yawRad: 0 }],
    finishLinePosition: points[0]!,
    finishLineYaw: 0,
    colliders: [],
    water: null,
  };
}

function makeRacer(controller: VehicleController, nextCheckpointIndex: number): RacerRuntime {
  return {
    playerId: 'bot-1',
    controller,
    isBot: true,
    lap: 0,
    nextCheckpointIndex,
    lastCheckpointPassedAtMs: 0,
    raceProgress: 0,
    position: 1,
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
    invulnerableSec: 0,
    isPerfectLapSoFar: true,
  };
}

describe('AIController', () => {
  let physicsWorld: PhysicsWorld;

  beforeAll(async () => {
    await initPhysics();
    physicsWorld = new PhysicsWorld();
  });

  it('steers toward the aim point ahead on the track spline', () => {
    const track = makeStraightTrack();
    const ai = new AIController(track, 'expert');
    const controller = new VehicleController(physicsWorld, getVehicleById('wave'), new THREE.Vector3(8, 0, 5), 0);
    const racer = makeRacer(controller, 1);

    let lastDecision;
    for (let i = 0; i < 90; i++) {
      lastDecision = ai.update(1 / 60, racer, [], false);
    }

    // The car sits to the right (+x) of the straight track ahead of it, facing +z, so it
    // must steer to bring its nose back toward the centerline.
    expect(lastDecision!.input.steer).not.toBe(0);
    expect(lastDecision!.input.throttle).toBeGreaterThan(0);
  });

  it('keeps steering near zero when already aimed straight down the track', () => {
    const track = makeStraightTrack();
    const ai = new AIController(track, 'expert');
    const controller = new VehicleController(physicsWorld, getVehicleById('wave'), new THREE.Vector3(0, 0, 5), 0);
    const racer = makeRacer(controller, 1);

    let lastDecision;
    for (let i = 0; i < 30; i++) {
      lastDecision = ai.update(1 / 60, racer, [], false);
    }

    expect(Math.abs(lastDecision!.input.steer)).toBeLessThan(0.2);
    expect(lastDecision!.input.throttle).toBeGreaterThan(0.8);
  });
});
