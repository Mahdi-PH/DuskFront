import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { getVehicleById } from '@velocity-island/shared';
import { initPhysics, PhysicsWorld } from '../../apps/client/src/physics/PhysicsWorld';
import { VehicleController } from '../../apps/client/src/vehicles/VehicleController';
import { RaceManager } from '../../apps/client/src/game/RaceManager';
import { EventBus } from '../../apps/client/src/core/EventBus';
import type { GameEventMap } from '../../apps/client/src/game/GameEvents';
import type { BuiltTrack, CheckpointTransform } from '../../apps/client/src/tracks/TrackBuilder';

function makeStraightLoopCheckpoints(count: number, spacing: number): CheckpointTransform[] {
  return Array.from({ length: count }, (_, i) => ({
    index: i,
    position: new THREE.Vector3(0, 0, i * spacing),
    forward: new THREE.Vector3(0, 0, 1),
    right: new THREE.Vector3(1, 0, 0),
    width: 10,
    skippableViaShortcut: null,
  }));
}

function makeFakeTrack(checkpoints: CheckpointTransform[]): BuiltTrack {
  return {
    definition: {} as never,
    curve: new THREE.CatmullRomCurve3(checkpoints.map((c) => c.position)),
    roadGroup: new THREE.Group(),
    terrainMesh: new THREE.Mesh(),
    checkpoints,
    startGrid: [{ position: new THREE.Vector3(0, 0, -5), yawRad: 0 }],
    finishLinePosition: checkpoints[0]!.position,
    finishLineYaw: 0,
    colliders: [],
    water: null,
  };
}

describe('RaceManager', () => {
  let physicsWorld: PhysicsWorld;

  beforeAll(async () => {
    await initPhysics();
    physicsWorld = new PhysicsWorld();
  });

  function makeController(): VehicleController {
    return new VehicleController(physicsWorld, getVehicleById('wave'), new THREE.Vector3(0, 0, -5), 0);
  }

  it('advances checkpoints and completes a lap when crossing the loop', () => {
    const checkpoints = makeStraightLoopCheckpoints(4, 10);
    const track = makeFakeTrack(checkpoints);
    const events = new EventBus<GameEventMap>();
    const raceManager = new RaceManager(track, 2, events);
    const controller = makeController();

    raceManager.addRacer('p1', controller, false, 0);
    raceManager.phase = 'racing';

    let lapCompletedCount = 0;
    events.on('lapCompleted', () => {
      lapCompletedCount += 1;
    });

    const racer = raceManager.getRacer('p1')!;
    expect(racer.nextCheckpointIndex).toBe(0);

    // Drive past each checkpoint in order by teleporting just beyond it.
    for (let lap = 0; lap < 2; lap++) {
      for (let i = 0; i < checkpoints.length; i++) {
        const cp = checkpoints[i]!;
        controller.teleportTo(cp.position.clone().add(new THREE.Vector3(0, 0, 1)), 0);
        raceManager.update(1 / 60);
      }
    }

    expect(lapCompletedCount).toBe(2);
    expect(racer.finished).toBe(true);
    expect(racer.lap).toBe(2);
  });

  it('does not advance past a checkpoint the racer has not reached', () => {
    const checkpoints = makeStraightLoopCheckpoints(4, 10);
    const track = makeFakeTrack(checkpoints);
    const events = new EventBus<GameEventMap>();
    const raceManager = new RaceManager(track, 1, events);
    const controller = makeController();
    raceManager.addRacer('p1', controller, false, 0);
    raceManager.phase = 'racing';

    // Sitting well behind checkpoint 0 should not advance the index.
    controller.teleportTo(new THREE.Vector3(0, 0, -5), 0);
    raceManager.update(1 / 60);

    const racer = raceManager.getRacer('p1')!;
    expect(racer.nextCheckpointIndex).toBe(0);
    expect(racer.lap).toBe(0);
  });

  it('respawns a racer that drifts too far laterally off track', () => {
    const checkpoints = makeStraightLoopCheckpoints(4, 10);
    const track = makeFakeTrack(checkpoints);
    const events = new EventBus<GameEventMap>();
    const raceManager = new RaceManager(track, 1, events);
    const controller = makeController();
    raceManager.addRacer('p1', controller, false, 0);
    raceManager.phase = 'racing';

    let respawned = false;
    events.on('playerRespawned', () => {
      respawned = true;
    });

    // Push the racer far to the side of checkpoint 0's track width and hold it there
    // past the off-track grace period.
    controller.teleportTo(new THREE.Vector3(40, 0, -2), 0);
    for (let i = 0; i < 200; i++) {
      raceManager.update(1 / 60);
    }

    expect(respawned).toBe(true);
  });
});
