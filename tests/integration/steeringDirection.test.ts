import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { getVehicleById } from '@velocity-island/shared';
import { initPhysics, PhysicsWorld } from '../../apps/client/src/physics/PhysicsWorld';
import { VehicleController } from '../../apps/client/src/vehicles/VehicleController';

/**
 * Explicit direction-correctness guard (per the "LEFT=LEFT, RIGHT=RIGHT" control
 * requirements): drives a real VehicleController through real Rapier physics with
 * steer=+1/-1 and asserts the car actually curves toward the world's +X/-X axis, which
 * is the game's own definition of "right"/"left" (see checkpoint.right = (1,0,0) in
 * RaceManager/TrackBuilder, and the wheel anchors where +X = FR/RR = right-side wheels).
 *
 * Keyboard (D/ArrowRight -> steer=+1), touch joystick (finger right -> positive dx ->
 * steer=+1) and gamepad (left stick X, standard Gamepad API: +1 = right) all feed the
 * same steer=+1 meaning "right" into VehicleController, so this one test on the shared
 * physics consumer is what actually matters -- a sign error here would silently invert
 * every input source at once.
 */
function makeFlatGround(world: PhysicsWorld): void {
  const size = 200;
  const vertices = new Float32Array([-size, 0, -size, size, 0, -size, size, 0, size, -size, 0, size]);
  const indices = new Uint32Array([0, 1, 2, 0, 2, 3]);
  world.createTrackCollider(vertices, indices);
}

describe('steering direction', () => {
  let physicsWorld: PhysicsWorld;

  beforeAll(async () => {
    await initPhysics();
  });

  function driveWithSteer(steer: number): THREE.Vector3 {
    physicsWorld = new PhysicsWorld();
    makeFlatGround(physicsWorld);
    // yaw=0 spawns facing world +Z, matching checkpoint.forward=(0,0,1) convention.
    const controller = new VehicleController(physicsWorld, getVehicleById('wave'), new THREE.Vector3(0, 0.6, 0), 0);
    controller.setInput({ throttle: 1, brake: 0, steer, drift: false, boost: false });

    const deltaSec = 1 / 60;
    for (let t = 0; t < 2; t += deltaSec) {
      physicsWorld.step(deltaSec, (stepSec) => controller.applyForces(stepSec));
    }
    const pos = controller.body.translation();
    return new THREE.Vector3(pos.x, pos.y, pos.z);
  }

  it('steer=+1 (RIGHT) curves the car toward +X, the world/track "right" axis', () => {
    const pos = driveWithSteer(1);
    expect(pos.x).toBeGreaterThan(0.5);
  });

  it('steer=-1 (LEFT) curves the car toward -X, the world/track "left" axis', () => {
    const pos = driveWithSteer(-1);
    expect(pos.x).toBeLessThan(-0.5);
  });

  it('steer=0 keeps the car going straight (negligible lateral drift)', () => {
    const pos = driveWithSteer(0);
    expect(Math.abs(pos.x)).toBeLessThan(0.5);
  });
});
